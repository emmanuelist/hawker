# Commerce-critical scoring: an error only counts if it would change stock, money, or the clarify path.
#  - intent must match exactly (claim/cancel/question/unclear/other)
#  - for claim/cancel, items (code, variant, qty) must match exactly
#  - for question/unclear/other, attached items are ignored (they never move stock)
import json, sys, glob, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cases import CASES
def norm(items):
    out = []
    for it in items or []:
        g = (lambda k, i: it.get(k) if isinstance(it, dict) else it[i])
        v = g("variant", 1); out.append((str(g("code", 0)).upper(), None if v in (None, "", "null") else str(v).lower(), g("qty", 2)))
    return sorted(out, key=str)
rows = {}
for f in sorted(glob.glob(os.path.join(os.path.dirname(os.path.abspath(__file__)), sys.argv[1]))):
    d = json.load(open(f)); p = {int(k): v for k, v in d["preds"].items()}
    crit, phantom, missed, bad = 0, 0, 0, []
    for i, (scr, text, gi, git) in enumerate(CASES):
        o = p.get(i); pi = o.get("intent") if o else None
        ok = pi == gi and (gi not in ("claim", "cancel") or norm(o.get("items")) == norm(git))
        if not ok:
            crit += 1; bad.append(f"#{i} {text!r} -> {pi} {norm(o.get('items')) if o else None}")
            if pi == "claim" and gi != "claim": phantom += 1
            if gi == "claim" and pi != "claim": missed += 1
    lat = d.get("latency_s", []); m = d["model"]
    rows.setdefault(m, []).append((60 - crit, phantom, missed, sum(lat)/len(lat) if lat else 0, len(d.get("errors", [])), bad))
for m, rs in rows.items():
    print(f"{m}: critical-correct {[r[0] for r in rs]}/60 | phantom {[r[1] for r in rs]} | missed {[r[2] for r in rs]} | mean batch latency {[round(r[3],1) for r in rs]}s | API errors {[r[4] for r in rs]}")
    for r in rs:
        for b in r[5]: print("     ", b)
