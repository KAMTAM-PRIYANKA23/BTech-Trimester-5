import { useRef, useState } from "react";
import { CheckCircle2, AlertTriangle, Trash2, Upload, Wand2, Database } from "lucide-react";
import { api } from "../api";
import { useApp } from "../store";
import { PRESET_COPY, fmtBytes, fmtInt, fmtSize } from "../format";
import { Empty, Spinner } from "../components/ui";

const PRESETS = [
  { key: "small", size: 100_000 }, { key: "medium", size: 1_000_000 },
  { key: "large", size: 10_000_000 }, { key: "xlarge", size: 50_000_000 },
];

export function UploadReport({ report, evicted }) {
  if (!report) return null;
  const bad = report.rows_rejected > 0;
  return (
    <div className={`banner ${bad ? "warn" : ""}`} style={{ marginBottom: 0 }}>
      {bad ? <AlertTriangle size={20} className="i-warn" style={{ flex: "none" }} /> : <CheckCircle2 size={20} className="i-good" style={{ flex: "none" }} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <b>{report.filename}: {fmtInt(report.values_accepted)} values accepted from {fmtInt(report.rows_read)} rows</b>
        <div className="small">
          Column “{report.column_used}”{report.header_detected ? " (header row detected)" : " (no header row)"}, delimiter “{report.delimiter === "\t" ? "tab" : report.delimiter}”.
          {report.columns_found?.length > 1 && <> Other columns in this file: {report.columns_found.filter((c) => c !== report.column_used).join(", ")} — type a name in “Column” to use one instead.</>}
          {bad && <> <b>{fmtInt(report.rows_rejected)} rows were {report.policy === "skip" ? "skipped" : "rejected"}</b>: {fmtInt(report.missing)} missing, {fmtInt(report.non_numeric)} not a number, {fmtInt(report.out_of_range)} outside float32 range.</>}
        </div>
        {report.examples?.length > 0 && (
          <div className="table-wrap" style={{ marginTop: 10, maxWidth: 520 }}>
            <table><thead><tr><th>Data row</th><th>Value</th><th>Why it was not used</th></tr></thead>
              <tbody>{report.examples.map((e, i) => <tr key={i}><td>{e.row}</td><td className="num">{e.value || "(empty)"}</td><td style={{ textAlign: "left" }}>{e.reason}</td></tr>)}</tbody></table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Datasets({ go }) {
  const { datasets, selectedId, setSelectedId, call, addDataset, removeDataset, online, busy, toast } = useApp();
  const [loading, setLoading] = useState(null);
  const [size, setSize] = useState("2000000");
  const [dist, setDist] = useState("integers");
  const [seed, setSeed] = useState("");
  const [gname, setGname] = useState("");
  const [file, setFile] = useState(null);
  const [column, setColumn] = useState("");
  const [policy, setPolicy] = useState("skip");
  const [over, setOver] = useState(false);
  const [report, setReport] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const input = useRef(null);

  const loadPreset = async (key) => {
    setLoading(key);
    try {
      const r = await call("dataset", (s) => api.loadPreset(s, key));
      addDataset({ ...r.dataset, label: PRESET_COPY[key].title }, r.evicted);
      toast("ok", `${PRESET_COPY[key].title} dataset ready`, `${fmtInt(r.dataset.size)} values${r.reused ? " (already on the backend)" : " generated on the Colab machine"}.`);
    } catch { /* toast shown */ } finally { setLoading(null); }
  };

  const generate = async (e) => {
    e.preventDefault();
    const n = Math.floor(Number(String(size).replace(/[,_\s]/g, "")));
    if (!Number.isFinite(n) || n < 1) { toast("error", "Enter a whole number of elements", "For example 2000000."); return; }
    setLoading("custom");
    try {
      const r = await call("dataset", (s) => api.generate(s, { size: n, distribution: dist, seed: seed === "" ? null : Number(seed), name: gname || null }));
      addDataset(r.dataset, r.evicted);
      toast("ok", "Dataset generated", `${fmtInt(r.dataset.size)} random values (${dist}).`);
    } catch { /* toast shown */ } finally { setLoading(null); }
  };

  const upload = async () => {
    if (!file) return;
    setLoading("upload"); setReport(null); setUploadError(null);
    try {
      const r = await call("upload", (s) => api.upload(s, file, column.trim(), policy), { silent: true });
      addDataset(r.dataset, r.evicted);
      setReport(r.dataset.report);
      toast("ok", "CSV validated and loaded", `${fmtInt(r.dataset.size)} values ready.`);
      setFile(null);
    } catch (e) { setUploadError(e); } finally { setLoading(null); }
  };

  const pick = (f) => { if (f) { setFile(f); setReport(null); setUploadError(null); } };
  const disabled = !online || !!busy;

  return (
    <>
      <div className="page-head">
        <div><h1>Datasets</h1><p>Data is generated or parsed on the Colab machine, so large datasets never travel through your laptop.</p></div>
      </div>

      <div className="stack">
        <section className="panel">
          <div className="panel-head"><div><h2>Built-in samples</h2><p className="sub">Generated with the same integer generator as your notebook (values 1–1000, float32).</p></div></div>
          <div className="choice-grid">
            {PRESETS.map((p) => {
              const have = datasets.find((d) => d.source === "preset" && d.name === p.key);
              return (
                <button key={p.key} className="choice" aria-pressed={have?.id === selectedId} disabled={disabled} onClick={() => loadPreset(p.key)}>
                  <div className="t"><span>{PRESET_COPY[p.key].title}</span>{loading === p.key ? <Spinner /> : have ? <CheckCircle2 size={17} className="i-good" /> : null}</div>
                  <div className="big">{fmtInt(p.size)}</div>
                  <div className="d">{PRESET_COPY[p.key].note}</div>
                </button>
              );
            })}
          </div>
        </section>

        <div className="grid g2">
          <section className="panel">
            <div className="panel-head"><div><h2>Generate a benchmark dataset</h2><p className="sub">Any length from 1 element up. Very large sizes are checked against free RAM first.</p></div></div>
            <form className="stack" style={{ gap: 14 }} onSubmit={generate}>
              <label className="field">Number of elements
                <input className="input mono" inputMode="numeric" value={size} onChange={(e) => setSize(e.target.value)} />
                <span className="row" style={{ gap: 6 }}>
                  {[1e3, 5e5, 5e6, 2.5e7, 1e8].map((n) => <button type="button" key={n} className="btn btn-sm btn-ghost" onClick={() => setSize(String(n))}>{fmtSize(n)}</button>)}
                </span>
              </label>
              <div className="grid g2" style={{ gap: 12 }}>
                <label className="field">Distribution
                  <select className="input" value={dist} onChange={(e) => setDist(e.target.value)}>
                    <option value="integers">Integers 1–1000</option><option value="uniform">Uniform decimals 0–1000</option><option value="normal">Normal (500 ± 100)</option>
                  </select></label>
                <label className="field">Seed (optional)
                  <input className="input mono" inputMode="numeric" placeholder="random" value={seed} onChange={(e) => setSeed(e.target.value)} /></label>
              </div>
              <label className="field">Name (optional)<input className="input" value={gname} onChange={(e) => setGname(e.target.value)} maxLength={80} /></label>
              <button className="btn btn-primary" disabled={disabled}>{loading === "custom" ? <Spinner /> : <Wand2 size={16} />} Generate dataset</button>
            </form>
          </section>

          <section className="panel">
            <div className="panel-head"><div><h2>Upload a CSV</h2><p className="sub">One numeric column. Bad rows are reported, never hidden.</p></div></div>
            <div className="stack" style={{ gap: 14 }}>
              <div className={`drop ${over ? "over" : ""}`} role="button" tabIndex={0}
                onClick={() => input.current?.click()} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
                onDrop={(e) => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files?.[0]); }}>
                <Upload size={22} style={{ marginBottom: 6 }} />
                <div><b>{file ? file.name : "Drop a .csv file here, or click to choose"}</b></div>
                <div className="hint">{file ? fmtBytes(file.size) : ".csv, .tsv or .txt · up to the backend's upload limit"}</div>
                <input ref={input} type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" hidden onChange={(e) => pick(e.target.files?.[0])} />
              </div>
              <div className="grid g2" style={{ gap: 12 }}>
                <label className="field">Column (name or number)<input className="input" placeholder="auto-detect" value={column} onChange={(e) => setColumn(e.target.value)} /></label>
                <div className="field">If values are bad
                  <div className="seg" role="group" aria-label="Bad value policy">
                    <button type="button" aria-pressed={policy === "skip"} onClick={() => setPolicy("skip")}>Skip and report</button>
                    <button type="button" aria-pressed={policy === "reject"} onClick={() => setPolicy("reject")}>Reject file</button>
                  </div>
                </div>
              </div>
              <button className="btn btn-primary" disabled={disabled || !file} onClick={upload}>{loading === "upload" ? <Spinner /> : <Upload size={16} />} Validate and upload</button>
              {uploadError && (
                <div className="banner bad" style={{ marginBottom: 0 }}><AlertTriangle size={20} style={{ flex: "none" }} /><div><b>{uploadError.message}</b><div className="small">{uploadError.hint}</div></div></div>
              )}
              <UploadReport report={report} />
            </div>
          </section>
        </div>

        <section className="panel">
          <div className="panel-head"><div><h2>On the backend now</h2><p className="sub">Pick the dataset to use on the Run page. The backend keeps the 4 most recent in RAM.</p></div></div>
          {datasets.length === 0 ? (
            <Empty title="No datasets yet" action={<span className="small">Load a sample above to begin.</span>}>The Colab machine holds datasets in memory; they disappear when the runtime restarts.</Empty>
          ) : (
            <div className="stack" style={{ gap: 10 }}>
              {datasets.map((d) => (
                <div key={d.id} className={"row ds-row" + (d.id === selectedId ? " sel" : "")}>
                  <button className="btn btn-ghost" style={{ border: 0, padding: 0, justifyContent: "flex-start", flex: 1, minWidth: 220, textAlign: "left" }} onClick={() => setSelectedId(d.id)} aria-pressed={d.id === selectedId}>
                    <Database size={18} />
                    <span><b>{d.label || d.name}</b> <span className="muted small">· {d.source === "csv" ? "CSV upload" : d.source === "preset" ? "sample" : "generated"}</span>
                      <span className="mono small muted" style={{ display: "block" }}>{fmtInt(d.size)} values · {fmtBytes(d.bytes)} · min {d.min} · max {d.max}</span></span>
                  </button>
                  <div className="row">
                    {d.id === selectedId && <span className="pill ok"><i className="dot" />Selected</span>}
                    <button className="btn btn-sm" onClick={() => { setSelectedId(d.id); go("run"); }}>Use on Run page</button>
                    <button className="btn btn-sm btn-danger btn-ghost" aria-label={`Delete ${d.name}`} onClick={() => removeDataset(d.id).catch(() => {})}><Trash2 size={15} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
