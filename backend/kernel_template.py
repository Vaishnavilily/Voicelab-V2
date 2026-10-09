import base64, json, os, subprocess
P = json.loads(base64.b64decode("__PAYLOAD__"))
open("ref.wav", "wb").write(base64.b64decode(P["audio"]))
json.dump({"text": P["text"], "transcript": P["transcript"]}, open("payload.json", "w"))
if P.get("hf_token"):
    os.environ["HF_TOKEN"] = P["hf_token"]
else:
    try:
        from kaggle_secrets import UserSecretsClient
        os.environ["HF_TOKEN"] = UserSecretsClient().get_secret("HF_TOKEN")
    except Exception as e:
        print("HF_TOKEN secret not found:", e)
run = lambda c: subprocess.run(c, shell=True, check=True)
PY = "/tmp/venv/bin/python"
run("pip install -q uv && uv venv --python 3.11 /tmp/venv")
run(f"uv pip install -q --python {PY} git+https://github.com/ai4bharat/IndicF5.git soundfile librosa")
run(f'uv pip install -q --python {PY} "transformers==4.49.0" "datasets==3.2.0" "pyarrow>=15,<19" "huggingface_hub>=0.30,<1.0" torchcodec')
open("gen.py", "w").write(r'''
import json, re, numpy as np, soundfile as sf, torch
from transformers import AutoModel
p = json.load(open("payload.json"))
dev = "cuda" if torch.cuda.is_available() else "cpu"
m = AutoModel.from_pretrained("ai4bharat/IndicF5", trust_remote_code=True).to(dev)

def chunks(text, limit=200):
    # Split long text into sentence-sized pieces (the model drops text past ~40 s in one call).
    # Returns (piece, pause_after_in_seconds); a longer pause at the end of a paragraph.
    out = []
    for para in re.split(r"\n+", text):
        cur, pieces = "", []
        for s in re.split(r"(?<=[.!?।])\s+", para.strip()):
            s = s.strip()
            if not s: continue
            while len(s) > limit:  # one very long sentence: cut at the last comma or space before the limit
                cut = max(s.rfind(",", 0, limit), s.rfind(" ", 0, limit))
                cut = cut + 1 if cut > 0 else limit
                if cur: pieces.append(cur); cur = ""
                pieces.append(s[:cut].strip()); s = s[cut:].strip()
            if cur and len(cur) + 1 + len(s) > limit: pieces.append(cur); cur = s
            else: cur = (cur + " " + s).strip()
        if cur: pieces.append(cur)
        out += [(c, 0.25) for c in pieces]
        if out: out[-1] = (out[-1][0], 0.6)
    return out

parts = []
todo = chunks(p["text"])
for i, (c, pause) in enumerate(todo):
    print(f"chunk {i + 1}/{len(todo)}: {len(c)} chars", flush=True)
    a = m(c, ref_audio_path="ref.wav", ref_text=p["transcript"])
    if a.dtype == np.int16: a = a.astype(np.float32) / 32768.0
    parts.append(np.array(a, dtype=np.float32).reshape(-1))
    parts.append(np.zeros(int(24000 * pause), dtype=np.float32))
sf.write("output.wav", np.concatenate(parts), samplerate=24000)
''')
run(f"{PY} gen.py")
os.remove("ref.wav"); os.remove("payload.json")