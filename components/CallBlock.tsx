import type { CallInfo } from '@/lib/schedule';

/** Кнопка «Подключиться» к уроку или подсказка для Discord. */
export function CallButton({ info, className = 'btn' }: { info: CallInfo; className?: string }) {
  if (!info) return null;
  if (info.kind === 'discord') {
    return (
      <div className="stack" style={{ gap: 6 }}>
        {info.url ? <a className={className} href={info.url} target="_blank" rel="noopener noreferrer">Открыть Discord</a> : null}
        <span className="small">Созваниваемся в Discord{info.note ? `: ${info.note}` : ''}</span>
      </div>
    );
  }
  return <a className={className} href={info.url} target="_blank" rel="noopener noreferrer">Подключиться · {info.label}</a>;
}
