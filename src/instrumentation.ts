// Runs once when the Next.js server starts (node_modules/next/dist/docs/.../instrumentation.md).
// Starts the hold scheduler in the Node.js runtime only.
//
// HAWKER_SCHEDULER=off is for a local preview against the shared database while the deployed service
// runs: two schedulers would both expire the same holds and could promote the next buyer twice.
// Never set it on Render. With it off, holds created by the preview don't expire on their own.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.HAWKER_SCHEDULER === "off") {
    console.info(JSON.stringify({ scope: "scheduler", disabled: true }));
    return;
  }
  const { startScheduler } = await import("./lib/service/scheduler");
  await startScheduler();
}
