"""
GPU side: launches the notebook's CUDA kernels (see kernels.py).

Every GPU computation in this application goes through `_launch()`, which
(a) records the launch in a counter/log that the UI shows as proof, and
(b) calls the real kernel:  kernel[grid, block](*args).
There is deliberately no NumPy/CPU fallback anywhere in this file.
"""
from __future__ import annotations

import hashlib
import inspect
import math
import subprocess
import threading
import time
from collections import Counter, deque

import numpy as np
import numba
from numba import cuda

from . import config
from .errors import ApiError
from . import kernels as K

# op -> (first kernel, final kernel); average reuses the sum kernels (sum / n).
KERNEL_PAIRS = {
    "sum": (K.partial_sum, K.final_sum),
    "min": (K.find_min, K.final_min),
    "max": (K.find_max, K.final_max),
}
ALL_KERNELS = [K.partial_sum, K.final_sum, K.find_min, K.final_min, K.find_max, K.final_max]

GPU_LOCK = threading.Lock()          # one GPU job at a time -> clean timings
LAUNCH_COUNTS: Counter = Counter()
LAUNCH_LOG: deque = deque(maxlen=60)


# ------------------------------------------------------------------ helpers
def simulator_active() -> bool:
    return bool(getattr(numba.config, "ENABLE_CUDASIM", False))


def require_gpu() -> None:
    """Raise a clear error instead of ever falling back to the CPU."""
    if simulator_active() and not config.ALLOW_CUDASIM:
        raise ApiError(503, "cuda_simulator", "Numba is running in CUDA *simulator* mode, not on a GPU.",
                       "Unset NUMBA_ENABLE_CUDASIM and use a GPU runtime.")
    if not cuda.is_available():
        raise ApiError(503, "no_cuda_gpu", "No CUDA GPU is available to this backend.",
                       "In Colab choose Runtime > Change runtime type > T4 GPU, then restart the session.")


def _launch(kernel, blocks: int, threads: int, *args) -> None:
    """The single place where a CUDA kernel is launched."""
    kernel[blocks, threads](*args)
    LAUNCH_COUNTS[kernel.py_func.__name__] += 1
    LAUNCH_LOG.append({"t": time.time(), "kernel": kernel.py_func.__name__,
                       "blocks": blocks, "threads": threads})


def choose_blocks(n: int, override: int | None = None) -> int:
    """Blocks needed for n elements, capped at MAX_BLOCKS (1024 = notebook's best).

    The kernels are grid-stride, so any block count is correct; fewer blocks for
    small n just avoids launching blocks that would have no work.
    """
    if override:
        return max(1, min(int(override), 65535))
    return max(1, min(config.MAX_BLOCKS, math.ceil(n / config.THREADS_PER_BLOCK)))


def _cuda_error(exc: Exception) -> ApiError:
    msg = str(exc)
    low = msg.lower()
    if "out_of_memory" in low or "out of memory" in low or "memory allocation" in low:
        return ApiError(507, "gpu_out_of_memory",
                        "The GPU ran out of memory for this dataset. Nothing was computed on the CPU instead.",
                        "Use a smaller dataset (a Tesla T4 has about 15 GB).")
    return ApiError(500, "cuda_error", f"CUDA error: {msg[:300]}",
                    "Restart the Colab runtime if this repeats.")


def free_gpu_memory() -> tuple[int, int]:
    free, total = cuda.current_context().get_memory_info()
    return int(free), int(total)


def ensure_gpu_capacity(n_bytes: int) -> None:
    if simulator_active():      # the simulator has no device memory to query
        return
    free, total = free_gpu_memory()
    need = n_bytes + 16 * 1024 * 1024
    if need > free:
        raise ApiError(507, "gpu_out_of_memory",
                       f"Dataset needs {need / 2**30:.2f} GB of GPU memory but only {free / 2**30:.2f} GB "
                       f"of {total / 2**30:.2f} GB is free. Nothing was computed on the CPU instead.",
                       "Use a smaller dataset.")


