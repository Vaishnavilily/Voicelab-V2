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
open("gen.py", "w").write('''
import json, numpy as np, soundfile as sf, torch
from transformers import AutoModel
p = json.load(open("payload.json"))
dev = "cuda" if torch.cuda.is_available() else "cpu"
m = AutoModel.from_pretrained("ai4bharat/IndicF5", trust_remote_code=True).to(dev)
a = m(p["text"], ref_audio_path="ref.wav", ref_text=p["transcript"])
if a.dtype == np.int16: a = a.astype(np.float32) / 32768.0
sf.write("output.wav", np.array(a, dtype=np.float32), samplerate=24000)
''')
run(f"{PY} gen.py")
os.remove("ref.wav"); os.remove("payload.json")