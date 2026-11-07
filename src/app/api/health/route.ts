import { connection } from "next/server";

// Request-time health check: proves the deployed server is live and which commit it runs.
export async function GET() {
  await connection();
  return Response.json({
    ok: true,
    service: "hawker",
    commit: process.env.RENDER_GIT_COMMIT ?? null,
    time: new Date().toISOString(),
  });
}
