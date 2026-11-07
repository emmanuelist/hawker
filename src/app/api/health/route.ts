import { connection } from "next/server";

// Request-time health check: proves the deployed server is live, which commit it runs, and how long
// this process has been up (a free-plan instance that slept would report a fresh uptime). Never queries the DB.
export async function GET() {
  await connection();
  return Response.json({
    ok: true,
    service: "hawker",
    commit: process.env.RENDER_GIT_COMMIT ?? null,
    time: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
  });
}
