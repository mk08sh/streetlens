import type { Corridor as C } from './types'
import { monthLabel } from './data'

type Props = { c: C; months: string[]; value: string; onChange: (ym: string) => void }
const KIND_LABEL: Record<string, string> = { 'bike-lane-installed': 'bike lane added', 'lane-reconfigured': 'lanes changed', 'bike-lane-removed': 'bike lane removed', legislation: 'provincial act', 'court-ruling': 'court ruling', announcement: 'province announces lane restoration' }

export function MonthSlider({ c, months, value, onChange }: Props) {
  const idx = months.indexOf(value)
  const W = 1180, padL = 10, padR = 10
  const x = (i: number) => padL + (i / (months.length - 1)) * (W - padL - padR)
  const years = months.map((m, i) => ({ m, i })).filter(o => o.m.endsWith('-01'))
  const events = c.events.filter(e => e.kind !== 'confounder').map(e => ({ e, i: months.indexOf(e.date.length >= 7 ? e.date.slice(0, 7) : `${e.date}-07`) })).filter(o => o.i >= 0)
  const here = events.filter(o => o.i === idx)
  return (
    <div className="monthslider">
      <div className="sliderrow">
        <button onClick={() => idx > 0 && onChange(months[idx - 1])} aria-label="previous month">‹</button>
        <div className="current">{monthLabel(value)}</div>
        <button onClick={() => idx < months.length - 1 && onChange(months[idx + 1])} aria-label="next month">›</button>
        <div className="track">
          <input type="range" min={0} max={months.length - 1} value={idx} onChange={e => onChange(months[parseInt(e.target.value)])} aria-label="month" />
          <svg viewBox={`0 0 ${W} 26`} className="sliderticks" preserveAspectRatio="none">
            {years.map(o => <g key={o.m}><line x1={x(o.i)} x2={x(o.i)} y1={0} y2={5} className="tick" /><text x={x(o.i)} y={16} textAnchor="middle" className="year">{o.m.slice(0, 4)}</text></g>)}
            {events.map(o => <g key={o.e.id} className={`evt ${o.e.status}`} onClick={() => onChange(months[o.i])}><title>{monthLabel(months[o.i])}: {KIND_LABEL[o.e.kind] ?? o.e.kind}{o.e.extent ? ` · ${o.e.extent}` : ''}</title><circle cx={x(o.i)} cy={22} r={3.5} /></g>)}
          </svg>
        </div>
      </div>
      {here.length > 0 && <div className="eventnote">{here.map(o => <span key={o.e.id}><b>{KIND_LABEL[o.e.kind] ?? o.e.kind}</b>{o.e.extent ? `, ${o.e.extent}` : ''}{o.e.status !== 'verified' ? ' (not yet verified)' : ''}. </span>)}</div>}
    </div>
  )
}
