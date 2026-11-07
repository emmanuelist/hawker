// SessionStart hook: tells every session how much time is left and which phase the build is in.
// Reads "Build window: <event start> → <deadline>" and, optionally, "Started: <when you began>"
// from docs/PLAN.md. Times need a timezone: 2026-11-04T12:00Z, 2026-11-04 12:00 UTC or
// 2026-11-04 13:00 +01:00. Checkpoints match the hackathon skill's clock. It never fails the session.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const dir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const H = 3_600_000;
const TIME = /(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?) ?(Z|UTC|[+-]\d{2}:?\d{2})/gi;
const times = (line) => [...(line ?? "").matchAll(TIME)].map(([, d, t, z]) => {
  z = z.toUpperCase();
  const zone = z === "UTC" ? "Z" : z.length === 5 && z !== "Z" ? `${z.slice(0, 3)}:${z.slice(3)}` : z;
  return Date.parse(`${d}T${t}${zone}`);
});
const span = (ms) => {
  const m = Math.round(Math.abs(ms) / 60_000);
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60);
  return d ? `${d}d ${h}h` : `${h}h ${m % 60}m`;
};
const utc = (t) => new Date(t).toISOString().slice(0, 16).replace("T", " ") + " UTC";
const emit = (context) => process.stdout.write(JSON.stringify({
  systemMessage: context,
  hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: context },
}));

try {
  const plan = readFileSync(join(dir, "docs/PLAN.md"), "utf8");
  const [open, end] = times(plan.match(/^Build window:.*$/m)?.[0]);
  const [began] = times(plan.match(/^Started:.*$/m)?.[0]);
  const now = Date.now();
  if (!(open < end)) throw new Error("no valid Build window line");
  const late = began > open && began < end;
  const from = late ? began : open;
  const total = end - from;
  const freeze = Math.max(from + 0.8 * total, end - 48 * H);
  const target = end - Math.min(Math.max(0.1 * total, 2 * H), 24 * H);
  const used = Math.round(Math.max(0, Math.min(1, (now - from) / total)) * 100);
  const checkpoints = [[0.1, "rigged"], [0.4, "walking skeleton"], [0.65, "core claim"]];

  let phase;
  if (now >= end) phase = "deadline passed: read the rules before pushing anything";
  else if (now >= target) phase = `submit now: the internal target passed ${span(now - target)} ago`;
  else if (now >= freeze) phase = `frozen: only evidence, copy and resilience fixes on the demo path; submit by ${utc(target)}`;
  else if (now < from) phase = `${late ? "your build starts" : "the build window opens"} at ${utc(from)} (in ${span(from - now)})`;
  else {
    const next = checkpoints.find(([f]) => now < from + f * total);
    phase = next
      ? `next checkpoint "${next[1]}" at ${utc(from + next[0] * total)} (in ${span(from + next[0] * total - now)})`
      : `proof and polish; demo-path freeze at ${utc(freeze)} (in ${span(freeze - now)})`;
  }

  let state = "docs/STATE.md has never been committed";
  try {
    const ct = Number(execFileSync("git", ["log", "-1", "--format=%ct", "--", "docs/STATE.md"],
      { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim());
    if (ct) state = `docs/STATE.md last committed ${span(now - ct * 1000)} ago`;
  } catch {}

  const left = now < end ? `${span(end - now)} to the deadline (${utc(end)})` : `deadline passed ${span(now - end)} ago`;
  const basis = late ? `, counted from your start at ${utc(from)}` : "";
  emit(`Clock ${utc(now)}: ${left}, ${used}% of the build window used${basis}. ${phase[0].toUpperCase()}${phase.slice(1)}. ${state}.`);
} catch {
  emit("Clock: docs/PLAN.md needs a line like 'Build window: 2026-11-04 12:00 UTC → 2026-12-06 23:59 UTC' (two times, each with a timezone), so time left is unknown. Add it.");
}
