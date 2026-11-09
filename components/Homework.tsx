import Link from 'next/link';
import { GRADES, HW_STATUS, hwStatus, type Homework } from '@/lib/files';
import { fmtDay, fmtWhen } from '@/lib/dates';
import { ActionForm, Submit } from '@/components/forms';
import { assignHomework, deleteHomework, reviewHomework, submitHomework } from '@/app/app/study-actions';

export type HwRow = Homework & { lastName?: string; firstName?: string };

export function HwCard({ h, today, student, owner }: { h: HwRow; today: string; student?: boolean; owner?: boolean }) {
  const st = hwStatus(h, today);
  const canAnswer = student && ['new', 'late', 'redo'].includes(st);
  return (
    <article className="panel stack" style={{ gap: 10 }}>
      <div className="row between" style={{ alignItems: 'flex-start' }}>
        <div>
          {owner && h.lastName ? <div className="small muted">{h.lastName} {h.firstName}</div> : null}
          <h3>{h.title}</h3>
          <div className="small muted">задано {fmtDay(h.createdAt, false)}{h.due ? ` · сдать до ${fmtDay(h.due)}` : ''}</div>
        </div>
        <span className={'chip ' + HW_STATUS[st][1]}>{HW_STATUS[st][0]}</span>
      </div>
      {h.task ? <p className="pre">{h.task}</p> : null}
      {h.link ? <a href={h.link} target="_blank" rel="noopener noreferrer" className="small" style={{ overflowWrap: 'anywhere' }}>{h.link}</a> : null}

      {h.answeredAt ? (
        <div className="answer">
          <div className="label">Ответ · {fmtWhen(h.answeredAt)}</div>
          {h.answer ? <p className="pre">{h.answer}</p> : null}
          {h.answerLink ? <a href={h.answerLink} target="_blank" rel="noopener noreferrer" className="small" style={{ overflowWrap: 'anywhere' }}>{h.answerLink}</a> : null}
        </div>
      ) : null}
      {h.reviewedAt ? (
        <div className="answer review-box">
          <div className="row between"><div className="label">Проверка преподавателя</div>{h.grade ? <span className="grade">{h.grade}</span> : null}</div>
          {h.review ? <p className="pre">{h.review}</p> : null}
        </div>
      ) : null}

      {canAnswer ? (
        <details open={!h.answeredAt}>
          <summary className="btn sm" style={{ listStyle: 'none', display: 'inline-flex' }}>{st === 'redo' ? 'Отправить исправленный ответ' : 'Ответить'}</summary>
          <ActionForm action={submitHomework} submit="Сдать задание" pending="Отправляем…" className="stack" >
            <input type="hidden" name="id" value={h.id} />
            <label className="field"><span>Ответ</span><textarea name="answer" rows={5} maxLength={10000} defaultValue={h.answer || ''} lang="ja" /></label>
            <label className="field"><span>Ссылка на файл или фото (необязательно)</span><input type="url" name="answerLink" defaultValue={h.answerLink} placeholder="https://disk.yandex.ru/…" /></label>
          </ActionForm>
        </details>
      ) : null}

      {owner ? (
        <div className="stack" style={{ gap: 8 }}>
          {h.answeredAt ? (
            <details open={!h.reviewedAt}>
              <summary className="btn sm" style={{ listStyle: 'none', display: 'inline-flex' }}>{h.reviewedAt ? 'Изменить проверку' : 'Проверить'}</summary>
              <ActionForm action={reviewHomework} submit="Сохранить проверку" pending="…" className="stack">
                <input type="hidden" name="id" value={h.id} />
                <div className="choices">{GRADES.map(g => <label key={g} className="gchip"><input type="radio" name="grade" value={g} defaultChecked={h.grade === g} />{g}</label>)}</div>
                <label className="field"><span>Комментарий</span><textarea name="review" rows={3} defaultValue={h.review} /></label>
              </ActionForm>
            </details>
          ) : null}
          <form action={deleteHomework}><input type="hidden" name="id" value={h.id} /><Submit className="btn ghost sm danger" pending="…">Удалить задание</Submit></form>
        </div>
      ) : null}
    </article>
  );
}

export function OwnerHomeworkView({ active, toCheck, waiting, done, today, fixedStudent }: {
  active: { id: string; name: string }[]; toCheck: HwRow[]; waiting: HwRow[]; done: HwRow[]; today: string; fixedStudent?: string;
}) {
  return (
    <div className="stack">
      <section className="panel stack">
        <h2>Задать задание</h2>
        {active.length ? (
          <ActionForm action={assignHomework} submit="Задать" pending="…">
            {fixedStudent ? <input type="hidden" name="studentId" value={fixedStudent} /> : (
              <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
                <legend className="small muted" style={{ marginBottom: 6 }}>Кому (можно нескольким)</legend>
                <div className="choices">{active.map(s => <label key={s.id} className="gchip"><input type="checkbox" name="studentId" value={s.id} />{s.name}</label>)}</div>
              </fieldset>
            )}
            <div className="fgrid">
              <label className="field" style={{ gridColumn: 'span 2' }}><span>Что задано</span><input type="text" name="title" required maxLength={200} placeholder="Урок 5: упражнения 1–3" /></label>
              <label className="field"><span>Сдать до</span><input type="date" name="due" /></label>
            </div>
            <label className="field"><span>Подробности</span><textarea name="task" rows={3} maxLength={5000} /></label>
            <label className="field"><span>Ссылка (необязательно)</span><input type="url" name="link" placeholder="https://" /></label>
          </ActionForm>
        ) : <p className="muted">Сначала примите хотя бы одного ученика.</p>}
      </section>
      <h2>На проверку <span className="muted num" style={{ fontWeight: 500 }}>{toCheck.length}</span></h2>
      {toCheck.length ? toCheck.map(h => <HwCard key={h.id} h={h} today={today} owner />) : <div className="empty">Нет сданных заданий, ждущих проверки.</div>}
      {waiting.length ? <details className="panel"><summary style={{ cursor: 'pointer', fontWeight: 600 }}>Ждут ответа · {waiting.length}</summary>
        <div className="stack" style={{ marginTop: 12 }}>{waiting.map(h => <HwCard key={h.id} h={h} today={today} owner />)}</div></details> : null}
      {done.length ? <details className="panel"><summary style={{ cursor: 'pointer', fontWeight: 600 }}>Проверенные · {done.length}</summary>
        <div className="stack" style={{ marginTop: 12 }}>{done.map(h => <HwCard key={h.id} h={h} today={today} owner />)}</div></details> : null}
      {!fixedStudent && active.length ? <p className="small muted">Задания одного ученика — в его профиле, вкладка «Задания». <Link href="/app">К ученикам</Link></p> : null}
    </div>
  );
}
