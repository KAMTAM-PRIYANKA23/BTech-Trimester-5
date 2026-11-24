"""FastAPI application. Start with:  python run_server.py"""
from __future__ import annotations

import os
import secrets
import shutil
import tempfile
import time
from contextlib import asynccontextmanager

import numba
import psutil
from fastapi import Depends, FastAPI, File, Form, Header, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from . import config, datasets, gpu_engine, service
from .errors import ApiError

STARTED = time.time()


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not config.API_KEY and not config.ALLOW_NO_AUTH:
        raise RuntimeError("API_KEY is not set. Refusing to start an unauthenticated GPU server.")
    app.state.warm = {"ok": False, "error": None}
    try:
        gpu_engine.warmup_compile()           # compile all six kernels before the first request
        app.state.warm["ok"] = True
    except ApiError as exc:
        app.state.warm["error"] = exc.message
    except Exception as exc:                  # keep the API up so the UI can show the reason
        app.state.warm["error"] = str(exc)
    yield


app = FastAPI(title="CUDA Aggregation Engine", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware, allow_origins=config.ALLOWED_ORIGINS, allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "X-API-Key", "ngrok-skip-browser-warning"],
)


@app.exception_handler(ApiError)
async def api_error_handler(_: Request, exc: ApiError):
    return JSONResponse(status_code=exc.status,
                        content={"error": {"code": exc.code, "message": exc.message, "hint": exc.hint}})


def require_key(x_api_key: str | None = Header(default=None)) -> None:
    if config.ALLOW_NO_AUTH and not config.API_KEY:
        return
    if not x_api_key or not secrets.compare_digest(x_api_key, config.API_KEY):
        raise ApiError(401, "bad_api_key", "The API key is missing or incorrect.",
                       "Copy the API key printed by the Colab notebook into Settings.")


auth = [Depends(require_key)]


# ------------------------------------------------------------------ models
class GenerateReq(BaseModel):
    size: int = Field(..., ge=1, description="number of float32 elements")
    distribution: str = "integers"
    seed: int | None = None
    name: str | None = Field(default=None, max_length=80)


class PresetReq(BaseModel):
    preset: str


class ComputeReq(BaseModel):
    dataset_id: str
    operation: str = Field(..., pattern="^(sum|average|min|max|all)$")
    repeats: int = Field(default=5, ge=1, le=20)
    blocks: int | None = Field(default=None, ge=1, le=65535)


# ------------------------------------------------------------------ routes
@app.get("/api/health")
def health():
    """Unauthenticated: lets the UI tell 'backend reachable' apart from 'wrong key'."""
    return {"status": "ok", "service": "cuda-aggregation-engine", "auth_required": not config.ALLOW_NO_AUTH,
            "gpu_ready": app.state.warm["ok"], "gpu_error": app.state.warm["error"],
            "uptime_s": round(time.time() - STARTED, 1)}


@app.get("/api/gpu", dependencies=auth)
def gpu():
    vm = psutil.virtual_memory()
    return {**gpu_engine.gpu_info(), "host_ram_total_bytes": vm.total, "host_ram_free_bytes": vm.available,
            "launch_config": {"threads_per_block": config.THREADS_PER_BLOCK, "max_blocks": config.MAX_BLOCKS},
            "limits": {"max_elements": config.MAX_ELEMENTS, "max_upload_mb": config.MAX_UPLOAD_MB,
                       "max_stored_datasets": config.MAX_STORED_DATASETS},
            "warmup": app.state.warm}


@app.get("/api/kernels", dependencies=auth)
def kernels():
    return {"kernels": gpu_engine.kernel_registry(), "recent_launches": list(gpu_engine.LAUNCH_LOG)[-20:],
            "total_launches": int(sum(gpu_engine.LAUNCH_COUNTS.values()))}


@app.post("/api/selftest", dependencies=auth)
def selftest():
    return gpu_engine.run_selftest()


