import { ArrowRight } from "lucide-react";
import { useApp } from "../store";
import { Pipeline, Stat } from "../components/ui";
import { fmtInt, fmtMs, fmtX, fmtSize } from "../format";
import { COLORS, CpuVsGpuChart, SizeChart } from "../components/Charts";

export default function Dashboard({ go }) {
  const { online, gpu, selected, result, sweep, history } = useApp();
  const s = result?.summary;
  return (
    <>
      <div className="page-head">
        <div><h1>Reduction Lab</h1><p>Parallel sum, average, minimum and maximum on a Tesla T4, measured against the CPU — with transfer time counted honestly.</p></div>
        <button className="btn btn-primary" onClick={() => go(online ? (selected ? "run" : "datasets") : "settings")}>
          {!online ? "Connect to Colab" : selected ? "Run an operation" : "Pick a dataset"} <ArrowRight size={16} />
        </button>
      </div>
      <div className="stack">
        <section className="panel" style={{ paddingBottom: 14 }}>
          <div className="panel-head"><div><h2>Request path</h2><p className="sub">Every computation travels this route. Each stop lights up only when it has actually answered.</p></div></div>
          <Pipeline />
        </section>

        <div className="grid g4">
          <Stat label="GPU" value={online ? (gpu?.name ?? "–") : "Not connected"} note={online && gpu?.memory_total_bytes ? `${(gpu.memory_total_bytes / 2 ** 30).toFixed(1)} GB · compute ${gpu.compute_capability}` : "Open Connection to link Colab"} />
          <Stat label="Selected dataset" value={selected ? fmtSize(selected.size) : "None"} unit={selected ? "values" : ""} note={selected ? selected.label || selected.name : "Choose one on the Datasets page"} />
          <Stat swatch={COLORS.kernel} label="Last run · kernel speed-up" value={s ? fmtX(s.kernel_speedup) : "–"} note={s ? `${fmtMs(s.cpu_ms)} CPU vs ${fmtMs(s.gpu_kernel_ms)} kernel` : "No run yet"} />
          <Stat swatch={COLORS.transfer} label="Last run · including transfer" value={s ? fmtX(s.overall_speedup) : "–"} note={s ? (s.gpu_faster_overall ? "GPU finished first" : "CPU finished first") : "No run yet"} />
        </div>

        {result ? (
          <div className="grid g2">
            <section className="panel"><div className="panel-head"><div><h2>Latest run</h2><p className="sub">{fmtInt(result.dataset.size)} values · {result.all_match ? "verified against the CPU" : "MISMATCH with the CPU"}</p></div><button className="btn btn-sm" onClick={() => go("run")}>Details</button></div><CpuVsGpuChart rows={result.rows} /></section>
            <section className="panel"><div className="panel-head"><div><h2>Across dataset sizes</h2><p className="sub">{sweep.length ? "From your last size sweep." : "Run the size sweep to fill this in."}</p></div><button className="btn btn-sm" onClick={() => go("bench")}>{sweep.length ? "Open" : "Run sweep"}</button></div>
              {sweep.length ? <SizeChart sweep={sweep} /> : <div className="empty">Nothing measured yet.</div>}</section>
          </div>
        ) : (
          <section className="panel">
            <h2>How to use this dashboard</h2>
            <ol className="small" style={{ color: "var(--text-2)", paddingLeft: 20, display: "grid", gap: 6, marginTop: 10, maxWidth: "70ch" }}>
              <li>Start the Colab notebook and paste its URL and API key under <button className="btn btn-sm btn-ghost" onClick={() => go("settings")}>Connection</button>.</li>
              <li>Load a sample, generate a dataset or upload a CSV on <button className="btn btn-sm btn-ghost" onClick={() => go("datasets")}>Datasets</button>.</li>
              <li>Choose an operation and run it on <button className="btn btn-sm btn-ghost" onClick={() => go("run")}>Run</button>.</li>
              <li>Compare sizes on <button className="btn btn-sm btn-ghost" onClick={() => go("bench")}>Benchmarks</button>.</li>
            </ol>
          </section>
        )}
        {history.length > 1 && <p className="hint">{history.length} runs this session.</p>}
      </div>
    </>
  );
}
