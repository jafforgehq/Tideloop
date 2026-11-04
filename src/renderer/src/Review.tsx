import { dayLabel } from '../../shared/dates'
import { review } from '../../shared/review'
import { formatMinutes } from '../../shared/tide'
import type { ISODate } from '../../shared/types'
import { useApp } from './context'

const colour = (n: number) => `var(--list-${n % 6})`

export function Review({ from, to, span }: { from: ISODate; to: ISODate; span: 'week' | 'month' }) {
  const app = useApp()
  const r = review(app.data, from, to)
  const stats: [string, string][] = [
    ['Finished', `${r.done.count} of ${r.planned.count} todos`],
    ['Time finished', formatMinutes(r.done.minutes)],
    ['Still open', `${r.planned.count - r.done.count} todos, ${formatMinutes(r.planned.minutes - r.done.minutes)}`],
    ['In meetings', formatMinutes(r.events)]
  ]
  return (
    <div className="week-scroll">
      <div className="review" data-review={span}>
        <dl className="stats">
          {stats.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        {r.planned.count === 0 ? (
          <p className="empty">No todos are planned in this {span}. Drag a todo onto a day and it shows up here.</p>
        ) : (
          <>
            <section aria-labelledby="by-list">
              <h2 id="by-list">By list</h2>
              <ul className="rows">
                {r.rows.map((row) => (
                  <li key={row.listId} data-list={row.name}>
                    <span className="dot" style={{ background: colour(row.color) }} />
                    <span className="name">{row.name}</span>
                    <span className="bar" role="img" aria-label={`${formatMinutes(row.minutes)} finished`}>
                      <span style={{ width: `${r.done.minutes ? (row.minutes / r.done.minutes) * 100 : 0}%`, background: colour(row.color) }} />
                    </span>
                    <span className="num">{formatMinutes(row.minutes)}</span>
                    <span className="num quiet">{row.done} of {row.total}</span>
                  </li>
                ))}
              </ul>
            </section>
            {r.top.length > 0 && (
              <section aria-labelledby="longest">
                <h2 id="longest">Longest finished</h2>
                <ul className="rows">
                  {r.top.map((t) => (
                    <li key={t.id}>
                      <span className="dot" style={{ background: colour(app.data.lists.find((l) => l.id === t.listId)?.color ?? 0) }} />
                      <button className="name link" onClick={() => app.edit({ kind: 'todo', id: t.id })}>{t.title}</button>
                      <span className="num quiet">{dayLabel(t.date!)}</span>
                      <span className="num">{formatMinutes(t.minutes)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
