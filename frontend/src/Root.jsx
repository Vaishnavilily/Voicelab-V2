import { useEffect, useState } from "react";
import App from "./App.jsx";

async function call(url, body) {
  const r = await fetch(url, body === undefined ? undefined : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || (r.status >= 500 ? "The server is not responding. Check that the backend is running." : "Something went wrong."));
  return j;
}
const parse = () => { const [p, q] = (location.hash.slice(1) || "/").split("?"); return { path: p || "/", q: new URLSearchParams(q || "") }; };
const goto = (p) => { location.hash = p; };

function Top({ user, onLogout }) {
  return (
    <header className="top">
      <a className="brand" href="#/">VoiceLab</a>
      <nav className="toplinks">
        <a href="#/about">About</a>
        {user ? (<><a href="#/studio">Open studio</a><button className="ghost" onClick={onLogout}>Log out</button></>)
          : (<><a className="ghost-link" href="#/login">Log in</a><a className="solid-link" href="#/signup">Sign up</a></>)}
      </nav>
    </header>
  );
}

function Landing({ user, scrollAbout }) {
  useEffect(() => { if (scrollAbout) document.getElementById("about")?.scrollIntoView({ behavior: "smooth" }); }, [scrollAbout]);
  return (
    <>
      <section className="hero">
        <h1>Welcome to VoiceLab!</h1>
        <p>Clone a voice from a few seconds of audio and make it speak Telugu. Record or upload a short sample, type what you want said, and VoiceLab generates the speech with the open-source IndicF5 model on a cloud GPU.</p>
        <a className="cta" href={user ? "#/studio" : "#/signup"}>{user ? "Open studio" : "Get started"}</a>
      </section>
      <section id="about" className="section">
        <h2>About VoiceLab</h2>
        <p>VoiceLab is a small tool for text-to-speech with voice cloning, built around IndicF5 from AI4Bharat. Your voice samples are stored in your own private library, and each clip is generated on demand.</p>
        <ul>
          <li><b>Add a voice.</b> Record or upload 5–10 seconds of one clear speaker, and type exactly what was said.</li>
          <li><b>Write your text.</b> Enter up to 500 characters of Telugu.</li>
          <li><b>Listen and download.</b> A clip takes a few minutes to generate.</li>
        </ul>
        <p className="sub">Only clone voices you have the right to use.</p>
      </section>
    </>
  );
}

function Card({ title, children }) { return <div className="authcard"><h1>{title}</h1>{children}</div>; }

function AuthForm({ mode, onAuth }) {
  const signup = mode === "signup";
  const [f, setF] = useState({ username: "", email: "", password: "", confirm: "" }), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function submit(e) {
    e.preventDefault(); setErr("");
    if (signup && f.password !== f.confirm) return setErr("Passwords do not match.");
    setBusy(true);
    try { onAuth((await call(signup ? "/api/auth/signup" : "/api/auth/login", f)).user); }
    catch (x) { setErr(x.message); setBusy(false); }
  }
  return (
    <Card title={signup ? "Create your account" : "Log in"}>
      <form onSubmit={submit}>
        <label>Username<input value={f.username} onChange={set("username")} autoComplete="username" required /></label>
        {signup && <label>Email<input type="email" value={f.email} onChange={set("email")} autoComplete="email" required /></label>}
        <label>Password<input type="password" value={f.password} onChange={set("password")} autoComplete={signup ? "new-password" : "current-password"} required /></label>
        {signup && <label>Confirm password<input type="password" value={f.confirm} onChange={set("confirm")} autoComplete="new-password" required /></label>}
        {err && <p className="err">{err}</p>}
        <button className="btn" style={{ width: "100%" }} disabled={busy}>{busy ? "Please wait…" : signup ? "Sign up" : "Log in"}</button>
      </form>
      <p className="alt">
        {signup ? <>Already have an account? <a href="#/login">Log in</a></> : <><a href="#/forgot">Forgot password?</a> · <a href="#/signup">Create account</a></>}
      </p>
    </Card>
  );
}

function Forgot() {
  const [email, setEmail] = useState(""), [done, setDone] = useState(false), [err, setErr] = useState("");
  async function submit(e) { e.preventDefault(); setErr(""); try { await call("/api/auth/forgot", { email }); setDone(true); } catch (x) { setErr(x.message); } }
  return (
    <Card title="Forgot password">
      {done ? <p>If that email is registered, a reset link is on its way. The link works for 30 minutes.</p> : (
        <form onSubmit={submit}>
          <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          {err && <p className="err">{err}</p>}
          <button className="btn" style={{ width: "100%" }}>Send reset link</button>
        </form>)}
      <p className="alt"><a href="#/login">Back to log in</a></p>
    </Card>
  );
}

function Reset({ token }) {
  const [pw, setPw] = useState(""), [pw2, setPw2] = useState(""), [done, setDone] = useState(false), [err, setErr] = useState("");
  async function submit(e) {
    e.preventDefault(); setErr("");
    if (pw !== pw2) return setErr("Passwords do not match.");
    try { await call("/api/auth/reset", { token, password: pw }); setDone(true); } catch (x) { setErr(x.message); }
  }
  return (
    <Card title="Choose a new password">
      {done ? <p>Your password was changed. <a href="#/login">Log in</a></p> : (
        <form onSubmit={submit}>
          <label>New password<input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" required /></label>
          <label>Confirm password<input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" required /></label>
          {err && <p className="err">{err}</p>}
          <button className="btn" style={{ width: "100%" }}>Change password</button>
        </form>)}
    </Card>
  );
}

export default function Root() {
  const [route, setRoute] = useState(parse()), [user, setUser] = useState(undefined), [down, setDown] = useState(false);
  useEffect(() => {
    const h = () => setRoute(parse()), out = () => setUser(null);
    addEventListener("hashchange", h); addEventListener("voicelab-logout", out);
    call("/api/auth/me").then((j) => setUser(j.user || null)).catch(() => { setUser(null); setDown(true); });
    return () => { removeEventListener("hashchange", h); removeEventListener("voicelab-logout", out); };
  }, []);
  const logout = async () => { await call("/api/auth/logout", {}).catch(() => {}); setUser(null); goto("/"); };
  const onAuth = (u) => { setUser(u); setDown(false); goto("/studio"); };
  if (user === undefined) return <p className="status" style={{ padding: 24 }}>Loading…</p>;

  let path = route.path;
  if (path === "/studio" && !user) path = "/login";
  if (user && (path === "/login" || path === "/signup")) path = "/studio";
  if (path === "/studio") return <App user={user} onLogout={logout} />;

  return (
    <>
      <Top user={user} onLogout={logout} />
      {down && <div className="banner">Cannot reach the server. Start the backend, then reload this page.</div>}
      <div className="page">
        {path === "/login" && <AuthForm mode="login" onAuth={onAuth} />}
        {path === "/signup" && <AuthForm mode="signup" onAuth={onAuth} />}
        {path === "/forgot" && <Forgot />}
        {path === "/reset" && <Reset token={route.q.get("token") || ""} />}
        {!["/login", "/signup", "/forgot", "/reset"].includes(path) && <Landing user={user} scrollAbout={path === "/about"} />}
      </div>
    </>
  );
}
