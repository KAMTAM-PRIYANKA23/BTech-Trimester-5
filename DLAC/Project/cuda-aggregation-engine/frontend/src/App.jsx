import { useState } from "react";
import { BarChart3, Cpu, Database, LayoutDashboard, Play, PlugZap } from "lucide-react";
import { AppProvider, useApp } from "./store";
import { ConnectionBanner, SimulatorBanner, StatusPill, ThemeToggle, Toasts } from "./components/ui";
import { ThemeProvider } from "./theme";
import Dashboard from "./pages/Dashboard";
import Datasets from "./pages/Datasets";
import Run from "./pages/Run";
import Benchmarks from "./pages/Benchmarks";
import Gpu from "./pages/Gpu";
import Settings from "./pages/Settings";

const NAV = [
  { id: "dash", label: "Dashboard", icon: LayoutDashboard },
  { id: "datasets", label: "Datasets", icon: Database },
  { id: "run", label: "Run", icon: Play },
  { id: "bench", label: "Benchmarks", icon: BarChart3 },
  { id: "gpu", label: "GPU and kernels", icon: Cpu },
  { id: "settings", label: "Connection", icon: PlugZap },
];

function Shell() {
  const [page, setPage] = useState(() => (location.hash.slice(1) || "dash"));
  const go = (id) => { setPage(id); history.replaceState(null, "", `#${id}`); window.scrollTo(0, 0); };
  const { gpu } = useApp();
  const Page = { dash: Dashboard, datasets: Datasets, run: Run, bench: Benchmarks, gpu: Gpu, settings: Settings }[page] || Dashboard;
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark" aria-hidden><svg width="20" height="20" viewBox="0 0 32 32"><path d="M5 7h22M9 14h14M13 21h6M16 28v-4" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none" /></svg></div>
          <div><b>Reduction Lab</b><span>CUDA aggregation engine</span></div>
        </div>
        <nav className="nav" aria-label="Main">
          {NAV.map((n) => (
            <button key={n.id} aria-current={page === n.id ? "page" : undefined} onClick={() => go(n.id)}><n.icon size={18} />{n.label}</button>
          ))}
        </nav>
        <div className="side-foot">{gpu?.name ? "Kernels run on the Colab GPU, not on this laptop." : "Waiting for the Colab backend."}</div>
      </aside>
      <main className="main">
        <header className="topbar">
          <StatusPill />
          <ThemeToggle />
        </header>
        <div className="main-inner">
          <ConnectionBanner onSettings={() => go("settings")} />
          <SimulatorBanner />
          <Page go={go} />
        </div>
      </main>
      <Toasts />
    </div>
  );
}

export default function App() { return <ThemeProvider><AppProvider><Shell /></AppProvider></ThemeProvider>; }
