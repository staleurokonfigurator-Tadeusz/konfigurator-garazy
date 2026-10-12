"use client";

import { useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
import { normalizeDimension } from '@/lib/garageExtras';

interface Props { label: string; value: number; min: number; max: number; step?: number; readOnly?: boolean; onChange: (value: number) => void }
export default function EditableDimension({ label, value, min, max, step = 10, readOnly, onChange }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const cancelled = useRef(false);
  if (readOnly) return <span className="font-bold text-[var(--theme)]">{value} cm</span>;
  return editing ? (
    <div className="max-w-[190px] text-right">
      <input autoFocus type="number" inputMode="decimal" aria-label={`${label} (cm)`} min={min} max={max} step={step}
        value={draft} onChange={event => setDraft(event.target.value)} onFocus={event => event.currentTarget.select()}
        onKeyDown={event => {
          if (event.key === 'Escape') { cancelled.current = true; setEditing(false); }
          if (event.key === 'Enter') event.currentTarget.blur();
        }}
        onBlur={() => {
          const next = normalizeDimension(draft, min, max, step);
          if (!cancelled.current && next !== null && next !== value) onChange(next);
          setEditing(false);
        }}
        className="w-28 max-w-full rounded-lg border border-zinc-400 bg-white px-2 py-2 text-right text-base font-bold text-zinc-900" />
      <span className="mt-1 block text-xs font-normal text-zinc-500">{min}–{max} cm, co {step} cm</span>
    </div>
  ) : (
    <button type="button" aria-label={`Edytuj: ${label}`} title="Kliknij, aby wpisać wymiar"
      onClick={() => { cancelled.current = false; setDraft(String(value)); setEditing(true); }}
      className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 font-bold text-[var(--theme)]">
      {value} cm <Pencil size={13} aria-hidden="true" />
    </button>
  );
}
