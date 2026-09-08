import type { Corridor, Tmc } from './types'

export const fmt = (n: number | null | undefined, digits = 0) => (n == null || Number.isNaN(n) ? '—' : n.toLocaleString('en-CA', { maximumFractionDigits: digits }))
export const pct = (a: number | null, b: number | null) => (a == null || b == null || b === 0 ? null : ((a - b) / b) * 100)
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const monthLabel = (ym: string) => `${MONTHS[parseInt(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`
export const monthEnd = (ym: string) => { const [y, m] = ym.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10) }
export const monthsBetween = (a: string, b: string) => { const out: string[] = []; let [y, m] = a.split('-').map(Number); const [ey, em] = b.split('-').map(Number); while (y < ey || (y === ey && m <= em)) { out.push(`${y}-${String(m).padStart(2, '0')}`); m++; if (m > 12) { m = 1; y++ } } return out }

/** Latest turning-movement count at a boundary on or before `date`. */
export function latestTmc(c: Corridor, boundaryId: string, date: string): Tmc | null {
  let best: Tmc | null = null
  for (const t of c.tmc[boundaryId] ?? []) if (t.date <= date && t.veh != null) best = t
  return best
}
/** Latest count strictly before a year, used for "then vs now". */
export function tmcBefore(c: Corridor, boundaryId: string, before: string): Tmc | null {
  let best: Tmc | null = null
  for (const t of c.tmc[boundaryId] ?? []) if (t.date < before && t.veh != null && (t.bike ?? 0) > 0) best = t
  return best
}

/** Mean daily bicycles (both directions) for a counter in a month. */
export function counterMonth(c: Corridor, segId: string, ym: string) {
  const cs = c.counters.filter(k => k.segment === segId)
  if (!cs.length) return { value: null as number | null, days: 0, hasCounter: false, name: '' }
  let sum = 0, n = 0
  for (const k of cs) for (const [d, eb, wb] of k.daily) if (d.startsWith(ym) && (eb != null || wb != null)) { sum += (eb ?? 0) + (wb ?? 0); n++ }
  return { value: n ? sum / n : null, days: n, hasCounter: true, name: cs.map(k => k.name).join('; ') }
}
/** Mean bicycles/day per counter for a month; a counter needs 10+ days to count. */
export function countersMonth(c: Corridor, ym: string) {
  const out: Record<string, number> = {}
  for (const k of c.counters) { let s = 0, m = 0; for (const [d, eb, wb] of k.daily) if (d.startsWith(ym) && (eb != null || wb != null)) { s += (eb ?? 0) + (wb ?? 0); m++ } if (m >= 10) out[k.name] = s / m }
  return out
}
/** Same calendar month, same counters: the only fair corridor-wide bicycle comparison available. */
export function bikesSameMonth(c: Corridor, ym: string) {
  const now = countersMonth(c, ym)
  for (let y = 2022; y < parseInt(ym.slice(0, 4)); y++) {
    const then = countersMonth(c, `${y}${ym.slice(4)}`); const shared = Object.keys(now).filter(k => k in then)
    if (shared.length >= 2) return { thenYm: `${y}${ym.slice(4)}`, counters: shared.length, now: shared.reduce((a, k) => a + now[k], 0) / shared.length, then: shared.reduce((a, k) => a + then[k], 0) / shared.length }
  }
  const all = Object.values(now); return { thenYm: null, counters: all.length, now: all.length ? all.reduce((a, b) => a + b, 0) / all.length : null, then: null }
}
export const lastCounterMonth = (c: Corridor) => c.coverage.counters ? c.coverage.counters[1].slice(0, 7) : c.corridor.snapshot.slice(0, 7)
/** Latest month with both counter and collision records: the honest landing month. */
export const defaultMonth = (c: Corridor) => { const a = lastCounterMonth(c), b = c.coverage.tps?.[1] ?? a; return a < b ? a : b }

