import { useRef, useState } from "react";
import { BarChart3, Square } from "lucide-react";
import { api } from "../api";
import { useApp } from "../store";
import { fmtInt, fmtMs, fmtSize, fmtX } from "../format";
import { Empty, Spinner } from "../components/ui";
import { SizeChart, SpeedupChart } from "../components/Charts";
import { CheckCircle2, XCircle } from "lucide-react";

const OPTIONS = [100_000, 1_000_000, 10_000_000, 50_000_000];

export function SweepTable({ sweep }) {
  const rows = [...sweep].sort((a, b) => a.size - b.size);
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Elements</th><th>CPU (4 ops)</th><th>GPU kernels</th><th>Transfer</th><th>GPU total</th><th>Kernel speed-up</th><th>Overall speed-up</th><th>Verified</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.size}>
              <td className="num">{fmtInt(r.size)}</td><td className="num">{fmtMs(r.cpu_ms)}</td><td className="num">{fmtMs(r.gpu_kernel_ms)}</td>
              <td className="num">{fmtMs(r.gpu_transfer_ms)}</td><td className="num">{fmtMs(r.gpu_total_ms)}</td>
              <td className={"num " + (r.kernel_speedup >= 1 ? "is-good" : "is-warn")}>{fmtX(r.kernel_speedup)}</td>
              <td className={"num " + (r.overall_speedup >= 1 ? "is-good" : "is-warn")}>{fmtX(r.overall_speedup)}</td>
              <td>{r.match ? <CheckCircle2 size={17} className="i-good" /> : <XCircle size={17} className="i-bad" />}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Benchmarks() {
  const { sweep, setSweep, call, online, busy, toast } = useApp();
  const [sizes, setSizes] = useState([100_000, 1_000_000, 10_000_000]);
  const [custom, setCustom] = useState("");
  const [progress, setProgress] = useState(null);
  const stop = useRef(false);

  const toggle = (n) => setSizes((s) => (s.includes(n) ? s.filter((x) => x !== n) : [...s, n].sort((a, b) => a - b)));
  const addCustom = () => {
    const n = Math.floor(Number(custom.replace(/[,_\s]/g, "")));
    if (Number.isFinite(n) && n >= 1) { setSizes((s) => [...new Set([...s, n])].sort((a, b) => a - b)); setCustom(""); }
    else toast("error", "Enter a whole number", "For example 25000000.");
  };

  const run = async () => {
    stop.current = false;
    setSweep([]);
    const out = [];
    for (let i = 0; i < sizes.length; i++) {
      if (stop.current) break;
      setProgress({ i, total: sizes.length, size: sizes[i] });
      try {
        const r = await call("benchmark", (s) => api.benchmark(s, { size: sizes[i], operation: "all", repeats: 3, seed: 42 }));
        out.push({ size: sizes[i], ...r.summary, match: r.all_match, rows: r.rows });
        setSweep([...out]);
      } catch { break; }
    }
    setProgress(null);
    if (out.length) toast("ok", "Size sweep finished", `${out.length} of ${sizes.length} sizes measured.`);
  };

  const running = !!progress;
  const rowsForSpeedup = sweep.map((r) => ({ label: fmtSize(r.size), kernel_speedup: r.kernel_speedup, overall_speedup: r.overall_speedup }));
  return (
    <>
      <div className="page-head"><div><h1>Size benchmark</h1><p>Runs all four operations on fresh random datasets of different lengths, so you can see where the GPU starts to pay off.</p></div></div>
      <div className="stack">
        <section className="panel">
          <div className="panel-head"><div><h2>Dataset sizes to test</h2><p className="sub">Each size is generated on the Colab machine, measured with 3 timed repeats, then discarded. The 50M size takes a few seconds.</p></div></div>
          <div className="row" style={{ gap: 8 }}>
            {[...new Set([...OPTIONS, ...sizes])].sort((a, b) => a - b).map((n) => (
              <button key={n} className="btn btn-sm chip" aria-pressed={sizes.includes(n)} onClick={() => toggle(n)}>{fmtSize(n)}</button>
            ))}
            <input className="input mono" style={{ width: 150 }} placeholder="custom size" value={custom} onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCustom()} aria-label="Custom dataset size" />
            <button className="btn btn-sm" onClick={addCustom}>Add</button>
          </div>
          <div className="row" style={{ marginTop: 18 }}>
            <button className="btn btn-primary" disabled={!online || running || !sizes.length || (!!busy && !running)} onClick={run}>
              {running ? <Spinner /> : <BarChart3 size={16} />} {running ? `Measuring ${fmtSize(progress.size)} (${progress.i + 1}/${progress.total})…` : "Run size sweep"}
            </button>
            {running && <button className="btn" onClick={() => { stop.current = true; }}><Square size={14} /> Stop after this size</button>}
          </div>
        </section>
        {sweep.length === 0 ? <section className="panel"><Empty title="No sweep yet">Run the sweep to compare CPU, GPU kernel and GPU total time across dataset sizes.</Empty></section> : (
          <>
            <div className="grid g2">
              <section className="panel"><div className="panel-head"><div><h2>Execution time vs dataset size</h2><p className="sub">All four operations combined. Both axes are logarithmic.</p></div></div><SizeChart sweep={sweep} /></section>
              <section className="panel"><div className="panel-head"><div><h2>Transfer time vs kernel time</h2><p className="sub">Copying data grows with size just like the kernels do — and is usually the larger part.</p></div></div><SizeChart sweep={sweep} metric="transfer" /></section>
            </div>
            <section className="panel"><div className="panel-head"><div><h2>GPU speed-up by dataset size</h2><p className="sub">Below the dashed line, the CPU is faster.</p></div></div><SpeedupChart rows={rowsForSpeedup} /></section>
            <section className="panel"><div className="panel-head"><div><h2>Measurements</h2></div></div><SweepTable sweep={sweep} /></section>
          </>
        )}
      </div>
    </>
  );
}
