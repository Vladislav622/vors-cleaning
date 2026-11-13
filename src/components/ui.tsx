"use client";

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <span className="switch">
      <input type="checkbox" role="switch" aria-label={label} checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span aria-hidden />
    </span>
  );
}

export function Stepper({ value, min, max, onChange, label, size }: { value: number; min: number; max: number; onChange: (v: number) => void; label: string; size?: "sm" }) {
  const s = size === "sm" ? { width: 38, height: 38 } : undefined;
  return (
    <span className="stepper" role="group" aria-label={label}>
      <button type="button" style={s} aria-label="Меньше" disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>
        −
      </button>
      <output aria-live="polite">{value}</output>
      <button type="button" style={s} aria-label="Больше" disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>
        +
      </button>
    </span>
  );
}
