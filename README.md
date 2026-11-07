# Hawker

A live-sale desk built on PayPal, in development for the [PayPal AI Hackathon](https://paypalaihackathon.devpost.com/).

This README becomes the proof surface once the core flow works. Until then it makes no product claims.
Build state: [`docs/STATE.md`](docs/STATE.md) · Plan: [`docs/PLAN.md`](docs/PLAN.md).

## Run locally

Requires Node 26 (see `.node-version`).

```bash
cp .env.example .env   # fill in sandbox credentials
npm install
npm run dev            # http://localhost:3000, health at /api/health
```

Gate: `npm run lint && npm run typecheck && npm test && npm run build`.

## License

MIT