@app.get("/api/presets", dependencies=auth)
def presets():
    return {"presets": [{"key": k, **v} for k, v in datasets.PRESETS.items()],
            "distributions": datasets.DISTRIBUTIONS}


@app.get("/api/datasets", dependencies=auth)
def list_datasets():
    return {"datasets": datasets.STORE.list()}


@app.post("/api/datasets/preset", dependencies=auth)
def load_preset(req: PresetReq):
    p = datasets.PRESETS.get(req.preset)
    if not p:
        raise ApiError(404, "unknown_preset", f"Unknown preset '{req.preset}'.")
    existing = datasets.STORE.find_preset(req.preset)
    if existing:
        return {"dataset": existing.public(), "evicted": [], "reused": True}
    ds, evicted = datasets.create_generated(p["size"], "integers", 42, req.preset, source="preset")
    ds.name = req.preset
    return {"dataset": {**ds.public(), "name": req.preset, "label": p["label"]}, "evicted": evicted, "reused": False}


@app.post("/api/datasets/generate", dependencies=auth)
def generate(req: GenerateReq):
    ds, evicted = datasets.create_generated(req.size, req.distribution, req.seed, req.name)
    return {"dataset": ds.public(), "evicted": evicted}


@app.post("/api/datasets/upload", dependencies=auth)
def upload(file: UploadFile = File(...), column: str = Form(default=""), on_invalid: str = Form(default="skip")):
    if on_invalid not in ("skip", "reject"):
        raise ApiError(422, "bad_policy", "on_invalid must be 'skip' or 'reject'.")
    name = file.filename or "upload.csv"
    if not name.lower().endswith((".csv", ".txt", ".tsv")):
        raise ApiError(415, "unsupported_extension", f"'{name}' is not a supported file type.",
                       "Upload a .csv, .tsv or .txt file containing numbers.")
    limit = config.MAX_UPLOAD_MB * 1024 * 1024
    fd, tmp = tempfile.mkstemp(suffix=".csv")
    try:
        size = 0
        with os.fdopen(fd, "wb") as out:
            while chunk := file.file.read(1024 * 1024):
                size += len(chunk)
                if size > limit:
                    raise ApiError(413, "file_too_large",
                                   f"The file is larger than the {config.MAX_UPLOAD_MB} MB upload limit.",
                                   "Use the dataset generator for very large benchmarks.")
                out.write(chunk)
        if size == 0:
            raise ApiError(422, "empty_file", "The file is empty.", "Upload a CSV that contains numbers.")
        ds, evicted = datasets.create_from_csv(tmp, name, column or None, on_invalid)
    finally:
        try:
            os.remove(tmp)
        except OSError:
            pass
    return {"dataset": ds.public(), "evicted": evicted}


@app.delete("/api/datasets/{ds_id}", dependencies=auth)
def delete_dataset(ds_id: str):
    datasets.STORE.delete(ds_id)
    return {"deleted": ds_id}


@app.post("/api/compute", dependencies=auth)
def compute(req: ComputeReq):
    ds = datasets.STORE.get(req.dataset_id)
    result = service.compare(ds, req.operation, req.repeats, req.blocks)
    result["gpu"] = {"name": gpu_engine.gpu_info().get("name"), "simulator": gpu_engine.simulator_active()}
    return result


class BenchReq(BaseModel):
    size: int = Field(..., ge=1)
    distribution: str = "integers"
    seed: int | None = 42
    operation: str = Field(default="all", pattern="^(sum|average|min|max|all)$")
    repeats: int = Field(default=3, ge=1, le=20)


@app.post("/api/benchmark", dependencies=auth)
def benchmark(req: BenchReq):
    """Generate a throw-away dataset of `size`, run the comparison, discard it (used by the size sweep)."""
    ds, _ = datasets.create_generated(req.size, req.distribution, req.seed, f"sweep-{req.size}",
                                      source="generated", persist=False)
    result = service.compare(ds, req.operation, req.repeats, None)
    result["gpu"] = {"name": gpu_engine.gpu_info().get("name"), "simulator": gpu_engine.simulator_active()}
    return result
