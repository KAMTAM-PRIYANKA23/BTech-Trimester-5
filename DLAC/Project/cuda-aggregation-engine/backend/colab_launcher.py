"""
Helpers used by the Colab notebook (colab/CUDA_Aggregation_Backend.ipynb).

Keeping the logic here (instead of inside notebook cells) means it can be tested
and every notebook cell stays a one-liner a beginner can read.
"""
from __future__ import annotations

import os
import re
import secrets
import signal
import subprocess
import sys
import time
import urllib.request
import json

HERE = os.path.dirname(os.path.abspath(__file__))
LOG = os.path.join(HERE, "server.log")
_state: dict = {"proc": None, "tunnel": None, "cf": None}


def preflight() -> dict:
    """Confirm a real GPU is attached and the six notebook kernels run correctly."""
    from numba import cuda
    import numba

    if getattr(numba.config, "ENABLE_CUDASIM", False):
        raise RuntimeError("Numba is in CUDA simulator mode. Unset NUMBA_ENABLE_CUDASIM.")
    if not cuda.is_available():
        raise RuntimeError("No CUDA GPU found. In Colab: Runtime > Change runtime type > T4 GPU, then Runtime > Restart session.")
    name = cuda.get_current_device().name
    name = name.decode() if isinstance(name, bytes) else name
    sys.path.insert(0, HERE)
    from app import gpu_engine   # imports the kernels copied from your notebook

    gpu_engine.warmup_compile()
    test = gpu_engine.run_selftest()
    return {"gpu": name, "is_t4": "t4" in name.lower(), "numba": numba.__version__,
            "selftest_passed": test["passed"], "selftest": test["checks"]}


def new_api_key() -> str:
    return secrets.token_urlsafe(24)


def stop_server() -> None:
    p = _state.get("proc")
    if p and p.poll() is None:
        p.send_signal(signal.SIGTERM)
        try:
            p.wait(timeout=8)
        except subprocess.TimeoutExpired:
            p.kill()
    _state["proc"] = None
    # Also free the port if an old server from a previous run is still alive.
    subprocess.run(["bash", "-c", "pkill -f 'run_server.py' || true"], check=False)


def start_server(api_key: str, allowed_origins: str = "http://localhost:5173,http://127.0.0.1:5173",
                 port: int = 8000, timeout: int = 90) -> None:
    """Start uvicorn in a background process and wait until /api/health answers."""
    stop_server()
    env = {**os.environ, "API_KEY": api_key, "ALLOWED_ORIGINS": allowed_origins, "PORT": str(port)}
    log = open(LOG, "w")
    _state["proc"] = subprocess.Popen([sys.executable, "run_server.py"], cwd=HERE, env=env,
                                      stdout=log, stderr=subprocess.STDOUT)
    deadline = time.time() + timeout
    while time.time() < deadline:
        if _state["proc"].poll() is not None:
            raise RuntimeError("The server exited during start-up. Log:\n" + tail_log(40))
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/health", timeout=2) as r:
                info = json.load(r)
            if info.get("gpu_ready"):
                return
            if info.get("gpu_error"):
                raise RuntimeError("Server is up but the GPU is not ready: " + info["gpu_error"])
        except (OSError, ValueError):
            pass
        time.sleep(1.0)
    raise RuntimeError("The server did not become ready in time. Log:\n" + tail_log(40))


def tail_log(n: int = 30) -> str:
    try:
        with open(LOG) as f:
            return "".join(f.readlines()[-n:])
    except OSError:
        return "(no log yet)"


def start_ngrok(authtoken: str, port: int = 8000) -> str:
    """Open an HTTPS ngrok tunnel to the server and return its public URL."""
    from pyngrok import ngrok

    if not authtoken:
        raise RuntimeError("An ngrok auth token is required (free at https://dashboard.ngrok.com/get-started/your-authtoken).")
    for t in ngrok.get_tunnels():
        ngrok.disconnect(t.public_url)
    ngrok.set_auth_token(authtoken)
    tunnel = ngrok.connect(port, "http")
    _state["tunnel"] = tunnel
    return tunnel.public_url.replace("http://", "https://")


def start_cloudflared(port: int = 8000, timeout: int = 40) -> str:
    """Alternative tunnel that needs no account (Cloudflare 'quick tunnel')."""
    if not os.path.exists("/usr/local/bin/cloudflared"):
        subprocess.run(["bash", "-c",
                        "wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 "
                        "-O /usr/local/bin/cloudflared && chmod +x /usr/local/bin/cloudflared"], check=True)
    log_path = os.path.join(HERE, "cloudflared.log")
    proc = subprocess.Popen(["/usr/local/bin/cloudflared", "tunnel", "--url", f"http://127.0.0.1:{port}", "--no-autoupdate"],
                            stdout=open(log_path, "w"), stderr=subprocess.STDOUT)
    _state["cf"] = proc
    deadline = time.time() + timeout
    while time.time() < deadline:
        m = re.search(r"https://[a-z0-9-]+\.trycloudflare\.com", open(log_path).read())
        if m:
            return m.group(0)
        time.sleep(1)
    raise RuntimeError("cloudflared did not print a URL. Log:\n" + open(log_path).read()[-1500:])


def stop_tunnels() -> None:
    try:
        from pyngrok import ngrok
        ngrok.kill()
    except Exception:
        pass
    if _state.get("cf") and _state["cf"].poll() is None:
        _state["cf"].terminate()


def check_public(url: str, api_key: str) -> dict:
    """Call the server THROUGH the public URL, exactly like the browser will."""
    req = urllib.request.Request(url + "/api/gpu", headers={"X-API-Key": api_key, "ngrok-skip-browser-warning": "true"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.load(r)
