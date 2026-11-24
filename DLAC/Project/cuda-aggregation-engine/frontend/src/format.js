export const OPS = [
  { key: "sum", label: "Sum", blurb: "Adds every value with a two-pass tree reduction.", symbol: "Σ" },
  { key: "average", label: "Average", blurb: "GPU sum divided by the number of elements.", symbol: "x̄" },
  { key: "min", label: "Minimum", blurb: "Smallest value, found with a min tree reduction.", symbol: "↓" },
  { key: "max", label: "Maximum", blurb: "Largest value, found with a max tree reduction.", symbol: "↑" },
  { key: "all", label: "All four", blurb: "Runs all operations on one copy of the data.", symbol: "∗" },
];

export const PRESET_COPY = {
  small: { title: "Small", note: "Fast to generate. Launch overhead dominates." },
  medium: { title: "Medium", note: "The size used throughout your notebook." },
  large: { title: "Large", note: "Where GPU kernels start to pull ahead." },
  xlarge: { title: "Extra large", note: "Needs about 0.2 GB of GPU memory." },
};

export function fmtInt(n) {
  return n == null ? "–" : Number(n).toLocaleString("en-US");
}
export function fmtSize(n) {
  if (n == null) return "–";
  if (n >= 1e6) return `${+(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${+(n / 1e3).toFixed(1)}K`;
  return String(n);
}
export function fmtBytes(b) {
  if (b == null) return "–";
  if (b >= 2 ** 30) return `${(b / 2 ** 30).toFixed(2)} GB`;
  if (b >= 2 ** 20) return `${(b / 2 ** 20).toFixed(1)} MB`;
  if (b >= 2 ** 10) return `${(b / 2 ** 10).toFixed(1)} KB`;
  return `${b} B`;
}
export function fmtMs(ms) {
  if (ms == null || Number.isNaN(ms)) return "–";
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`;
  if (ms >= 100) return `${ms.toFixed(0)} ms`;
  if (ms >= 10) return `${ms.toFixed(1)} ms`;
  if (ms >= 1) return `${ms.toFixed(2)} ms`;
  return `${ms.toFixed(3)} ms`;
}
export function fmtNum(v) {
  if (v == null || Number.isNaN(v)) return "–";
  const a = Math.abs(v);
  if (a !== 0 && (a >= 1e12 || a < 1e-3)) return v.toExponential(6);
  return v.toLocaleString("en-US", { maximumFractionDigits: a >= 1000 ? 2 : 5 });
}
export function fmtX(x) {
  if (x == null || !Number.isFinite(x)) return "–";
  return `${x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2)}×`;
}
export function fmtSci(v) {
  return v == null ? "–" : v === 0 ? "0" : v.toExponential(2);
}
