import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtMs, fmtSize, fmtX } from "../format";
import { SERIES_VARS, useTheme } from "../theme";

// HTML swatches use CSS variables (they follow the theme); the SVG charts below read concrete colours from useTheme().
export const COLORS = SERIES_VARS;

/** Axis / grid / legend / separator colours for the active theme. */
function useChartKit() {
  const { chart: C } = useTheme();
  return {
    C,
    axis: { stroke: C.axis, fontSize: 12 },
    grid: <CartesianGrid stroke={C.grid} strokeDasharray="3 4" vertical={false} />,
    legend: <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 13, paddingTop: 8 }} formatter={(v) => <span style={{ color: C.legend }}>{v}</span>} />,
    cursor: { fill: C.cursor },
  };
}

function Tip({ active, payload, label, fmt = fmtMs, title }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="tip">
      <b>{title ? title(label) : label}</b>
      {payload.map((p) => (
        <div key={p.dataKey}>
          <span><i className="swatch" style={{ background: p.color || p.fill }} />{p.name}</span>
          <span>{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

const barProps = { radius: [4, 4, 0, 0], maxBarSize: 46, isAnimationActive: false };

/** 1. CPU time next to GPU time, with the GPU bar split into kernel + transfer so the cost of moving data is visible. */
export function CpuVsGpuChart({ rows }) {
  const { C, axis, grid, legend, cursor } = useChartKit();
  const data = rows.map((r) => ({ name: r.label, cpu: r.cpu_ms, kernel: r.gpu_kernel_ms, transfer: r.gpu_transfer_ms + r.gpu_readback_ms }));
  return (
    <div className="chart">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={4}>
          {grid}
          <XAxis dataKey="name" {...axis} tickLine={false} />
          <YAxis {...axis} tickLine={false} axisLine={false} tickFormatter={(v) => fmtMs(v)} width={78} />
          <Tooltip content={<Tip />} cursor={cursor} />
          {legend}
          <Bar dataKey="cpu" name="CPU (NumPy)" fill={C.cpu} stackId="cpu" {...barProps} />
          <Bar dataKey="kernel" name="GPU kernel only" fill={C.kernel} stackId="gpu" stroke={C.separator} strokeWidth={2} isAnimationActive={false} />
          <Bar dataKey="transfer" name="GPU transfer + readback" fill={C.transfer} stackId="gpu" {...barProps} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** 2. Where the GPU's time goes: transfer vs kernel as a share of total GPU time. */
export function TransferChart({ rows }) {
  const { C, axis, legend, cursor } = useChartKit();
  const data = rows.map((r) => {
    const t = r.gpu_total_ms || 1;
    return { name: r.label, transfer: (r.gpu_transfer_ms / t) * 100, kernel: (r.gpu_kernel_ms / t) * 100, readback: (r.gpu_readback_ms / t) * 100,
      abs: { transfer: r.gpu_transfer_ms, kernel: r.gpu_kernel_ms, readback: r.gpu_readback_ms } };
  });
  const tip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const a = payload[0].payload.abs;
    return (
      <div className="tip"><b>{label}</b>
        <div><span><i className="swatch" style={{ background: C.transfer }} />Host → GPU transfer</span><span>{fmtMs(a.transfer)}</span></div>
        <div><span><i className="swatch" style={{ background: C.kernel }} />Kernel</span><span>{fmtMs(a.kernel)}</span></div>
        <div><span><i className="swatch" style={{ background: C.readback }} />Result readback</span><span>{fmtMs(a.readback)}</span></div>
      </div>
    );
  };
  return (
    <div className="chart">
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 0 }}>
          <CartesianGrid stroke={C.grid} strokeDasharray="3 4" horizontal={false} />
          <XAxis type="number" domain={[0, 100]} {...axis} tickFormatter={(v) => `${v}%`} tickLine={false} />
          <YAxis type="category" dataKey="name" {...axis} tickLine={false} axisLine={false} width={76} />
          <Tooltip content={tip} cursor={cursor} />
          {legend}
          <Bar dataKey="transfer" name="Transfer to GPU" isAnimationActive={false} stackId="s" fill={C.transfer} stroke={C.separator} strokeWidth={2} />
          <Bar dataKey="kernel" name="Kernel" isAnimationActive={false} stackId="s" fill={C.kernel} stroke={C.separator} strokeWidth={2} />
          <Bar dataKey="readback" name="Readback" isAnimationActive={false} stackId="s" fill={C.readback} stroke={C.separator} strokeWidth={2} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** 3. Times against dataset size (log-log) from a size sweep. */
export function SizeChart({ sweep, metric = "time" }) {
  const { C, axis, grid, legend } = useChartKit();
  // A log axis cannot show 0, so plot values are floored at 1 microsecond (0.001 ms).
  const FLOOR = 0.001;
  const data = [...sweep].sort((a, b) => a.size - b.size).map((d) => ({
    size: d.size, cpu_ms: Math.max(d.cpu_ms, FLOOR), gpu_kernel_ms: Math.max(d.gpu_kernel_ms, FLOOR),
    gpu_transfer_ms: Math.max(d.gpu_transfer_ms, FLOOR), gpu_total_ms: Math.max(d.gpu_total_ms, FLOOR),
  }));
  const vals = data.flatMap((d) => [d.cpu_ms, d.gpu_kernel_ms, d.gpu_transfer_ms, d.gpu_total_ms]);
  const lo = Math.pow(10, Math.floor(Math.log10(Math.min(...vals))));
  const hi = Math.pow(10, Math.ceil(Math.log10(Math.max(...vals))));
  const yTicks = []; for (let v = lo; v <= hi * 1.0001; v *= 10) yTicks.push(v);
  const isTransfer = metric === "transfer";
  return (
    <div className="chart">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 14, left: 0, bottom: 0 }}>
          {grid}
          <XAxis dataKey="size" type="number" scale="log" domain={[data[0].size / 1.5, data[data.length - 1].size * 1.5]} allowDataOverflow ticks={data.map((d) => d.size)} tickFormatter={fmtSize} {...axis} tickLine={false} />
          <YAxis scale="log" domain={[lo, hi]} ticks={yTicks} allowDataOverflow {...axis} tickLine={false} axisLine={false} tickFormatter={fmtMs} width={78} />
          <Tooltip content={<Tip title={(l) => `${fmtSize(l)} elements`} />} />
          {legend}
          {isTransfer ? (
            <>
              <Line isAnimationActive={false} dataKey="gpu_transfer_ms" name="Host → GPU transfer" stroke={C.transfer} strokeWidth={2} dot={{ r: 4 }} />
              <Line isAnimationActive={false} dataKey="gpu_kernel_ms" name="GPU kernels" stroke={C.kernel} strokeWidth={2} dot={{ r: 4 }} />
            </>
          ) : (
            <>
              <Line isAnimationActive={false} dataKey="cpu_ms" name="CPU (NumPy)" stroke={C.cpu} strokeWidth={2} dot={{ r: 4 }} />
              <Line isAnimationActive={false} dataKey="gpu_kernel_ms" name="GPU kernel only" stroke={C.kernel} strokeWidth={2} dot={{ r: 4 }} />
              <Line isAnimationActive={false} dataKey="gpu_total_ms" name="GPU total (with transfer)" stroke={C.transfer} strokeWidth={2} strokeDasharray="6 4" dot={{ r: 4, strokeDasharray: "0" }} />
            </>
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** 4. Speed-up = CPU time ÷ GPU time. Below the 1× line the CPU wins. */
export function SpeedupChart({ rows, xKey = "label" }) {
  const { C, axis, grid, legend, cursor } = useChartKit();
  const data = rows.map((r) => ({ name: r[xKey] ?? r.label, kernel: r.kernel_speedup, overall: r.overall_speedup }));
  return (
    <div className="chart">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 14, right: 8, left: 0, bottom: 0 }} barGap={4}>
          {grid}
          <XAxis dataKey="name" {...axis} tickLine={false} />
          <YAxis {...axis} tickLine={false} axisLine={false} tickFormatter={fmtX} width={56} />
          <Tooltip content={<Tip fmt={fmtX} />} cursor={cursor} />
          {legend}
          <ReferenceLine y={1} stroke={C.reference} strokeDasharray="5 4" label={{ value: "break-even 1×", fill: C.legend, fontSize: 12, position: "insideTopRight" }} />
          <Bar dataKey="kernel" name="Kernel only" fill={C.kernel} {...barProps} />
          <Bar dataKey="overall" name="Including transfer" fill={C.transfer} {...barProps} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
