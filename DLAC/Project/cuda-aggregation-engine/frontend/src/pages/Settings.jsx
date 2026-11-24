import { useState } from "react";
import { Eye, EyeOff, PlugZap } from "lucide-react";
import { useApp } from "../store";
import { StatusPill, Spinner } from "../components/ui";
import { cleanUrl } from "../api";

export default function Settings() {
  const { settings, setSettings, conn, checkNow } = useApp();
  const [url, setUrl] = useState(settings.baseUrl);
  const [key, setKey] = useState(settings.apiKey);
  const [show, setShow] = useState(false);
  const [testing, setTesting] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setTesting(true);
    setSettings({ baseUrl: cleanUrl(url), apiKey: key });
    setTimeout(async () => { await checkNow(); setTesting(false); }, 150);
  };

  return (
    <>
      <div className="page-head"><div><h1>Connection</h1><p>The dashboard talks to the FastAPI server that your Colab notebook starts. The URL and key change each time the notebook restarts.</p></div><StatusPill /></div>
      <div className="grid split">
        <form className="panel stack" style={{ gap: 16 }} onSubmit={save}>
          <label className="field">Backend URL
            <input className="input mono" placeholder="https://abcd-12-34-56-78.ngrok-free.app" value={url} onChange={(e) => setUrl(e.target.value)} autoComplete="off" spellCheck={false} />
            <span className="hint">Printed by the “Start server and tunnel” cell in Colab. No trailing slash needed.</span></label>
          <label className="field">API key
            <span style={{ position: "relative", display: "block" }}>
              <input className="input mono" type={show ? "text" : "password"} value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" spellCheck={false} style={{ paddingRight: 44 }} />
              <button type="button" className="btn btn-ghost btn-sm" aria-label={show ? "Hide key" : "Show key"} onClick={() => setShow(!show)} style={{ position: "absolute", right: 4, top: 4, border: 0 }}>{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
            </span>
            <span className="hint">Sent as the X-API-Key header. Stored only in this browser.</span></label>
          <div className="row"><button className="btn btn-primary" disabled={!url.trim() || testing}>{testing ? <Spinner /> : <PlugZap size={16} />} Save and test connection</button></div>
          {conn.error && conn.status !== "online" && <div className="banner bad" style={{ marginBottom: 0 }}><div><b>{conn.error.message}</b><div className="small">{conn.error.hint}</div></div></div>}
        </form>
        <section className="panel">
          <h2>When the connection drops</h2>
          <ul className="small" style={{ color: "var(--text-2)", paddingLeft: 18, display: "grid", gap: 8, marginTop: 10 }}>
            <li><b>“Cannot reach the backend”</b>: the Colab session ended or the server cell stopped. Re-run the start cell in Colab.</li>
            <li><b>New URL after a restart</b>: the free ngrok address changes every run. Paste the new one here.</li>
            <li><b>“API key rejected”</b>: a restart also creates a new key. Copy it again.</li>
            <li><b>Datasets vanished</b>: they live in Colab's RAM. Load them again.</li>
          </ul>
          <p className="hint" style={{ marginTop: 14 }}>The dashboard checks the backend every 8 seconds and recovers on its own once it is back.</p>
        </section>
      </div>
    </>
  );
}
