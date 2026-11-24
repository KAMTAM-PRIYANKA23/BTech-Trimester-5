import { CheckCircle2, XCircle, AlertTriangle, Info, X, Cpu, Laptop, Cloud, Server, Zap, Loader2, Sun, Moon } from "lucide-react";
import { useApp } from "../store";
import { useTheme } from "../theme";

export function Spinner({ size = 16 }) { return <Loader2 size={size} className="spin" aria-hidden />; }

export function StatusPill() {
  const { conn, gpu } = useApp();
  const map = {
    online: ["ok", gpu?.name ? `Connected · ${gpu.name}` : "Connected"],
    checking: ["warn", "Connecting…"],
    unconfigured: ["warn", "No backend URL"],
    offline: ["bad", "Backend unreachable"],
    auth_error: ["bad", "API key rejected"],
    gpu_error: ["bad", "GPU not ready"],
  };
  const [cls, text] = map[conn.status] || map.offline;
  return <span className={`pill ${cls}`} role="status"><i className="dot" />{text}</span>;
}

export function ConnectionBanner({ onSettings }) {
  const { conn, checkNow } = useApp();
  if (conn.status === "online" || conn.status === "checking") return null;
  const e = conn.error;
  const copy = {
    unconfigured: ["Connect to your Colab backend", "Paste the ngrok URL and API key printed by the notebook. Nothing runs until the backend is connected."],
    offline: ["The Colab backend is not reachable", e?.hint || "The Colab session may have disconnected, or the ngrok URL changed after a restart."],
    auth_error: ["The backend rejected the API key", "Copy the API key printed by the Colab notebook into Settings (it changes every time the notebook restarts)."],
    gpu_error: ["The backend is running, but the GPU is not ready", e?.message || "Check the Colab runtime type is set to T4 GPU."],
  }[conn.status];
  return (
    <div className={`banner ${conn.status === "unconfigured" ? "warn" : "bad"}`} role="alert">
      <AlertTriangle size={20} style={{ flex: "none", marginTop: 2 }} />
      <div style={{ flex: 1 }}>
        <b>{copy[0]}</b>
        <div className="small">{copy[1]}</div>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn btn-sm" onClick={onSettings}>Open settings</button>
          {conn.status !== "unconfigured" && <button className="btn btn-sm btn-ghost" onClick={checkNow}>Retry now</button>}
        </div>
      </div>
    </div>
  );
}

export function SimulatorBanner() {
  const { gpu } = useApp();
  if (!gpu?.simulator) return null;
  return (
    <div className="banner bad" role="alert">
      <XCircle size={20} style={{ flex: "none" }} />
      <div><b>CUDA simulator — not a real GPU</b>
        <div className="small">Numba is emulating CUDA on the CPU. Timings are meaningless. Run the backend in Colab with a T4 runtime.</div></div>
    </div>
  );
}

export function Toasts() {
  const { toasts, dismissToast } = useApp();
  const icon = { ok: <CheckCircle2 size={18} className="i-good" />, error: <XCircle size={18} className="i-bad" />, info: <Info size={18} className="i-info" /> };
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          {icon[t.kind]}
          <div><b>{t.title}</b>{t.body && <p>{t.body}</p>}</div>
          <button aria-label="Dismiss" onClick={() => dismissToast(t.id)}><X size={15} /></button>
        </div>
      ))}
    </div>
  );
}

/** The signature element: the real request path, lit by live connection state. */
export function Pipeline() {
  const { conn, gpu, settings, busy } = useApp();
  const online = conn.status === "online";
  const reachable = conn.status !== "offline" && conn.status !== "unconfigured" && conn.status !== "checking";
  let host = "";
  try { host = new URL(settings.baseUrl).host; } catch { /* unset */ }
  const nodes = [
    { icon: <Laptop size={21} />, title: "React dashboard", sub: "Your Windows laptop", state: "on" },
    { icon: <Cloud size={21} />, title: "ngrok tunnel", sub: host || "not configured", state: reachable ? "on" : conn.status === "unconfigured" ? "idle" : "off" },
    { icon: <Server size={21} />, title: "FastAPI", sub: online ? `up ${Math.round(conn.health?.uptime_s ?? 0)}s` : "in Colab", state: online ? "on" : reachable ? "on" : "idle" },
    { icon: <Zap size={21} />, title: "Numba CUDA kernels", sub: online ? "6 kernels compiled" : "notebook code", state: online ? "on" : "idle" },
    { icon: <Cpu size={21} />, title: gpu?.name ? gpu.name.replace("Tesla ", "Tesla ") : "Tesla T4", sub: gpu?.memory_total_bytes ? `${(gpu.memory_total_bytes / 2 ** 30).toFixed(1)} GB` : "GPU", state: online ? "on" : "idle" },
  ];
  return (
    <div className={`pipeline ${busy ? "flowing" : ""}`} aria-label="Request path from browser to GPU">
      {nodes.map((n) => (
        <div key={n.title} className={`node ${n.state}`}>
          <div className="icon">{n.icon}</div>
          <div><b>{n.title}</b><span>{n.sub}</span></div>
        </div>
      ))}
    </div>
  );
}

export function Stat({ label, value, unit, note, swatch }) {
  return (
    <div className="stat">
      <div className="k">{swatch && <i className="swatch" style={{ background: swatch }} />}{label}</div>
      <div className="v">{value}{unit && <small>{unit}</small>}</div>
      {note && <div className="n">{note}</div>}
    </div>
  );
}

export function Empty({ title, children, action }) {
  return <div className="empty"><h3>{title}</h3><p>{children}</p>{action && <div style={{ marginTop: 14 }}>{action}</div>}</div>;
}

/** Light / dark switch. Both options are always visible; the active one is highlighted. */
export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";
  return (
    <button type="button" className="theme-toggle" role="switch" aria-checked={!dark}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"} title={dark ? "Switch to light theme" : "Switch to dark theme"} onClick={toggle}>
      <span className={`opt ${!dark ? "on" : ""}`}><Sun size={15} aria-hidden /><span>Light</span></span>
      <span className={`opt ${dark ? "on" : ""}`}><Moon size={15} aria-hidden /><span>Dark</span></span>
    </button>
  );
}
