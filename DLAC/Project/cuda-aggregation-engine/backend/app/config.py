"""Runtime configuration, read from environment variables."""
import os


def _int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except ValueError:
        return default


API_KEY = os.environ.get("API_KEY", "")
ALLOW_NO_AUTH = os.environ.get("ALLOW_NO_AUTH") == "1"
# Browsers that may call this API. Comma separated. "*" is accepted for quick demos.
ALLOWED_ORIGINS = [
    o.strip()
    for o in os.environ.get(
        "ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",")
    if o.strip()
]
MAX_ELEMENTS = _int("MAX_ELEMENTS", 300_000_000)        # hard ceiling per dataset
MAX_UPLOAD_MB = _int("MAX_UPLOAD_MB", 400)              # CSV upload ceiling
MAX_STORED_DATASETS = _int("MAX_STORED_DATASETS", 4)    # oldest evicted (LRU)
# CUDA launch tuning. 1024 blocks x 256 threads is the best configuration found
# in notebook cells 77-82. Lower only for the CUDA *simulator* used in tests.
MAX_BLOCKS = _int("AGG_MAX_BLOCKS", 1024)
THREADS_PER_BLOCK = 256  # fixed by cuda.shared.array(256, ...) in the kernels
ALLOW_CUDASIM = os.environ.get("ALLOW_CUDASIM") == "1"
