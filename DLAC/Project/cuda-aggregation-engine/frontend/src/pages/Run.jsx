import { Play } from "lucide-react";
import { useApp } from "../store";
import { OPS, fmtBytes, fmtInt } from "../format";
import { Empty, Spinner } from "../components/ui";
import { CpuVsGpuChart, SpeedupChart, TransferChart } from "../components/Charts";
import { Correctness, ResultCards, ResultsTable, TimingCards, Verdict } from "../components/Results";

export function ResultsView({ result }) {
  return (
    <div className="stack">
      <Verdict result={result} />
      <ResultCards result={result} />
      <TimingCards result={result} />
      <Correctness result={result} />
      <div className="grid g2">
        <section className="panel"><div className="panel-head"><div><h2>CPU vs GPU execution time</h2><p className="sub">The GPU bar is split so you can see how much is kernel and how much is moving data.</p></div></div><CpuVsGpuChart rows={result.rows} /></section>
        <section className="panel"><div className="panel-head"><div><h2>Where GPU time goes</h2><p className="sub">Share of total GPU time spent on transfer, kernel and readback.</p></div></div><TransferChart rows={result.rows} /></section>
      </div>
      <section className="panel"><div className="panel-head"><div><h2>GPU speed-up</h2><p className="sub">Speed-up above the dashed line means the GPU is faster than NumPy.</p></div></div><SpeedupChart rows={result.rows} /></section>
      <section className="panel"><div className="panel-head"><div><h2>Full measurements</h2><p className="sub">Each time is the mean of {result.repeats} timed runs after one warm-up. “GPU total” counts the transfer in full for every row.</p></div></div><ResultsTable result={result} /></section>
      <section className="panel">
        <div className="panel-head"><div><h2>CUDA launch configuration</h2><p className="sub">Chosen automatically from the dataset length. These are the arguments passed to your kernels.</p></div></div>
        <dl className="kv">
          <dt>Elements (n)</dt><dd>{fmtInt(result.launch.elements)}</dd>
          <dt>Blocks (grid)</dt><dd>{result.launch.blocks}</dd>
          <dt>Threads per block</dt><dd>{result.launch.threads_per_block}</dd>
          <dt>Partial-results array</dt><dd>{result.launch.partials_length} floats (one per block)</dd>
          <dt>Elements per thread</dt><dd>{result.launch.elements_per_thread} (grid-stride loop)</dd>
          <dt>Final kernel</dt><dd>1 block × 256 threads, n = {result.launch.blocks}</dd>
          <dt>GPU</dt><dd>{result.gpu?.name}</dd>
        </dl>
        <p className="small muted" style={{ marginTop: 14 }}>Kernel launches recorded for this request:</p>
        <div className="table-wrap" style={{ marginTop: 8, maxHeight: 220, overflow: "auto" }}>
          <table><thead><tr><th>#</th><th>Kernel</th><th>Blocks</th><th>Threads</th></tr></thead>
            <tbody>{result.kernel_launches.map((k, i) => <tr key={i}><td>{i + 1}</td><td className="num">{k.kernel}</td><td className="num">{k.blocks}</td><td className="num">{k.threads}</td></tr>)}</tbody></table>
        </div>
      </section>
    </div>
  );
}

export default function Run({ go }) {
  const { selected, operation, setOperation, repeats, setRepeats, runCompute, busy, online, result } = useApp();
  const running = busy === "compute";
  return (
    <>
      <div className="page-head"><div><h1>Run an operation</h1><p>Runs NumPy on the Colab CPU and your CUDA kernels on the T4 against the same data, then checks that they agree.</p></div></div>
      <div className="stack">
        <section className="panel">
          <div className="panel-head">
            <div><h2>1. Dataset</h2>
              {selected ? <p className="sub"><b style={{ color: "var(--text)" }}>{selected.label || selected.name}</b> · {fmtInt(selected.size)} values · {fmtBytes(selected.bytes)}</p> : <p className="sub">No dataset selected.</p>}</div>
            <button className="btn btn-sm" onClick={() => go("datasets")}>{selected ? "Change dataset" : "Choose a dataset"}</button>
          </div>
          <div className="panel-head" style={{ marginTop: 6 }}><div><h2>2. Operation</h2></div></div>
          <div className="choice-grid">
            {OPS.map((o) => (
              <button key={o.key} className="choice" aria-pressed={operation === o.key} onClick={() => setOperation(o.key)}>
                <div className="t"><span>{o.label}</span><span className="glyph" aria-hidden>{o.symbol}</span></div>
                <div className="d">{o.blurb}</div>
              </button>
            ))}
          </div>
          <div className="row" style={{ marginTop: 20, justifyContent: "space-between" }}>
            <div className="row">
              <span className="small muted">Timed repeats</span>
              <div className="seg" role="group" aria-label="Timed repeats">
                {[1, 3, 5, 10].map((n) => <button key={n} aria-pressed={repeats === n} onClick={() => setRepeats(n)}>{n}</button>)}
              </div>
            </div>
            <button className="btn btn-primary" disabled={!online || !selected || !!busy} onClick={() => runCompute().catch(() => {})}>
              {running ? <Spinner /> : <Play size={16} />} {running ? "Running on the T4…" : "Run on CPU and GPU"}
            </button>
          </div>
        </section>
        {result ? <ResultsView result={result} /> : (
          <section className="panel"><Empty title="No results yet">Choose a dataset and an operation, then run. Results, charts and the correctness check appear here.</Empty></section>
        )}
      </div>
    </>
  );
}