# --------------------------------------------------------------- reductions
def _reduce_once(op: str, d_data, n: int, blocks: int, d_partials, d_result) -> None:
    first, final = KERNEL_PAIRS[op]
    _launch(first, blocks, config.THREADS_PER_BLOCK, d_data, d_partials, n)
    _launch(final, 1, config.THREADS_PER_BLOCK, d_partials, d_result, blocks)


def _timed_reduction(op: str, d_data, n: int, blocks: int, repeats: int) -> dict:
    """Warm up, then time `repeats` runs with CUDA events + synchronisation."""
    d_partials = cuda.device_array(blocks, dtype=np.float32)
    d_result = cuda.device_array(1, dtype=np.float32)

    # Warm-up: JIT-compiles on first use and primes caches (notebook does the same).
    _reduce_once(op, d_data, n, blocks, d_partials, d_result)
    cuda.synchronize()

    kernel_ms = []
    for _ in range(repeats):
        start, end = cuda.event(), cuda.event()
        cuda.synchronize()
        start.record()
        _reduce_once(op, d_data, n, blocks, d_partials, d_result)
        end.record()
        end.synchronize()
        kernel_ms.append(float(start.elapsed_time(end)))

    cuda.synchronize()
    t0 = time.perf_counter()
    value = float(d_result.copy_to_host()[0])           # device -> host, 1 float
    readback_ms = (time.perf_counter() - t0) * 1000.0
    return {"value": value, "kernel_ms": float(np.mean(kernel_ms)),
            "kernel_ms_min": float(np.min(kernel_ms)), "kernel_ms_max": float(np.max(kernel_ms)),
            "runs_ms": [round(k, 4) for k in kernel_ms], "readback_ms": readback_ms}


def run_gpu(data: np.ndarray, ops: list[str], repeats: int, blocks_override: int | None) -> dict:
    """Copy `data` to the GPU once, then run the kernels for every requested op."""
    require_gpu()
    n = int(data.size)
    blocks = choose_blocks(n, blocks_override)
    with GPU_LOCK:
        try:
            ensure_gpu_capacity(data.nbytes)
            # ---- host -> device transfer (timed; includes synchronisation) ----
            transfer = []
            d_data = None
            for _ in range(repeats):
                d_data = None  # release previous copy before allocating the next
                cuda.synchronize()
                t0 = time.perf_counter()
                d_data = cuda.to_device(data)
                cuda.synchronize()
                transfer.append((time.perf_counter() - t0) * 1000.0)

            per_op: dict[str, dict] = {}
            need_sum = "sum" in ops or "average" in ops
            if need_sum:
                per_op["sum"] = _timed_reduction("sum", d_data, n, blocks, repeats)
            if "min" in ops:
                per_op["min"] = _timed_reduction("min", d_data, n, blocks, repeats)
            if "max" in ops:
                per_op["max"] = _timed_reduction("max", d_data, n, blocks, repeats)
            if "average" in ops:   # average = GPU sum / n  (as in the notebook)
                s = per_op["sum"]
                per_op["average"] = {**s, "value": float(s["value"]) / n}
            del d_data
        except ApiError:
            raise
        except cuda.cudadrv.error.CudaSupportError as exc:
            raise _cuda_error(exc)
        except Exception as exc:  # CudaAPIError and friends
            raise _cuda_error(exc)

    return {
        "transfer_ms": float(np.mean(transfer)),
        "transfer_ms_min": float(np.min(transfer)),
        "transfer_ms_max": float(np.max(transfer)),
        "per_op": per_op,
        "launch": {"blocks": blocks, "threads_per_block": config.THREADS_PER_BLOCK,
                   "partials_length": blocks, "elements": n,
                   "elements_per_thread": round(n / (blocks * config.THREADS_PER_BLOCK), 2)},
    }


