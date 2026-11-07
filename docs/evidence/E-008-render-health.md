# E-008 — hello-world deployed on Render (free plan)

Command: `curl -s -D - https://hawker-8q2t.onrender.com/api/health` at 2026-11-07T09:43Z

```text
HTTP/2 200 
date: Sat, 07 Nov 2026 09:43:45 GMT
rndr-id: 7d56e996-fde6-405b
x-render-origin-server: Render
cf-ray: a56b653f2fe5fea4-AMS

{"ok":true,"service":"hawker","commit":"ba911fb40680a92920cfeb51b0a0972b3809ad17","time":"2026-11-07T09:43:45.891Z"}
```

First check 2026-11-07 09:43:33 UTC returned commit `ba911fb40680a92920cfeb51b0a0972b3809ad17` (= `git rev-parse HEAD` at that time). `time` is generated per request (`connection()`), so the response is live, not prerendered. Home page: HTTP 200.
