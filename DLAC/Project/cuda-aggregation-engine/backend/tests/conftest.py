"""Tests run the REAL kernels through Numba's CUDA *simulator* (no GPU in CI).
They prove kernel logic/launch maths; they say nothing about T4 speed."""
import os, sys
os.environ.update(NUMBA_ENABLE_CUDASIM="1", ALLOW_CUDASIM="1", AGG_MAX_BLOCKS="4",
                  API_KEY="test-key", ALLOWED_ORIGINS="http://localhost:5173")
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import warnings; warnings.filterwarnings("ignore")
import pytest
import numpy as np

# SIMULATOR-ONLY SHIM. numba's simulator cannot evaluate `float32(np.inf)` (used by the
# min/max kernels); real CUDA compiles it fine. np.float32 behaves identically for the
# kernel logic, so tests swap it in. kernels.py itself is NOT modified.
import app.kernels as _k
_k.float32 = np.float32
from fastapi.testclient import TestClient

@pytest.fixture(scope="session")
def client():
    from app.main import app
    with TestClient(app) as c:
        yield c

H = {"X-API-Key": "test-key"}
