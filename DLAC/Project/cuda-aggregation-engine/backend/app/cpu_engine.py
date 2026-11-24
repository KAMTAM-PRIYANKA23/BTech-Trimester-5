"""CPU side: timed NumPy aggregation (same calls as the notebook)."""
import time
import numpy as np

OPS = ("sum", "average", "min", "max")
_CPU_FN = {"sum": np.sum, "average": np.mean, "min": np.min, "max": np.max}


def run_cpu(data: np.ndarray, op: str, repeats: int) -> dict:
    """Time NumPy `repeats` times (after one untimed warm-up call).

    Returns the float32 result NumPy produces (what the notebook compares) and
    the mean/min/max wall-clock time in milliseconds.
    """
    fn = _CPU_FN[op]
    result = fn(data)  # warm-up (page-in, caches)
    times = []
    for _ in range(repeats):
        t0 = time.perf_counter()
        result = fn(data)
        times.append((time.perf_counter() - t0) * 1000.0)
    return {
        "result": float(result),
        "time_ms": float(np.mean(times)),
        "time_ms_min": float(np.min(times)),
        "time_ms_max": float(np.max(times)),
        "runs_ms": [round(t, 4) for t in times],
    }