export const tpsCovers = (c: Corridor, ym: string) => !!c.coverage.tps && ym >= c.coverage.tps[0] && ym <= c.coverage.tps[1]
export const ksiCovers = (c: Corridor, ym: string) => !!c.coverage.ksi && ym >= c.coverage.ksi[0].slice(0, 7) && ym <= c.coverage.ksi[1].slice(0, 7)
export const delaysCover = (c: Corridor, ym: string) => !!c.coverage.subway_delays && ym >= c.coverage.subway_delays[0].slice(0, 7) && ym <= c.coverage.subway_delays[1].slice(0, 7)
export const weatherCovers = (c: Corridor, ym: string) => !!c.coverage.weather && ym >= c.coverage.weather[0].slice(0, 7) && ym <= c.coverage.weather[1].slice(0, 7)

export function tpsMonth(c: Corridor, segId: string, ym: string) { return c.tps[segId]?.[ym] ?? { total: 0, injury: 0, bicycle: 0, pedestrian: 0, ftr: 0 } }
export function tpsRange(c: Corridor, segId: string | null, from: string, to: string) {
  let total = 0, injury = 0, bicycle = 0, pedestrian = 0
  const segs = segId ? [segId] : Object.keys(c.tps)
  for (const s of segs) for (const [ym, m] of Object.entries(c.tps[s] ?? {})) if (ym >= from && ym <= to) { total += m.total; injury += m.injury; bicycle += m.bicycle; pedestrian += m.pedestrian }
  return { total, injury, bicycle, pedestrian }
}
export function ksiMonth(c: Corridor, segId: string, ym: string) { return (c.ksi[segId] ?? []).filter(k => k.date.startsWith(ym)) }
export function weatherMonth(c: Corridor, ym: string) {
  const days = c.weather.filter(w => w.date.startsWith(ym))
  const count = (k: string) => days.filter(w => w.cond.includes(k)).length
  const t = days.map(w => w.tmean).filter((x): x is number => x != null)
  return { days: days.length, rain: count('rain'), snow: count('snow'), fog: count('fog'), freezing: count('freezing'), freezing_rain: count('freezing_rain'), heat: count('heat'), deep_cold: count('deep_cold'), tmean: t.length ? t.reduce((a, b) => a + b, 0) / t.length : null, precip: days.reduce((a, w) => a + w.precip, 0) }
}
export function restrictionsMonth(c: Corridor, segId: string, ym: string) {
  const s = `${ym}-01`, e = monthEnd(ym)
  return c.restrictions.filter(r => r.segment === segId && (!r.end || r.end >= s) && (!r.start || r.start <= e))
}
export function delaysMonth(c: Corridor, boundaryId: string, ym: string) { return c.subway_delays[boundaryId]?.[ym] ?? { count: 0, minutes: 0 } }
export function usage(c: Corridor, boundaryId: string) {
  const u = c.subway_usage; if (!u) return null
  const st = u.stations[boundaryId]; if (!st) return null
  const periods = Object.keys(u.periods).sort()
  return { periods, values: periods.map(p => st[p] as number), covers: periods.map(p => u.periods[p].covers), note: st.note as string | undefined, sources: periods.map(p => u.periods[p].source) }
}

/** Per-segment state for a month, used by the map. Neutral facts only. */
export function segmentState(c: Corridor, segId: string, ym: string) {
  const s = c.segments.find(x => x.id === segId)!
  const end = monthEnd(ym)
  const a = latestTmc(c, s.from, end), b = latestTmc(c, s.to, end)
  const people = a && b ? ((a.people ?? 0) + (b.people ?? 0)) / 2 : a?.people ?? b?.people ?? null
  const pms = [a?.pm_peak_veh, b?.pm_peak_veh].filter((v): v is number => v != null && v > 0)
  const pm = pms.length ? pms.reduce((x, y) => x + y, 0) / pms.length : null
  const works = restrictionsMonth(c, segId, ym).length
  const t = tpsCovers(c, ym) ? tpsMonth(c, segId, ym) : null
  const injury = t ? t.injury : null
  const collisions = t ? t.total : null, colBike = t ? t.bicycle : null, colPed = t ? t.pedestrian : null
  const ksi = ksiCovers(c, ym) ? ksiMonth(c, segId, ym).length : null
  const delays = delaysCover(c, ym) ? delaysMonth(c, s.from, ym).count + delaysMonth(c, s.to, ym).count : null
  const bikes = counterMonth(c, segId, ym)
  return { people, pm, works, injury, collisions, colBike, colPed, ksi, delays, bikes: bikes.value, hasCounter: bikes.hasCounter }
}

