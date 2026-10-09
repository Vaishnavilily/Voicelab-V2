import { useEffect, useRef, useState } from "react";

const api = async (url, opts) => {
  const r = await fetch(url, opts);
  const j = await r.json().catch(() => ({}));
  if (r.status === 401) window.dispatchEvent(new Event("voicelab-logout"));
  if (!r.ok) throw new Error(j.error || (r.status >= 500 ? "The server is not responding. Check that the backend is running." : "Something went wrong."));
  return j;
};

// Mobile browsers often ignore <a download> or open the file in a player. Fetch it as a blob instead,
// then share it (phones: opens the share sheet / "Save to Files") or save it (desktop).
async function downloadAudio(job) {
  try {
    const r = await fetch(`/api/jobs/${job}/audio?dl=1`, { credentials: "same-origin" });
    if (!r.ok) throw new Error("Could not fetch the audio.");
    const file = new File([await r.blob()], "speech.mp3", { type: "audio/mpeg" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: "VoiceLab speech" }); return; }
      catch (e) { if (e.name === "AbortError") return; }
    }
    const url = URL.createObjectURL(file), a = document.createElement("a");
    a.href = url; a.download = "speech.mp3"; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  } catch (e) { alert(e.message); }
}

const EMOTIONS = ["Neutral", "Happy", "Excited", "Calm", "Sad", "Angry", "Serious"];

function AddVoice({ onClose, onSaved, admin }) {
  const [f, setF] = useState({ name: "", description: "", transcript: "", emotion: "Neutral" });
  const [blob, setBlob] = useState(null), [rec, setRec] = useState(false);
  const [ok, setOk] = useState(false), [share, setShare] = useState(false), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
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
    Object.entries(f).forEach(([k, v]) => d.append(k, v)); d.append("audio", blob); d.append("share", share ? "1" : "0");
    try { await api("/api/voices", { method: "POST", body: d }); onSaved(); } catch (e) { setErr(e.message); setBusy(false); }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" role="dialog" aria-label="Add voice" onClick={(e) => e.stopPropagation()}>
        <h2>Add voice</h2>
        <label>Name<input value={f.name} onChange={set("name")} /></label>
        <label>Description (optional)<input value={f.description} onChange={set("description")} /></label>
        <label>Emotion in this sample
          <select value={f.emotion} onChange={set("emotion")}>{EMOTIONS.map((e) => <option key={e}>{e}</option>)}</select>
        </label>
        <p className="sub" style={{ margin: "-8px 0 14px", fontSize: 13 }}>Speak the sample in this emotion. The generated speech copies the tone of the sample, so add the same speaker again with a different emotion to get a different mood.</p>
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
        <label className="check"><input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} />
          Also add this voice to the shared Library{admin ? " as an official sample" : ""}. Every user will be able to use it. Share only your own voice, or one you have permission to share.</label>
        {err && <p className="err">{err}</p>}
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button className="ghost" onClick={onClose}>Cancel</button>
          <button className="btn" disabled={!ok || !blob || !f.name || !f.transcript || busy} onClick={save}>{busy ? "Saving…" : "Add voice"}</button>
        </div>
      </div>
    </div>
  );
}

function Voices({ voices, reload, use, admin, goLibrary }) {
  const [open, setOpen] = useState(false);
  async function toggleShare(v) {
    if (!v.shared && !confirm(`Share "${v.name}" with the Library? Every user will be able to use this voice.`)) return;
    try { await api(`/api/voices/${v.id}/share`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shared: !v.shared }) }); reload(); }
    catch (e) { alert(e.message); }
  }
  return (
    <>
      <h1>Your voices</h1>
      <p className="sub">Clone a voice from a short recording, then use it to speak any Telugu text.</p>
      {!voices.length && <p className="sub">New here? <button className="ghost" onClick={goLibrary}>Browse the Library</button> to try ready-made sample voices, or add your own.</p>}
      <div className="grid">
        <div className="card add" role="button" tabIndex={0} onClick={() => setOpen(true)} onKeyDown={(e) => e.key === "Enter" && setOpen(true)}>
          <span style={{ fontSize: 28 }}>+</span>Add cloned voice
        </div>
        {voices.map((v) => (
          <div className="card" key={v.id}>
            {v.shared && <span className={"badge" + (v.official ? " off" : "")}>{v.official ? "Official · in Library" : "In Library"}</span>}
            <h3>{v.name}</h3><small>{v.description || "Cloned voice"}</small>
            <small><b>Emotion:</b> {v.emotion || "Neutral"}</small>
            <div className="row">
              <button className="ghost" onClick={() => use(v.id)}>Use</button>
              <button className="ghost" onClick={() => toggleShare(v)}>{v.shared ? "Unshare" : "Share"}</button>
              <button className="ghost" onClick={async () => { if (confirm(`Remove "${v.name}"?`)) { await api(`/api/voices/${v.id}`, { method: "DELETE" }); reload(); } }}>Remove</button>
            </div>
          </div>
        ))}
      </div>
      {open && <AddVoice admin={admin} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); reload(); }} />}
    </>
  );
}

