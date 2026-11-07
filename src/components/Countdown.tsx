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

/** A count on a numbering machine's wheels: each digit is a column of 0–9 that rolls to its value
 *  when the count changes (reduced motion: it simply shows the value). */
export function NumberWheels({ value, digits = 2, tone = "ink", label }: { value: number; digits?: number; tone?: "ink" | "paid" | "passed"; label?: string }) {
  const text = String(Math.max(0, Math.floor(value))).padStart(digits, "0");
  return (
    <span className="numwheels" data-tone={tone} role="img" aria-label={label ?? String(value)}>
      {[...text].map((d, i) => (
        <span key={i} className="numwheel" aria-hidden="true">
          <span className="numwheel-strip" style={{ transform: `translateY(-${Number(d) * 10}%)` }}>
            {"0123456789".split("").map((n) => (
              <span key={n}>{n}</span>
            ))}
          </span>
        </span>
      ))}
    </span>
  );
}
