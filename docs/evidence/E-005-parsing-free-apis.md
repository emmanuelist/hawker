# E-005 — comment parsing on free model APIs (2026-11-07)

Inputs: 60 labelled live-sale comments (English, Nigerian Pidgin, Taglish, emoji), batches of 10, temperature 0. Scoring counts only commerce-critical errors (wrong intent, or wrong item/variant/qty on a claim or cancel).

```text
# S2 rerun on free APIs — 2026-11-07 ~08:30–09:10 UTC (commerce-critical scoring)
haiku: critical-correct [59, 60, 60]/60 | phantom [0, 0, 0] | missed [0, 0, 0] | mean batch latency [18.8, 18.0, 21.7]s | API errors [0, 0, 0]
      #57 'I want am' -> claim [('A1', 'am', 1)]
qwen/qwen3.8-27b: critical-correct [60, 60, 60]/60 | phantom [0, 0, 0] | missed [0, 0, 0] | mean batch latency [2.1, 1.6, 2.3]s | API errors [3, 3, 6]
qwen/qwen3.8-27b: critical-correct [60, 60]/60 | phantom [0, 0] | missed [0, 0] | mean batch latency [2.2, 2.3]s | API errors [5, 8]
gemini-3.5-flash-lite: critical-correct [59, 59, 60]/60 | phantom [0, 0, 0] | missed [1, 1, 0] | mean batch latency [4.2, 5.2, 4.2]s | API errors [1, 0, 1]
      #31 'M pls' -> unclear []
      #31 'M pls' -> unclear []
openai/gpt-oss-120b: critical-correct [56]/60 | phantom [0] | missed [2] | mean batch latency [2.2]s | API errors [0]
      #5 'M2 gold' -> claim [('A3', 'gold', 1)]
      #32 'mine S and M' -> claim [('A1', 's', 1)]
      #46 "someone cancel? I'm next for L" -> question []
      #55 'M x 3' -> unclear []

Groq qwen/qwen3.8-27b free limits (response headers): 1000 requests/day, 8000 tokens/min. One 10-comment batch = ~898 in + ~318 out tokens.
gemini-3.8-flash: did not finish one 6-batch run in ~20 min (stopped) — too slow for live use.
Gemini 3.5 Flash-Lite: occasional 503 'high demand' (2 of 18 calls); Groq qwen: frequent 429 TPM + occasional 503 'over capacity'. Retries succeeded in all cases.

--- earlier strict exact-match runs (Claude Haiku via local CLI; latency is CLI overhead, not API)
preds-haiku-r1.json: exact 59/60 = 98% | phantom claims 0 | missed claims 0 | latency [9.4, 13.8, 20.6, 17.8, 12.2, 38.7]
  #57 [A1] 'I want am': gold=('claim', [('A1', None, 1)]) got=('claim', [('A1', 'am', 1)])
preds-haiku-r2.json: exact 60/60 = 100% | phantom claims 0 | missed claims 0 | latency [18.2, 11.6, 13.5, 20.4, 13.1, 31.2]

preds-haiku-r3.json: exact 55/60 = 92% | phantom claims 0 | missed claims 0 | latency [27.3, 13.1, 43.8, 20.3, 13.5, 12.3]
  #3 [A3] 'how much be this one?': gold=('question', []) got=('question', [('A3', None, None)])
  #6 [A3] 'pls is it real leather': gold=('question', []) got=('question', [('A3', None, None)])
  #22 [A3] 'is A2 coming back on?': gold=('question', []) got=('question', [('A2', None, None)])
  #24 [A3] 'black one don finish?': gold=('question', []) got=('question', [('A3', 'black', None)])
  #27 [A3] 'how many red left': gold=('question', []) got=('question', [('A3', 'red', None)])

unstable across 3 runs: 6 comments -> [3, 6, 22, 24, 27, 57]
```

The cases, prompt and runners move into eval/ in M1 so the result can be re-run with one command.
