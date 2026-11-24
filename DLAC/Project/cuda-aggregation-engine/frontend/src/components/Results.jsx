import { CheckCircle2, XCircle } from "lucide-react";
import { fmtMs, fmtNum, fmtSci, fmtX, fmtInt, fmtBytes } from "../format";
import { Stat } from "./ui";
import { COLORS } from "./Charts";

export function ResultCards({ result }) {
  return (
    <div className="grid g4">
      {result.rows.map((r) => (
        <div className="stat" key={r.op}>
          <div className="k">{r.label} · GPU result</div>
          <div className="v">{fmtNum(r.gpu_result)}</div>
          <div className="n">CPU: {fmtNum(r.cpu_result)}</div>
        </div>
      ))}
    </div>
  );
}

export function TimingCards({ result }) {
  const s = result.summary;
  return (
    <div className="grid g4">
      <Stat swatch={COLORS.cpu} label="CPU time" value={fmtMs(s.cpu_ms)} note={`NumPy, mean of ${result.repeats} runs`} />
      <Stat swatch={COLORS.kernel} label="GPU kernel time" value={fmtMs(s.gpu_kernel_ms)} note="Kernel only · CUDA events, synchronised" />
      <Stat swatch={COLORS.transfer} label="CPU → GPU transfer" value={fmtMs(s.gpu_transfer_ms)} note={`${fmtBytes(result.bytes_transferred)}${result.transfer_gbps ? ` · ${result.transfer_gbps.toFixed(1)} GB/s` : ""}`} />
      <Stat label="Total GPU time" value={fmtMs(s.gpu_total_ms)} note="Transfer + kernel + readback" />
    </div>
  );
}

export function Verdict({ result }) {
  const s = result.summary;
  const faster = s.gpu_faster_overall;
  return (
    <div className="panel">
      <div className="small muted">What the numbers say</div>
      <p style={{ marginTop: 6, fontSize: 16, maxWidth: "75ch" }}>
        {s.kernel_speedup != null && <>The GPU kernels ran <b className="mono">{fmtX(s.kernel_speedup)}</b> {s.kernel_speedup >= 1 ? "faster" : "as fast, i.e. slower"} than NumPy. </>}
        Including the copy to the GPU, the total GPU time was <b className="mono">{fmtX(s.overall_speedup)}</b> —{" "}
        <b>{faster ? "the GPU still finished first." : "the CPU finished first, because moving the data cost more than the speed-up saved."}</b>
      </p>
      <p className="hint" style={{ marginTop: 8 }}>
        Kernel-only speed-up = CPU time ÷ kernel time. Overall speed-up = CPU time ÷ (transfer + kernel + readback).
        Transfer is paid once per run, so more operations on the same data improve the overall figure.
      </p>
    </div>
  );
}

export function ResultsTable({ result }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr><th>Operation</th><th>CPU result</th><th>GPU result</th><th>CPU time</th><th>GPU kernel</th><th>Transfer</th><th>Readback</th><th>GPU total</th><th>Kernel speed-up</th><th>Overall speed-up</th><th>Match</th></tr>
        </thead>
        <tbody>
          {result.rows.map((r) => (
            <tr key={r.op}>
              <td>{r.label}</td>
              <td className="num">{fmtNum(r.cpu_result)}</td>
              <td className="num">{fmtNum(r.gpu_result)}</td>
              <td className="num">{fmtMs(r.cpu_ms)}</td>
              <td className="num">{fmtMs(r.gpu_kernel_ms)}</td>
              <td className="num">{fmtMs(r.gpu_transfer_ms)}</td>
              <td className="num">{fmtMs(r.gpu_readback_ms)}</td>
              <td className="num">{fmtMs(r.gpu_total_ms)}</td>
              <td className={"num " + (r.kernel_speedup >= 1 ? "is-good" : "is-warn")}>{fmtX(r.kernel_speedup)}</td>
              <td className={"num " + (r.overall_speedup >= 1 ? "is-good" : "is-warn")}>{fmtX(r.overall_speedup)}</td>
              <td>{r.match ? <CheckCircle2 size={17} className="i-good" aria-label="match" /> : <XCircle size={17} className="i-bad" aria-label="mismatch" />}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Correctness({ result }) {
  const ok = result.all_match;
  return (
    <div className="panel">
      <div className={`verdict ${ok ? "pass" : "fail"}`}>
        {ok ? <CheckCircle2 size={28} className="i-good" /> : <XCircle size={28} className="i-bad" />}
        <div>
          <h3>{ok ? "Verified: CPU and GPU results match" : "Mismatch: CPU and GPU results differ"}</h3>
          <div className="small muted">
            Each GPU value was compared with NumPy's result on the same {fmtInt(result.dataset.size)} values, and with a float64 reference computed on the host.
            Minimum and maximum must be identical; sum and average must agree within {"1e-4"} of Σ|x| (float32 rounding).
          </div>
        </div>
      </div>
      <div className="checks">
        {result.rows.map((r) => (
          <div className="check" key={r.op}>
            <div style={{ display: "flex", gap: 9, alignItems: "center", fontWeight: 600 }}>
              {r.match ? <CheckCircle2 size={18} className="i-good" /> : <XCircle size={18} className="i-bad" />}{r.label}
            </div>
            <div className="vals">
              <span><em>CPU</em>{fmtNum(r.cpu_result)}</span>
              <span><em>GPU</em>{fmtNum(r.gpu_result)}</span>
              <span><em>float64 ref</em>{fmtNum(r.reference_float64)}</span>
            </div>
            <div className="vals" style={{ textAlign: "right" }}>
              <span>|diff| {fmtSci(r.abs_diff)}</span>
              <span>tolerance {fmtSci(r.tolerance)}</span>
              <span className="pill" style={{ justifySelf: "end" }}>{r.match ? "PASS" : "FAIL"}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
