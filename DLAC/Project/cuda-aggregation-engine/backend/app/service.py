"""Orchestrates one CPU-vs-GPU comparison and checks correctness."""
from __future__ import annotations

import numpy as np

from . import cpu_engine, gpu_engine
from .datasets import Dataset

RTOL = 1e-4   # float32 summation tolerance, relative to sum(|x|); min/max must match exactly
OP_LABEL = {"sum": "Sum", "average": "Average", "min": "Minimum", "max": "Maximum"}


def expand_ops(operation: str) -> list[str]:
    return list(cpu_engine.OPS) if operation == "all" else [operation]


def reference(ds: Dataset, op: str) -> float:
    s = ds.stats
    return {"sum": s["sum"], "average": s["sum"] / s["n"], "min": s["min"], "max": s["max"]}[op]


def check(ds: Dataset, op: str, cpu: float, gpu: float) -> dict:
    """Compare GPU to CPU (what the user sees) and to a float64 reference."""
    n, sa = ds.stats["n"], ds.stats["sum_abs"]
    ref = reference(ds, op)
    if op in ("min", "max"):
        tol = 0.0
    elif op == "sum":
        tol = RTOL * sa
    else:
        tol = RTOL * sa / n
    diff = abs(gpu - cpu)
    return {
        "reference_float64": ref,
        "abs_diff": diff,
        "rel_diff": diff / abs(cpu) if cpu else (0.0 if diff == 0 else float("inf")),
        "gpu_vs_reference_rel": abs(gpu - ref) / abs(ref) if ref else abs(gpu - ref),
        "tolerance": tol,
        "match": bool(diff <= tol) and bool(np.isfinite(gpu)),
    }


def compare(ds: Dataset, operation: str, repeats: int, blocks: int | None) -> dict:
    ops = expand_ops(operation)
    cpu = {op: cpu_engine.run_cpu(ds.data, op, repeats) for op in ops}
    gpu = gpu_engine.run_gpu(ds.data, ops, repeats, blocks)

    rows, tot_cpu, tot_kernel, tot_read = [], 0.0, 0.0, 0.0
    for op in ops:
        c, g = cpu[op], gpu["per_op"][op]
        chk = check(ds, op, c["result"], g["value"])
        total = gpu["transfer_ms"] + g["kernel_ms"] + g["readback_ms"]
        rows.append({
            "op": op, "label": OP_LABEL[op],
            "cpu_result": c["result"], "gpu_result": g["value"],
            "cpu_ms": c["time_ms"], "cpu_ms_min": c["time_ms_min"], "cpu_ms_max": c["time_ms_max"],
            "gpu_kernel_ms": g["kernel_ms"], "gpu_kernel_ms_min": g["kernel_ms_min"],
            "gpu_kernel_ms_max": g["kernel_ms_max"],
            "gpu_readback_ms": g["readback_ms"],
            "gpu_transfer_ms": gpu["transfer_ms"],
            "gpu_total_ms": total,
            "kernel_speedup": c["time_ms"] / g["kernel_ms"] if g["kernel_ms"] > 0 else None,
            "overall_speedup": c["time_ms"] / total if total > 0 else None,
            "gpu_faster_overall": total < c["time_ms"],
            **chk,
        })
        tot_cpu += c["time_ms"]
    # Combined run: data is copied once; ops that share the sum kernel (sum + average) run it once.
    kernel_ops = {"sum" if o == "average" else o for o in ops}
    for ko in kernel_ops:
        tot_kernel += gpu["per_op"][ko]["kernel_ms"]
        tot_read += gpu["per_op"][ko]["readback_ms"]
    cpu_for_kernels = sum(cpu[o]["time_ms"] for o in ops)
    combined_total = gpu["transfer_ms"] + tot_kernel + tot_read
    return {
        "dataset": ds.public(), "operation": operation, "repeats": repeats,
        "launch": gpu["launch"], "gpu_transfer_ms": gpu["transfer_ms"],
        "gpu_transfer_ms_min": gpu["transfer_ms_min"], "gpu_transfer_ms_max": gpu["transfer_ms_max"],
        "bytes_transferred": int(ds.data.nbytes),
        "transfer_gbps": (ds.data.nbytes / 1e9) / (gpu["transfer_ms"] / 1000.0) if gpu["transfer_ms"] else None,
        "rows": rows,
        "all_match": all(r["match"] for r in rows),
        "summary": {
            "cpu_ms": cpu_for_kernels, "gpu_kernel_ms": tot_kernel, "gpu_transfer_ms": gpu["transfer_ms"],
            "gpu_readback_ms": tot_read, "gpu_total_ms": combined_total,
            "kernel_speedup": cpu_for_kernels / tot_kernel if tot_kernel else None,
            "overall_speedup": cpu_for_kernels / combined_total if combined_total else None,
            "gpu_faster_overall": combined_total < cpu_for_kernels,
        },
        "kernel_launches": [e for e in list(gpu_engine.LAUNCH_LOG)[-(len(kernel_ops) * 2 * (repeats + 1)):]],
    }
