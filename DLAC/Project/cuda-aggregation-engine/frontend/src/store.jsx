import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, loadSettings, saveSettings, ApiFailure } from "./api";

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

export function AppProvider({ children }) {
  const [settings, setSettingsState] = useState(loadSettings);
  const [conn, setConn] = useState({ status: settings.baseUrl ? "checking" : "unconfigured", error: null, health: null });
  const [gpu, setGpu] = useState(null);
  const [datasets, setDatasets] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [operation, setOperation] = useState("all");
  const [repeats, setRepeats] = useState(5);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [sweep, setSweep] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [busy, setBusy] = useState(null); // label of the request in flight (drives the pipeline animation)
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const toast = useCallback((kind, title, body) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t.slice(-3), { id, kind, title, body }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 9000 : 4500);
  }, []);

  const setSettings = useCallback((s) => {
    const next = { baseUrl: s.baseUrl.trim(), apiKey: s.apiKey.trim() };
    saveSettings(next);
    setSettingsState(next);
    setConn({ status: next.baseUrl ? "checking" : "unconfigured", error: null, health: null });
    setGpu(null);
  }, []);

  // ---- connection monitor: health every 8 s; GPU info when the key works --------------
  const checkNow = useCallback(async () => {
    const s = settingsRef.current;
    if (!s.baseUrl) { setConn({ status: "unconfigured", error: null, health: null }); return; }
    try {
      const health = await api.health(s);
      try {
        const g = await api.gpu(s);
        setGpu(g);
        setConn({ status: health.gpu_ready ? "online" : "gpu_error", error: health.gpu_error ? new ApiFailure("api", health.gpu_error) : null, health });
      } catch (e) {
        setConn({ status: e.kind === "auth" ? "auth_error" : "offline", error: e, health });
      }
    } catch (e) {
      setConn({ status: "offline", error: e, health: null });
    }
  }, []);

  useEffect(() => {
    checkNow();
    const t = setInterval(checkNow, 8000);
    return () => clearInterval(t);
  }, [settings, checkNow]);

  const refreshDatasets = useCallback(async () => {
    try {
      const { datasets: list } = await api.datasets(settingsRef.current);
      setDatasets(list);
      setSelectedId((id) => (list.some((d) => d.id === id) ? id : list[0]?.id ?? null));
    } catch { /* connection banner already explains */ }
  }, []);

  const online = conn.status === "online";
  useEffect(() => { if (online) refreshDatasets(); }, [online, refreshDatasets]);

  // ---- wrapper that tracks "in flight" + turns failures into toasts ------------------
  const call = useCallback(async (label, fn, { silent = false } = {}) => {
    setBusy(label);
    try {
      return await fn(settingsRef.current);
    } catch (e) {
      if (e instanceof ApiFailure) {
        if (e.kind === "network" || e.kind === "tunnel") checkNow();
        if (e.code === "dataset_not_found") refreshDatasets();
        if (!silent) toast("error", e.message, e.hint);
      } else if (!silent) toast("error", "Unexpected error", String(e));
      throw e;
    } finally {
      setBusy(null);
    }
  }, [toast, checkNow, refreshDatasets]);

  const addDataset = useCallback((ds, evicted = []) => {
    setDatasets((l) => [ds, ...l.filter((x) => x.id !== ds.id)].slice(0, 12));
    setSelectedId(ds.id);
    if (evicted.length) toast("info", "Older dataset removed", `Freed memory by removing: ${evicted.join(", ")}.`);
  }, [toast]);

  const runCompute = useCallback(async () => {
    const ds = datasets.find((d) => d.id === selectedId);
    if (!ds) { toast("error", "Choose a dataset first", "Pick one on the Datasets page."); return null; }
    const r = await call("compute", (s) => api.compute(s, { dataset_id: ds.id, operation, repeats }));
    setResult(r);
    setHistory((h) => [{ at: Date.now(), ...r }, ...h].slice(0, 40));
    toast(r.all_match ? "ok" : "error",
      r.all_match ? "Results verified" : "CPU and GPU results differ",
      r.all_match ? "Every GPU result matched the CPU result." : "See the correctness panel for details.");
    return r;
  }, [datasets, selectedId, operation, repeats, call, toast]);

  const value = useMemo(() => ({
    settings, setSettings, conn, gpu, checkNow, datasets, selectedId, setSelectedId,
    selected: datasets.find((d) => d.id === selectedId) || null,
    operation, setOperation, repeats, setRepeats, result, setResult, history, sweep, setSweep,
    toasts, toast, dismissToast: (id) => setToasts((t) => t.filter((x) => x.id !== id)),
    busy, call, addDataset, refreshDatasets, runCompute, online,
    removeDataset: async (id) => {
      await call("delete", (s) => api.remove(s, id));
      setDatasets((l) => l.filter((d) => d.id !== id));
      setSelectedId((cur) => (cur === id ? null : cur));
    },
  }), [settings, setSettings, conn, gpu, checkNow, datasets, selectedId, operation, repeats, result, history, sweep, toasts, toast, busy, call, addDataset, refreshDatasets, runCompute, online]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
