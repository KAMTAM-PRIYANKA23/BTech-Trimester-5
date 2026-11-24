// Thin client for the FastAPI backend running in Google Colab (behind an ngrok tunnel).

const LS = "reductionlab.settings.v1";

export function loadSettings() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(LS) || "{}"); } catch { /* storage blocked */ }
  return {
    baseUrl: saved.baseUrl ?? import.meta.env.VITE_API_URL ?? "",
    apiKey: saved.apiKey ?? import.meta.env.VITE_API_KEY ?? "",
  };
}
export function saveSettings(s) {
  try { localStorage.setItem(LS, JSON.stringify(s)); } catch { /* ignore */ }
}
export function cleanUrl(u) {
  return (u || "").trim().replace(/\/+$/, "").replace(/\/api$/, "");
}

/** kind: network | auth | tunnel | api | timeout | config */
export class ApiFailure extends Error {
  constructor(kind, message, hint = "", status = 0, code = "") {
    super(message);
    Object.assign(this, { kind, hint, status, code });
  }
}

export async function request(settings, path, { method = "GET", body, form, timeoutMs = 600000, auth = true } = {}) {
  const base = cleanUrl(settings.baseUrl);
  if (!base) throw new ApiFailure("config", "No backend URL set.", "Open Settings and paste the ngrok URL from Colab.");
  const headers = { "ngrok-skip-browser-warning": "true" };
  if (auth && settings.apiKey) headers["X-API-Key"] = settings.apiKey;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers["Content-Type"] = "application/json"; payload = JSON.stringify(body); }

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(base + path, { method, headers, body: payload, signal: ctl.signal });
  } catch (e) {
    clearTimeout(timer);
    if (e.name === "AbortError")
      throw new ApiFailure("timeout", "The backend took too long to answer.", "Try a smaller dataset or fewer repeats.");
    throw new ApiFailure("network", "Cannot reach the Colab backend.",
      "Colab may have disconnected, the notebook cell may have stopped, or the ngrok URL changed. " +
      "Re-run the 'Start server + tunnel' cell and paste the new URL in Settings.");
  }
  clearTimeout(timer);
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
  if (!res.ok) {
    if (data?.error) {
      const kind = res.status === 401 ? "auth" : "api";
      throw new ApiFailure(kind, data.error.message, data.error.hint, res.status, data.error.code);
    }
    if (data?.detail) {
      const d = Array.isArray(data.detail) ? data.detail.map((x) => x.msg).join("; ") : String(data.detail);
      throw new ApiFailure("api", d, "", res.status, "validation");
    }
    throw new ApiFailure("tunnel", `The tunnel answered with HTTP ${res.status} instead of the API.`,
      "The ngrok URL is probably expired or the server stopped. Restart the Colab server cell and update the URL.", res.status);
  }
  if (data === null) throw new ApiFailure("tunnel", "The tunnel returned a page that is not the API.",
    "Check that the URL is the ngrok address of the running Colab server.", res.status);
  return data;
}

export const api = {
  health: (s) => request(s, "/api/health", { auth: false, timeoutMs: 8000 }),
  gpu: (s) => request(s, "/api/gpu", { timeoutMs: 15000 }),
  kernels: (s) => request(s, "/api/kernels", { timeoutMs: 15000 }),
  selftest: (s) => request(s, "/api/selftest", { method: "POST", timeoutMs: 60000 }),
  presets: (s) => request(s, "/api/presets", { timeoutMs: 15000 }),
  datasets: (s) => request(s, "/api/datasets", { timeoutMs: 15000 }),
  loadPreset: (s, preset) => request(s, "/api/datasets/preset", { method: "POST", body: { preset } }),
  generate: (s, body) => request(s, "/api/datasets/generate", { method: "POST", body }),
  upload: (s, file, column, onInvalid) => {
    const form = new FormData();
    form.append("file", file);
    form.append("column", column || "");
    form.append("on_invalid", onInvalid);
    return request(s, "/api/datasets/upload", { method: "POST", form });
  },
  remove: (s, id) => request(s, `/api/datasets/${id}`, { method: "DELETE", timeoutMs: 15000 }),
  compute: (s, body) => request(s, "/api/compute", { method: "POST", body }),
  benchmark: (s, body) => request(s, "/api/benchmark", { method: "POST", body }),
};
