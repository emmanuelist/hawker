# S2 rerun against real APIs (Gemini / Groq). Same cases + system prompt as the Haiku run.
import json, sys, time, re, os, urllib.request, urllib.error
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from cases import CASES
provider, model, run_id = sys.argv[1], sys.argv[2], sys.argv[3]
pace = float(sys.argv[4]) if len(sys.argv) > 4 else 0
env = {}
for l in open('/Users/emmanuelist/Documents/hackathons/paypal-and-ai-hack/.env'):
    m = re.match(r'^([A-Z_]+)=(.*)$', l.strip())
    if m: env[m.group(1)] = m.group(2).strip()
sysprompt = open(os.path.join(HERE, 'system.txt')).read()
def call(prompt):
    if provider == 'gemini':
        url = f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent'
        body = {"system_instruction": {"parts": [{"text": sysprompt}]}, "contents": [{"role": "user", "parts": [{"text": prompt}]}],
                "generationConfig": {"responseMimeType": "application/json", "temperature": 0}}
        req = urllib.request.Request(url, json.dumps(body).encode(), {"Content-Type": "application/json", "x-goog-api-key": env['GEMINI_API_KEY']})
        j = json.load(urllib.request.urlopen(req, timeout=120))
        return "".join(p.get("text", "") for p in j["candidates"][0]["content"]["parts"])
    else:
        body = {"model": model, "temperature": 0, "messages": [{"role": "system", "content": sysprompt}, {"role": "user", "content": prompt}]}
        if model.startswith("openai/gpt-oss"): body["reasoning_effort"] = "low"
        if model.startswith("qwen") and os.environ.get("NOTHINK"): body["reasoning_effort"] = "none"
        req = urllib.request.Request('https://api.groq.com/openai/v1/chat/completions', json.dumps(body).encode(),
                                     {"Content-Type": "application/json", "Authorization": "Bearer " + env['GROQ_API_KEY'], "User-Agent": "s2-spike/1.0"})
        j = json.load(urllib.request.urlopen(req, timeout=120))
        return j["choices"][0]["message"]["content"]
preds, lat, errs = {}, [], []
for s in range(0, len(CASES), 10):
    chunk = CASES[s:s+10]
    prompt = "Parse these comments:\n" + "\n".join(json.dumps({"i": s+k, "on_screen": c[0], "comment": c[1]}, ensure_ascii=False) for k, c in enumerate(chunk))
    for attempt in range(3):
        t = time.time()
        try:
            text = call(prompt); lat.append(time.time() - t)
            text = re.sub(r"^```(json)?|```$", "", text.strip(), flags=re.M).strip()
            arr = json.loads(text)
            if isinstance(arr, dict): arr = next((v for v in arr.values() if isinstance(v, list)), [])
            for o in arr: preds[int(o["i"])] = o
            break
        except urllib.error.HTTPError as e:
            errs.append(f"batch {s} HTTP {e.code} {e.read()[:160]!r}"); time.sleep(15)
        except Exception as e:
            errs.append(f"batch {s} {type(e).__name__} {str(e)[:120]}"); time.sleep(3)
    if pace: time.sleep(pace)
tag = model.replace("/", "_") + ("-nothink" if os.environ.get("NOTHINK") else "")
json.dump({"model": model, "run": run_id, "preds": preds, "latency_s": lat, "errors": errs}, open(os.path.join(HERE, f"api-{tag}-{run_id}.json"), "w"), ensure_ascii=False, indent=1)
print(f"{model} {run_id}: parsed {len(preds)}/60, API latency per 10-comment batch {[round(x,2) for x in lat]}, errors {errs}")
