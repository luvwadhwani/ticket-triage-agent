'use client';
// bar menu v1. The canonical copy lives in luvwadhwani/portfolio-hub (components/BarMenu.tsx). Copy it unchanged into each project.
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

/** A top-bar button that opens a small panel under it. Escape, a click elsewhere or a choice inside closes it. */
export function BarMenu({ label, className, trigger, children }: { label: string; className: string; trigger: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useId();

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  return (
    <div className={`lw-menu-wrap ${className}`} ref={wrap}>
      <button ref={button} type="button" className="lw-menu-button" aria-label={label} aria-expanded={open} aria-controls={panel} onClick={() => setOpen((o) => !o)}>
        {trigger}
      </button>
      <div
        id={panel}
        className="lw-menu"
        hidden={!open}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('a, button')) setOpen(false);
        }}
      >
        {children}
      </div>
    </div>
  );
}