function Library({ library, reload, use, admin }) {
  async function remove(v) {
    if (!confirm(`Remove "${v.name}" from the Library for everyone?`)) return;
    try { await api(`/api/voices/${v.id}`, { method: "DELETE" }); reload(); } catch (e) { alert(e.message); }
  }
  return (
    <>
      <h1>Voice library</h1>
      <p className="sub">Sample voices shared by VoiceLab and other users. Listen, then use any of them to speak your text. To share your own voice, add it or press Share on the Voices tab.</p>
      {!library.length && <p className="sub">No shared voices yet.</p>}
      <div className="grid">
        {library.map((v) => (
          <div className="card" key={v.id}>
            <span className={"badge" + (v.official ? " off" : "")}>{v.official ? "Official" : v.mine ? "Shared by you" : `by ${v.by}`}</span>
            <h3>{v.name}</h3><small>{v.description || "Cloned voice"}</small>
            <small><b>Emotion:</b> {v.emotion}</small>
            <audio controls preload="none" src={`/api/voices/${v.id}/sample`} />
            <div className="row">
              <button className="ghost" onClick={() => use(v.id)}>Use</button>
              {admin && <button className="ghost" onClick={() => remove(v)}>Remove</button>}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function Speech({ voices, library, voiceId, setVoiceId }) {
  const mine = new Set(voices.map((v) => v.id)), others = library.filter((v) => !mine.has(v.id));
  const [text, setText] = useState(""), [job, setJob] = useState(null), [err, setErr] = useState("");
  const [status, setStatus] = useState("");
  const [speed, setSpeed] = useState(1);

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
    try { setJob((await api("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ voice_id: voiceId, text, speed }) })).id); }
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
          {voices.length > 0 && <optgroup label="My voices">{voices.map((v) => <option key={v.id} value={v.id}>{v.name} ({v.emotion || "Neutral"})</option>)}</optgroup>}
          {others.length > 0 && <optgroup label="Library">{others.map((v) => <option key={v.id} value={v.id}>{v.name} ({v.emotion}){v.official ? " ★" : ""}</option>)}</optgroup>}
        </select>
      </label>
      <p className="sub" style={{ margin: "-8px 0 14px", fontSize: 13 }}>Tip: the tone of the clip follows the voice sample. For a happy clip, use a sample recorded happy.</p>
      <label>Speed: {speed.toFixed(2)}x {speed < 0.95 ? "(slower, calmer)" : speed > 1.05 ? "(faster, more energetic)" : "(normal)"}
        <input type="range" min="0.7" max="1.3" step="0.05" value={speed} onChange={(e) => setSpeed(parseFloat(e.target.value))} style={{ padding: 0 }} />
      </label>
      <label>Text
        <textarea rows={6} maxLength={5000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Type or paste Telugu text." />
      </label>
      <div className="count">{text.length} / 5000</div>
      <button className="btn" style={{ width: "100%" }} disabled={!voiceId || !text.trim() || working} onClick={go}>{working ? "Generating…" : "Generate"}</button>
      {working && <p className="status">{status}. Keep this tab open.</p>}
      {err && <p className="err">{err}</p>}
      {status === "done" && (<><audio controls src={`/api/jobs/${job}/audio`} /><p><button className="btn" onClick={() => downloadAudio(job)}>Download audio</button></p></>)}
    </>
  );
}

export default function App({ user, onLogout }) {
  const [tab, setTab] = useState("voices"), [voices, setVoices] = useState([]), [voiceId, setVoiceId] = useState("");
  const [library, setLibrary] = useState([]);
  const reload = () => Promise.all([api("/api/voices").then(setVoices), api("/api/library").then(setLibrary)]).catch(() => {});
  useEffect(() => { reload(); }, []);
  return (
    <main>
      <nav>
        <button className={tab === "voices" ? "on" : ""} onClick={() => setTab("voices")}>Voices</button>
        <button className={tab === "library" ? "on" : ""} onClick={() => setTab("library")}>Library</button>
        <button className={tab === "speech" ? "on" : ""} onClick={() => setTab("speech")}>Speech</button>
        <button style={{ marginLeft: "auto" }} onClick={onLogout}>Log out ({user.username})</button>
      </nav>
      {tab === "voices" && <Voices voices={voices} reload={reload} admin={user.admin} goLibrary={() => setTab("library")} use={(id) => { setVoiceId(id); setTab("speech"); }} />}
      {tab === "library" && <Library library={library} reload={reload} admin={user.admin} use={(id) => { setVoiceId(id); setTab("speech"); }} />}
      {tab === "speech" && <Speech voices={voices} library={library} voiceId={voiceId} setVoiceId={setVoiceId} />}
    </main>
  );
}
