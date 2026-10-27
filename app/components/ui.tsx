"use client";
import { ReactNode, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";

export function IridescentButton({ children, state = "idle", onClick, disabled, type = "button", className = "" }: {
  children: ReactNode; state?: "idle" | "loading" | "success"; onClick?: () => void; disabled?: boolean; type?: "button" | "submit"; className?: string;
}) {
  return (
    <button type={type} onClick={onClick} disabled={disabled || state === "loading"} data-state={state}
      className={`rim h-14 px-8 text-[16px] ${className}`}>
      {children}
    </button>
  );
}

export function SegmentedControl<T extends string>({ value, onChange, options, label }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="seg">
      <span className="seg-ind" aria-hidden="true" />
      {options.map((o) => (
        <button key={o.value} role="tab" type="button" aria-selected={value === o.value} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

/** Digits roll only when the value changes. */
export function Odometer({ value, className = "" }: { value: string; className?: string }) {
  const prev = useRef(value);
  const [changed, setChanged] = useState<boolean[]>([]);
  useEffect(() => {
    const p = prev.current;
    setChanged(value.split("").map((ch, i) => p[i] !== ch));
    prev.current = value;
  }, [value]);
  return (
    <span className={`mono inline-flex ${className}`} aria-label={value}>
      {value.split("").map((ch, i) => (
        <motion.span key={`${i}-${ch}`} aria-hidden="true" initial={changed[i] ? { y: "35%", opacity: 0 } : false} animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 30 }} style={{ display: "inline-block" }}>{ch}</motion.span>
      ))}
    </span>
  );
}

export function Panel({ children, className = "", as: Tag = "section", ...rest }: { children: ReactNode; className?: string; as?: any; [k: string]: any }) {
  return <Tag className={`panel ${className}`} {...rest}>{children}</Tag>;
}

export function ExampleNote({ show }: { show: boolean }) {
  if (!show) return null;
  return <p className="text-[13px] text-bone-dim">Example numbers. Connect to a live round to see real ones.</p>;
}
