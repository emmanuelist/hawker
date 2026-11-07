// The time left as a numbering machine's wheels: minutes and seconds each in their own box, readable
// at a glance. The text equivalent rides on aria-label; the timer doesn't announce every second.
export function Countdown({ ms, tone = "ink", size = "md" }: { ms: number; tone?: "ink" | "expiring" | "rail"; size?: "sm" | "md" | "lg" }) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return (
    <span className="wheels" data-tone={tone} data-size={size} role="timer" aria-live="off" aria-label={`${m} min ${s} s left`}>
      <span className="wheel" aria-hidden="true">
        {String(m).padStart(2, "0")}
      </span>
      <span className="wheel-sep" aria-hidden="true">
        :
      </span>
      <span className="wheel" aria-hidden="true">
        {String(s).padStart(2, "0")}
      </span>
    </span>
  );
}
