import { useEffect, useRef, useState } from "react";

const api = async (url, opts) => {
  const r = await fetch(url, opts);
  const j = await r.json().catch(() => ({}));
  if (r.status === 401) window.dispatchEvent(new Event("voicelab-logout"));
  if (!r.ok) throw new Error(j.error || (r.status >= 500 ? "The server is not responding. Check that the backend is running." : "Something went wrong."));
  return j;
};

function AddVoice({ onClose, onSaved }) {
  const [f, setF] = useState({ name: "", description: "", transcript: "" });
  const [blob, setBlob] = useState(null), [rec, setRec] = useState(false);
  const [ok, setOk] = useState(false), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  const mr = useRef(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function toggleRec() {
    if (rec) { mr.current.stop(); return; }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks = []; mr.current = new MediaRecorder(s);
      mr.current.ondataavailable = (e) => chunks.push(e.data);
      mr.current.onstop = () => { setBlob(new Blob(chunks)); setRec(false); s.getTracks().forEach((t) => t.stop()); };
      mr.current.start(); setRec(true);
    } catch { setErr("Microphone access was blocked. Allow it in the browser, or upload a file instead."); }
  }

  async function save() {
    setBusy(true); setErr("");
    const d = new FormData();
    Object.entries(f).forEach(([k, v]) => d.append(k, v)); d.append("audio", blob);
    try { await api("/api/voices", { method: "POST", body: d }); onSaved(); } catch (e) { setErr(e.message); setBusy(false); }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" role="dialog" aria-label="Add voice" onClick={(e) => e.stopPropagation()}>
        <h2>Add voice</h2>
        <label>Name<input value={f.name} onChange={set("name")} /></label>
        <label>Description (optional)<input value={f.description} onChange={set("description")} /></label>
        <label>Voice sample (5–10 seconds, one speaker, no background noise)</label>
        <div className="rec">
          <button className="ghost" onClick={toggleRec}>{rec ? "Stop recording" : "Record"}</button>
          <span>or</span>
          <input type="file" accept="audio/*,video/*" style={{ width: "auto", margin: 0 }} onChange={(e) => setBlob(e.target.files[0])} />
        </div>
        {blob && !rec && <audio controls src={URL.createObjectURL(blob)} style={{ marginBottom: 14 }} />}
        <label>Exactly what is said in the sample
          <textarea rows={3} value={f.transcript} onChange={set("transcript")} placeholder="Type the Telugu words you spoke, word for word." />
        </label>
        <label className="check"><input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} />
          I have the right to clone this voice and will not use it to mislead or harm anyone.</label>
        {err && <p className="err">{err}</p>}
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button className="ghost" onClick={onClose}>Cancel</button>
          <button className="btn" disabled={!ok || !blob || !f.name || !f.transcript || busy} onClick={save}>{busy ? "Saving…" : "Add voice"}</button>
        </div>
      </div>
    </div>
  );
}

function Voices({ voices, reload, use }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <h1>Your voices</h1>
      <p className="sub">Clone a voice from a short recording, then use it to speak any Telugu text.</p>
      <div className="grid">
        <div className="card add" role="button" tabIndex={0} onClick={() => setOpen(true)} onKeyDown={(e) => e.key === "Enter" && setOpen(true)}>
          <span style={{ fontSize: 28 }}>+</span>Add cloned voice
        </div>
        {voices.map((v) => (
          <div className="card" key={v.id}>
            <h3>{v.name}</h3><small>{v.description || "Cloned voice"}</small>
            <div className="row">
              <button className="ghost" onClick={() => use(v.id)}>Use</button>
              <button className="ghost" onClick={async () => { if (confirm(`Remove "${v.name}"?`)) { await api(`/api/voices/${v.id}`, { method: "DELETE" }); reload(); } }}>Remove</button>
            </div>
          </div>
        ))}
      </div>
      {open && <AddVoice onClose={() => setOpen(false)} onSaved={() => { setOpen(false); reload(); }} />}
    </>
  );
}

function Speech({ voices, voiceId, setVoiceId }) {
  const [text, setText] = useState(""), [job, setJob] = useState(null), [err, setErr] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!job) return;
    let fails = 0;
    const t = setInterval(async () => {
      try {
        const j = await api(`/api/jobs/${job}`);
        fails = 0; setStatus(j.status || "");
        if (j.status === "done" || j.status === "error") { clearInterval(t); if (j.error) setErr(j.error); }
      } catch (e) {  // backend down or job lost: stop waiting and say so instead of spinning forever
        if (++fails >= 3) { clearInterval(t); setStatus("error"); setErr(`Lost contact with the server (${e.message}) Make sure the backend is running, then try again.`); }
      }
    }, 4000);
    return () => clearInterval(t);
  }, [job]);

  async function go() {
    setErr(""); setJob(null); setStatus("Queued");
    try { setJob((await api("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ voice_id: voiceId, text }) })).id); }
    catch (e) { setErr(e.message); setStatus(""); }
  }
  const working = status && status !== "done" && status !== "error";

  return (
    <>
      <h1>Speech</h1>
      <p className="sub">Each clip runs on a Kaggle GPU and takes a few minutes.</p>
      <label>Voice
        <select value={voiceId} onChange={(e) => setVoiceId(e.target.value)}>
          <option value="">Choose a voice</option>
          {voices.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
      </label>
      <label>Text
        <textarea rows={6} maxLength={5000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Type or paste Telugu text." />
      </label>
      <div className="count">{text.length} / 5000</div>
      <button className="btn" style={{ width: "100%" }} disabled={!voiceId || !text.trim() || working} onClick={go}>{working ? "Generating…" : "Generate"}</button>
      {working && <p className="status">{status}. Keep this tab open.</p>}
      {err && <p className="err">{err}</p>}
      {status === "done" && (<><audio controls src={`/api/jobs/${job}/audio`} /><p><a href={`/api/jobs/${job}/audio`} download="speech.mp3">Download audio</a></p></>)}
    </>
  );
}

export default function App({ user, onLogout }) {
  const [tab, setTab] = useState("voices"), [voices, setVoices] = useState([]), [voiceId, setVoiceId] = useState("");
  const reload = () => api("/api/voices").then(setVoices).catch(() => {});
  useEffect(() => { reload(); }, []);
  return (
    <main>
      <nav>
        <button className={tab === "voices" ? "on" : ""} onClick={() => setTab("voices")}>Voices</button>
        <button className={tab === "speech" ? "on" : ""} onClick={() => setTab("speech")}>Speech</button>
        <button style={{ marginLeft: "auto" }} onClick={onLogout}>Log out ({user})</button>
      </nav>
      {tab === "voices"
        ? <Voices voices={voices} reload={reload} use={(id) => { setVoiceId(id); setTab("speech"); }} />
        : <Speech voices={voices} voiceId={voiceId} setVoiceId={setVoiceId} />}
    </main>
  );
}