# ----------------------------------------------------------------- warm-up
def warmup_compile() -> None:
    """Compile all six kernels once at start-up with the exact argument types used later."""
    require_gpu()
    with GPU_LOCK:
        data = cuda.to_device(np.arange(1024, dtype=np.float32))
        for op in KERNEL_PAIRS:
            p = cuda.device_array(4, dtype=np.float32)
            r = cuda.device_array(1, dtype=np.float32)
            _reduce_once(op, data, 1024, 4, p, r)
        cuda.synchronize()
    LAUNCH_COUNTS.clear()
    LAUNCH_LOG.clear()


# ------------------------------------------------------------------ info
def _nvidia_smi() -> dict | None:
    try:
        out = subprocess.run(
            ["nvidia-smi", "--query-gpu=name,driver_version,utilization.gpu,memory.used,memory.total,"
             "temperature.gpu,power.draw", "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=5)
        if out.returncode != 0 or not out.stdout.strip():
            return None
        f = [x.strip() for x in out.stdout.strip().splitlines()[0].split(",")]
        return {"name": f[0], "driver": f[1], "utilization_pct": f[2], "memory_used_mib": f[3],
                "memory_total_mib": f[4], "temperature_c": f[5], "power_w": f[6]}
    except Exception:
        return None


def gpu_info() -> dict:
    info = {"simulator": simulator_active(), "numba_version": numba.__version__,
            "cuda_available": bool(cuda.is_available())}
    if simulator_active():
        info.update(name="CUDA SIMULATOR (not a real GPU)", is_t4=False)
        return info
    if not info["cuda_available"]:
        return info
    dev = cuda.get_current_device()
    name = dev.name.decode() if isinstance(dev.name, bytes) else str(dev.name)
    free, total = free_gpu_memory()
    info.update(
        name=name, is_t4="t4" in name.lower(),
        compute_capability=f"{dev.compute_capability[0]}.{dev.compute_capability[1]}",
        multiprocessors=int(dev.MULTIPROCESSOR_COUNT),
        max_threads_per_block=int(dev.MAX_THREADS_PER_BLOCK),
        warp_size=int(dev.WARP_SIZE),
        memory_total_bytes=total, memory_free_bytes=free,
        smi=_nvidia_smi(),
    )
    try:
        info["cuda_driver_version"] = ".".join(map(str, cuda.runtime.get_version()))
    except Exception:
        pass
    return info


def kernel_registry() -> list[dict]:
    pair_of = {"partial_sum": "sum (pass 1: per-block partial sums)",
               "final_sum": "sum (pass 2: combine partials)",
               "find_min": "minimum (pass 1)", "final_min": "minimum (pass 2)",
               "find_max": "maximum (pass 1)", "final_max": "maximum (pass 2)"}
    out = []
    for k in ALL_KERNELS:
        name = k.py_func.__name__
        src = inspect.getsource(k.py_func)
        try:
            sigs = [str(s) for s in k.signatures]
        except Exception:
            sigs = []
        out.append({
            "name": name, "role": pair_of[name], "source": src,
            "sha256": hashlib.sha256(src.encode()).hexdigest()[:16],
            "defined_in": "backend/app/kernels.py (copied from notebook)",
            "compiled_signatures": sigs, "launches": int(LAUNCH_COUNTS[name]),
        })
    return out


def run_selftest() -> dict:
    """Known-answer test: 1..N has closed-form sum/min/max, so no CPU library is involved."""
    require_gpu()
    n = 100_000
    data = np.arange(1, n + 1, dtype=np.float32)
    g = run_gpu(data, ["sum", "min", "max"], 1, None)
    expected = {"sum": n * (n + 1) / 2, "min": 1.0, "max": float(n)}
    checks = []
    for op, exp in expected.items():
        got = g["per_op"][op]["value"]
        ok = abs(got - exp) <= (1e-5 * abs(exp) if op == "sum" else 0)
        checks.append({"op": op, "expected": exp, "gpu": got, "pass": bool(ok)})
    return {"elements": n, "checks": checks, "passed": all(c["pass"] for c in checks),
            "launch": g["launch"]}
