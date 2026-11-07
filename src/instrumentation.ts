// Runs once when the Next.js server starts (node_modules/next/dist/docs/.../instrumentation.md).
// Starts the hold scheduler in the Node.js runtime only.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScheduler } = await import("./lib/service/scheduler");
    await startScheduler();
  }
}
