# E-036: the repo is public (2026-11-08 ~10:20 UTC, on the user's go-ahead)

Before: the whole history scanned for secrets (Groq/Gemini/ElevenLabs-style keys, PayPal client id/secret
assignments, Postgres URLs with passwords, sandbox buyer logins, private keys): no matches. Files ever
committed under `.env*` or `internal/`: only `.env.example`. Commit author email already public on the
user's other repos.

`gh repo edit emmanuelist/hawker --visibility public …` → `gh repo view`:
{"visibility":"PUBLIC","description":"Every hold ends one of two ways: paid through PayPal, or passed to the next buyer.",
 "homepageUrl":"https://hawker-8q2t.onrender.com","license":"MIT License","topics":["ag-grid","hackathon","live-selling","nextjs","paypal"]}

Logged-out checks (no credentials):
- `git clone https://github.com/emmanuelist/hawker` with an empty environment and no credential helper: ok, HEAD c04252d
- raw.githubusercontent.com README.md: 200; docs/media/hawker-cover.png: 200 (245,878 B)
- CI badge SVG: 200, "passing"
- github.com web pages and api.github.com answered 503/504 to every unauthenticated request, github.com's
  home page included, during GitHub's incident "Increase in timeouts for some unauthenticated users"
  (githubstatus.com: Partially Degraded Service, API Requests degraded). Re-check the repo page logged-out after it clears.