export type WeatherIcon = 'snow' | 'rain' | 'fog' | 'heat' | 'cloud' | 'sun' | 'freezing'
export function weatherIcon(w: ReturnType<typeof weatherMonth>): WeatherIcon | null {
  if (!w.days) return null
  if (w.snow >= 5) return 'snow'
  if (w.freezing_rain >= 1 && w.snow >= 2) return 'freezing'
  if (w.rain >= 12) return 'rain'
  if (w.heat >= 5) return 'heat'
  if (w.fog >= 15) return 'fog'
  if (w.rain >= 6) return 'cloud'
  return 'sun'
}

/** ---------- Context: what "usual" means, so a number can be read by a person ---------- */
export const prevYear = (ym: string) => `${parseInt(ym.slice(0, 4)) - 1}${ym.slice(4)}`
const prevMonths = (ym: string, n: number) => { const out: string[] = []; let [y, m] = ym.split('-').map(Number); for (let i = 0; i < n; i++) { m--; if (m < 1) { m = 12; y-- } out.push(`${y}-${String(m).padStart(2, '0')}`) } return out }
const median = (a: number[]) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] }

export type Verdict = 'fewer' | 'usual' | 'more' | null
export function verdict(now: number | null, usual: number | null, tol = 0.25): Verdict {
  if (now == null || usual == null) return null
  if (usual === 0) return now === 0 ? 'usual' : 'more'
  const r = now / usual; return r < 1 - tol ? 'fewer' : r > 1 + tol ? 'more' : 'usual'
}
/** Percent phrase like "34% fewer than Jul 2025" or "about the same as Jul 2025". */
export function compare(now: number | null, then: number | null, label: string) {
  if (now == null || then == null) return null
  if (then === 0) return now === 0 ? `none, same as ${label}` : `up from none in ${label}`
  const p = Math.round(((now - then) / then) * 100)
  if (Math.abs(p) < 8) return `about the same as ${label}`
  return `${Math.abs(p)}% ${p > 0 ? 'more' : 'fewer'} than ${label}`
}

/** Collisions this month vs the median of the previous 24 covered months, per segment or whole street. */
export function collisionsUsual(c: Corridor, segId: string | null, ym: string) {
  const months = prevMonths(ym, 24).filter(m => tpsCovers(c, m))
  const val = (m: string) => segId ? tpsMonth(c, segId, m).total : tpsRange(c, null, m, m).total
  return months.length >= 6 ? median(months.map(val)) : null
}
export function bikesLastYear(c: Corridor, segId: string | null, ym: string) {
  const ly = prevYear(ym)
  if (segId) { const a = counterMonth(c, segId, ym), b = counterMonth(c, segId, ly); return a.value != null && b.value != null ? { now: a.value, then: b.value } : null }
  const a = countersMonth(c, ym), b = countersMonth(c, ly); const shared = Object.keys(a).filter(k => k in b)
  return shared.length ? { now: shared.reduce((s, k) => s + a[k], 0) / shared.length, then: shared.reduce((s, k) => s + b[k], 0) / shared.length } : null
}
export function delaysUsual(c: Corridor, boundaryIds: string[], ym: string) {
  const months = prevMonths(ym, 12).filter(m => delaysCover(c, m))
  return months.length >= 3 ? median(months.map(m => boundaryIds.reduce((a, b) => a + delaysMonth(c, b, ym === m ? m : m).count, 0))) : null
}
export function weatherLastYear(c: Corridor, ym: string) { const w = weatherMonth(c, prevYear(ym)); return w.days ? w : null }
/** Which segments were the worst for collisions this month, in words. */
export function rankSegments(c: Corridor, ym: string) {
  if (!tpsCovers(c, ym)) return null
  return c.segments.map(s => ({ s, n: tpsMonth(c, s.id, ym).total, perKm: tpsMonth(c, s.id, ym).total / (s.length_m / 1000) })).sort((a, b) => b.n - a.n)
}
