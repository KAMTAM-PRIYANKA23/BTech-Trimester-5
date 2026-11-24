import io
import numpy as np
import pytest
from conftest import H


def gen(client, n, dist="integers", seed=1):
    r = client.post("/api/datasets/generate", headers=H, json={"size": n, "distribution": dist, "seed": seed})
    assert r.status_code == 200, r.text
    return r.json()["dataset"]


def test_health_open_and_gpu_requires_key(client):
    assert client.get("/api/health").json()["status"] == "ok"
    assert client.get("/api/gpu").status_code == 401
    assert client.get("/api/gpu", headers={"X-API-Key": "wrong"}).status_code == 401
    g = client.get("/api/gpu", headers=H).json()
    assert g["simulator"] is True and "SIMULATOR" in g["name"]


def test_cors_preflight_allows_custom_headers(client):
    r = client.options("/api/compute", headers={"Origin": "http://localhost:5173",
        "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "x-api-key,content-type,ngrok-skip-browser-warning"})
    assert r.status_code == 200 and r.headers["access-control-allow-origin"] == "http://localhost:5173"
    bad = client.options("/api/compute", headers={"Origin": "http://evil.example", "Access-Control-Request-Method": "POST"})
    assert "access-control-allow-origin" not in bad.headers


def test_selftest_known_answers(client):
    r = client.post("/api/selftest", headers=H).json()
    assert r.get("passed"), r


@pytest.mark.parametrize("n", [1, 2, 7, 255, 256, 257, 1000, 5000, 100_000])
def test_all_ops_match_for_many_lengths(client, n):
    ds = gen(client, n)
    r = client.post("/api/compute", headers=H, json={"dataset_id": ds["id"], "operation": "all", "repeats": 2}).json()
    assert r["all_match"], r["rows"]
    assert [x["op"] for x in r["rows"]] == ["sum", "average", "min", "max"]
    assert r["launch"]["partials_length"] == r["launch"]["blocks"] >= 1
    assert r["launch"]["blocks"] == min(4, max(1, -(-n // 256)))
    client.delete(f"/api/datasets/{ds['id']}", headers=H)


def test_gpu_results_independent_of_cpu(client):
    """Cross-check against numpy float64 on data we create ourselves."""
    ds = gen(client, 3333, "normal", seed=9)
    for op in ["sum", "average", "min", "max"]:
        r = client.post("/api/compute", headers=H, json={"dataset_id": ds["id"], "operation": op, "repeats": 1}).json()
        row = r["rows"][0]
        ref = np.random.default_rng(9).normal(500, 100, 3333).astype(np.float32).astype(np.float64)
        want = {"sum": ref.sum(), "average": ref.mean(), "min": ref.min(), "max": ref.max()}[op]
        assert abs(row["gpu_result"] - want) <= 1e-4 * abs(want) + (0 if op in ("min", "max") else 0), (op, row["gpu_result"], want)
        assert row["match"]
        if op in ("min", "max"):
            assert row["gpu_result"] == pytest.approx(want, abs=1e-3)


def test_negative_and_mixed_sign_data(client):
    csv = "v\n-5\n3\n-1000.5\n2.25\n999\n"
    ds = client.post("/api/datasets/upload", headers=H, files={"file": ("m.csv", csv)}).json()["dataset"]
    r = client.post("/api/compute", headers=H, json={"dataset_id": ds["id"], "operation": "all", "repeats": 1}).json()
    got = {x["op"]: x["gpu_result"] for x in r["rows"]}
    assert got["min"] == -1000.5 and got["max"] == 999 and got["sum"] == pytest.approx(-1.25)
    assert r["all_match"]


def test_kernels_were_really_launched(client):
    before = client.get("/api/kernels", headers=H).json()["total_launches"]
    ds = gen(client, 600)
    r = client.post("/api/compute", headers=H, json={"dataset_id": ds["id"], "operation": "all", "repeats": 1}).json()
    after = client.get("/api/kernels", headers=H).json()
    assert after["total_launches"] - before == 6 * 2   # 3 reductions x 2 kernels x (1 warm-up + 1 timed)
    names = {k["name"]: k["launches"] for k in after["kernels"]}
    assert all(names[k] > 0 for k in ["partial_sum", "final_sum", "find_min", "final_min", "find_max", "final_max"])
    assert {e["kernel"] for e in r["kernel_launches"]} == set(names)


def test_timing_fields_and_speedup_math(client):
    ds = gen(client, 2000)
    r = client.post("/api/compute", headers=H, json={"dataset_id": ds["id"], "operation": "sum", "repeats": 2}).json()
    row = r["rows"][0]
    assert row["gpu_total_ms"] == pytest.approx(row["gpu_transfer_ms"] + row["gpu_kernel_ms"] + row["gpu_readback_ms"])
    assert row["overall_speedup"] == pytest.approx(row["cpu_ms"] / row["gpu_total_ms"])
    assert row["gpu_faster_overall"] == (row["gpu_total_ms"] < row["cpu_ms"])


def test_unknown_dataset_and_bad_input(client):
    assert client.post("/api/compute", headers=H, json={"dataset_id": "nope", "operation": "sum"}).json()["error"]["code"] == "dataset_not_found"
    assert client.post("/api/compute", headers=H, json={"dataset_id": "x", "operation": "median"}).status_code == 422
    assert client.post("/api/datasets/generate", headers=H, json={"size": 0}).status_code == 422
    assert client.post("/api/datasets/generate", headers=H, json={"size": 10, "distribution": "x"}).status_code == 422
    assert client.post("/api/datasets/generate", headers=H, json={"size": 10**12}).json()["error"]["code"] == "dataset_too_large"


def up(client, content, name="t.csv", **form):
    return client.post("/api/datasets/upload", headers=H, files={"file": (name, content)}, data=form)


def test_csv_valid_with_header_and_columns(client):
    r = up(client, "id,price\n1,10.5\n2,20\n3,30.25\n")
    j = r.json()
    assert r.status_code == 200 and j["dataset"]["size"] == 3
    rep = j["dataset"]["report"]
    assert rep["header_detected"] and rep["column_used"] == "id"
    r2 = up(client, "id,price\n1,10.5\n2,20\n", column="price").json()
    assert r2["dataset"]["report"]["column_used"] == "price" and r2["dataset"]["max"] == 20


def test_csv_semicolon_and_no_header(client):
    j = up(client, "1;2;3\n4;5;6\n").json()
    assert j["dataset"]["size"] == 2 and j["dataset"]["report"]["delimiter"] == ";"


def test_csv_bad_values_skipped_and_reported(client):
    content = "x\n1\n\nabc\n3\nNA\ninf\n1e999\n5\n"
    r = up(client, content)
    rep = r.json()["dataset"]["report"]
    assert r.status_code == 200
    assert rep["values_accepted"] == 3 and rep["rows_rejected"] == 4
    assert rep["non_numeric"] >= 1 and rep["missing"] >= 1 and rep["examples"]


def test_csv_reject_policy(client):
    r = up(client, "x\n1\nabc\n3\n", on_invalid="reject")
    assert r.status_code == 422 and r.json()["error"]["code"] == "invalid_values"


@pytest.mark.parametrize("content,name,code", [
    ("", "e.csv", "empty_file"),
    ("   \n\n", "e.csv", "empty_file"),
    ("a,b\n", "h.csv", None),
    (b"\x00\x01\x02binary", "b.csv", "unsupported_file"),
    ("name\nfoo\nbar\n", "t.csv", "no_numeric_column"),
    ("1,2\n3,4\n", "x.exe", "unsupported_extension"),
])
def test_csv_rejections(client, content, name, code):
    r = up(client, content, name=name)
    assert r.status_code >= 400
    if code:
        assert r.json()["error"]["code"] == code
    assert r.json()["error"]["message"]


def test_dataset_store_evicts_and_deletes(client):
    ids = [gen(client, 50, seed=i)["id"] for i in range(6)]
    listed = [d["id"] for d in client.get("/api/datasets", headers=H).json()["datasets"]]
    assert len(listed) <= 4 and ids[-1] in listed and ids[0] not in listed
    assert client.delete(f"/api/datasets/{ids[-1]}", headers=H).status_code == 200
    assert client.delete(f"/api/datasets/{ids[-1]}", headers=H).status_code == 404


def test_presets_exist(client):
    p = client.get("/api/presets", headers=H).json()["presets"]
    assert [x["size"] for x in p] == [100_000, 1_000_000, 10_000_000, 50_000_000]


def test_benchmark_endpoint_does_not_store_dataset(client):
    before = len(client.get("/api/datasets", headers=H).json()["datasets"])
    r = client.post("/api/benchmark", headers=H, json={"size": 3000, "repeats": 1}).json()
    assert r["all_match"] and r["dataset"]["size"] == 3000
    assert len(client.get("/api/datasets", headers=H).json()["datasets"]) == before
