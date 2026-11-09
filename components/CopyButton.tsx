'use client';
import { useState } from 'react';

export function CopyButton({ text, label = 'Скопировать' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="btn sm" onClick={async () => {
      try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1800); } catch { /* браузер не дал доступ */ }
    }}>{done ? 'Скопировано' : label}</button>
  );
}
