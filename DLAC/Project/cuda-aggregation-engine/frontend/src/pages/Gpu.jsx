import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, XCircle, ShieldCheck, RefreshCw } from "lucide-react";
import { api } from "../api";
import { useApp } from "../store";
import { fmtBytes, fmtInt } from "../format";
import { Empty, Spinner, Stat } from "../components/ui";

export default function Gpu() {
  const { gpu, online, call, checkNow } = useApp();
  const [kernels, setKernels] = useState(null);
  const [test, setTest] = useState(null);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    try { setKernels(await call("kernels", (s) => api.kernels(s), { silent: true })); } catch { /* banner explains */ }
  }, [call]);
  useEffect(() => { if (online) load(); }, [online, load]);

  const selftest = async () => {
    setRunning(true);
    try { setTest(await call("selftest", (s) => api.selftest(s))); await load(); checkNow(); } catch { /* toast */ } finally { setRunning(false); }
  };

  if (!online || !gpu) return <><div className="page-head"><div><h1>GPU and kernels</h1></div></div><section className="panel"><Empty title="Not connected">Connect to the Colab backend to see the GPU and the CUDA kernels it is running.</Empty></section></>;
  const smi = gpu.smi;
  const memUsed = gpu.memory_total_bytes ? (1 - gpu.memory_free_bytes / gpu.memory_total_bytes) * 100 : 0;

  return (
    <>
      <div className="page-head">
        <div><h1>GPU and kernels</h1><p>Proof that your notebook's kernels run on the Tesla T4: the device name, live driver readings and the launch counter for each kernel.</p></div>
        <button className="btn" onClick={() => { checkNow(); load(); }}><RefreshCw size={15} /> Refresh</button>
      </div>
      <div className="stack">
        <div className="grid g4">
          <Stat label="GPU" value={gpu.name} note={gpu.is_t4 ? "Tesla T4 confirmed" : "Not a T4"} />
          <Stat label="Compute capability" value={gpu.compute_capability ?? "–"} note={`${gpu.multiprocessors ?? "–"} multiprocessors`} />
          <Stat label="GPU memory" value={fmtBytes(gpu.memory_total_bytes)} note={`${fmtBytes(gpu.memory_free_bytes)} free`} />
          <Stat label="Kernel launches" value={fmtInt(kernels?.total_launches ?? 0)} note="Since the server started" />
        </div>

        <div className="grid g2">
          <section className="panel">
            <div className="panel-head"><div><h2>Device details</h2></div></div>
            <dl className="kv">
              <dt>Device name</dt><dd>{gpu.name}</dd>
              <dt>Numba</dt><dd>{gpu.numba_version}</dd>
              <dt>CUDA driver API</dt><dd>{gpu.cuda_driver_version ?? "–"}</dd>
              <dt>Warp size</dt><dd>{gpu.warp_size}</dd>
              <dt>Max threads / block</dt><dd>{gpu.max_threads_per_block}</dd>
              <dt>Launch config</dt><dd>{gpu.launch_config.threads_per_block} threads × up to {gpu.launch_config.max_blocks} blocks</dd>
              <dt>Host RAM free</dt><dd>{fmtBytes(gpu.host_ram_free_bytes)} of {fmtBytes(gpu.host_ram_total_bytes)}</dd>
              <dt>Largest dataset</dt><dd>{fmtInt(gpu.limits.max_elements)} elements</dd>
            </dl>
            <div style={{ marginTop: 16 }}><div className="small muted" style={{ marginBottom: 6 }}>GPU memory in use by this process: {memUsed.toFixed(1)}%</div><div className="bar"><i style={{ width: `${memUsed}%` }} /></div></div>
          </section>
          <section className="panel">
            <div className="panel-head"><div><h2>Live reading from nvidia-smi</h2><p className="sub">Read from the driver on the Colab machine, independent of Python. Run a large operation, then refresh to see memory used rise.</p></div></div>
            {smi ? (
              <dl className="kv">
                <dt>Name</dt><dd>{smi.name}</dd><dt>Driver</dt><dd>{smi.driver}</dd>
                <dt>Utilisation</dt><dd>{smi.utilization_pct}%</dd>
                <dt>Memory used</dt><dd>{smi.memory_used_mib} / {smi.memory_total_mib} MiB</dd>
                <dt>Temperature</dt><dd>{smi.temperature_c} °C</dd><dt>Power</dt><dd>{smi.power_w} W</dd>
              </dl>
            ) : <p className="muted small">nvidia-smi is not available to the backend.</p>}
          </section>
        </div>

        <section className="panel">
          <div className="panel-head">
            <div><h2>Known-answer GPU test</h2><p className="sub">Sums, mins and maxes the numbers 1…100,000 on the GPU and compares with the closed-form answer (5,000,050,000 / 1 / 100,000). No CPU library is involved in the expected values.</p></div>
            <button className="btn btn-primary" disabled={running} onClick={selftest}>{running ? <Spinner /> : <ShieldCheck size={16} />} Run GPU self-test</button>
          </div>
          {test && (
            <div className="table-wrap"><table>
              <thead><tr><th>Operation</th><th>Expected</th><th>GPU returned</th><th>Result</th></tr></thead>
              <tbody>{test.checks.map((c) => <tr key={c.op}><td>{c.op}</td><td className="num">{fmtInt(c.expected)}</td><td className="num">{fmtInt(c.gpu)}</td><td>{c.pass ? <CheckCircle2 size={17} className="i-good" /> : <XCircle size={17} className="i-bad" />}</td></tr>)}</tbody>
            </table></div>
          )}
        </section>

        <section className="panel">
          <div className="panel-head"><div><h2>Your CUDA kernels</h2><p className="sub">Source shown here is read from the running server with Python's inspect module. The hash lets you compare it with the notebook.</p></div></div>
          <div className="stack" style={{ gap: 10 }}>
            {(kernels?.kernels ?? []).map((k) => (
              <details className="k" key={k.name}>
                <summary>
                  <span><b className="mono">{k.name}</b> <span className="muted small">· {k.role}</span></span>
                  <span className="row" style={{ gap: 8 }}>
                    <span className="pill">{fmtInt(k.launches)} launches</span>
                    <span className="pill mono">{k.sha256}</span>
                  </span>
                </summary>
                <div className="body">
                  <p className="small muted" style={{ marginBottom: 8 }}>{k.defined_in}{k.compiled_signatures.length ? ` · compiled for ${k.compiled_signatures.length} signature(s)` : ""}</p>
                  <pre className="code">{k.source}</pre>
                </div>
              </details>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
