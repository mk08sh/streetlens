export type StationDay = { veh_eb: number[]; veh_wb: number[]; bus_eb: number[]; bus_wb: number[]; bike_eb: number[]; bike_wb: number[]; ped: number[]; bins: number; counted: boolean[] }
export type Flow = {
  built: string
  boundaries: { id: string; station: string; cross_street: string; pos_m: number }[]
  segments: { id: string; name: string; from: string; to: string }[]
  station_days: Record<string, Record<string, StationDay>>
  counters_hourly: Record<string, Record<string, (number | null)[]>>
  counters_daily: Record<string, Record<string, number | null>>
  subway: Record<string, number | null>
  cross_streets: { name: string; pos_m: number; px: string | null }[]
  notes: Record<string, string>
}
export type Gran = 'hour' | 'day' | 'month' | 'year'
export const GRANS: Gran[] = ['year', 'month', 'day', 'hour']
export type Mode = 'ped' | 'bike' | 'veh' | 'bus'
export type Dir = 'eb' | 'wb'

/** A cursor is a full timestamp; granularity decides which part the slider moves. */
export type Cursor = { y: number; m: number; d: number; h: number }
export const pad = (n: number) => String(n).padStart(2, '0')
export const cursorYm = (c: Cursor) => `${c.y}-${pad(c.m)}`
export const cursorDate = (c: Cursor) => `${c.y}-${pad(c.m)}-${pad(c.d)}`
export const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate()
export function label(c: Cursor, g: Gran) {
  const mon = new Date(Date.UTC(c.y, c.m - 1, c.d)).toLocaleDateString('en-CA', { month: 'short', timeZone: 'UTC' })
  if (g === 'year') return `${c.y}`
  if (g === 'month') return `${mon} ${c.y}`
  if (g === 'day') return `${new Date(Date.UTC(c.y, c.m - 1, c.d)).toLocaleDateString('en-CA', { weekday: 'short', timeZone: 'UTC' })} ${c.d} ${mon} ${c.y}`
  return `${c.d} ${mon} ${c.y}, ${pad(c.h)}:00`
}

/** Per-dataset caches so slider steps do not rescan the archive. */
const dayKeys = new WeakMap<Flow, Record<string, string[]>>()
const counterIndex = new WeakMap<Flow, Record<string, Record<string, number[]>>>()  // key -> 'YYYY' | 'YYYY-MM' -> values
function sortedDays(fl: Flow, bid: string) {
  let m = dayKeys.get(fl); if (!m) { m = {}; dayKeys.set(fl, m) }
  return m[bid] ?? (m[bid] = Object.keys(fl.station_days[bid] ?? {}).sort())
}
function counterPeriods(fl: Flow, key: string) {
  let m = counterIndex.get(fl); if (!m) { m = {}; counterIndex.set(fl, m) }
  if (!m[key]) { const idx: Record<string, number[]> = {}; for (const [d, v] of Object.entries(fl.counters_daily[key] ?? {})) { if (v == null) continue; (idx[d.slice(0, 7)] ??= []).push(v); (idx[d.slice(0, 4)] ??= []).push(v) } m[key] = idx }
  return m[key]
}

/** Latest count day at a station on or before a date. */
export function latestDay(fl: Flow, bid: string, date: string): { date: string; sd: StationDay } | null {
  const days = sortedDays(fl, bid); if (!days.length) return null
  let lo = 0, hi = days.length - 1, best = -1
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (days[mid] <= date) { best = mid; lo = mid + 1 } else hi = mid - 1 }
  return best >= 0 ? { date: days[best], sd: fl.station_days[bid][days[best]] } : null
}

export type LaneValue = { rate: number | null; basis: string; source: 'counter' | 'count' | 'none'; date?: string }  // rate = per hour

/** Rate per hour for a lane on a stretch at the cursor and granularity. Honest about what it is based on. */
export function laneRate(fl: Flow, segId: string, mode: Mode, dir: Dir, c: Cursor, g: Gran): LaneValue {
  const seg = fl.segments.find(s => s.id === segId)!
  const date = cursorDate(c), ym = cursorYm(c)
  // Bicycles from a permanent counter if the stretch has one.
  if (mode === 'bike' && fl.counters_hourly[`${segId}|${dir}`]) {
    const hrs = fl.counters_hourly[`${segId}|${dir}`], dly = fl.counters_daily[`${segId}|${dir}`]
    if (g === 'hour') { const arr = hrs[ym]; const v = arr?.[c.h]; return { rate: v ?? null, source: v == null ? 'none' : 'counter', basis: v == null ? 'counter has no data for this month' : `counter, weekday average for this hour in ${ym}` } }
    if (g === 'day') { const v = dly[date]; return { rate: v == null ? null : v / 24, source: v == null ? 'none' : 'counter', basis: v == null ? 'counter has no data for this day' : 'counter, this day' } }
    const vals = counterPeriods(fl, `${segId}|${dir}`)[g === 'month' ? ym : String(c.y)] ?? []
    return { rate: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length / 24 : null, source: vals.length ? 'counter' : 'none', basis: vals.length ? `counter, average day in ${g === 'month' ? ym : c.y} (${vals.length} days)` : 'counter has no data for this period' }
  }
  // Everything else from the count day at the entering intersection: eastbound enters at the west end (to), westbound at the east end (from).
  const bid = dir === 'eb' ? seg.to : seg.from
  const ld = latestDay(fl, bid, g === 'hour' || g === 'day' ? date : g === 'month' ? `${ym}-${pad(daysIn(c.y, c.m))}` : `${c.y}-12-31`)
  if (!ld) return { rate: null, source: 'none', basis: 'no City count at this intersection yet' }
  const key = (mode === 'ped' ? 'ped' : `${mode}_${dir}`) as keyof StationDay
  const arr = ld.sd[key] as number[]
  const counted = ld.sd.counted
  const hours = counted.filter(Boolean).length || 1
  if (g === 'hour') { if (!counted[c.h]) return { rate: null, source: 'none', basis: `count day ${ld.date} did not cover ${pad(c.h)}:00` }; const v = arr[c.h] * (mode === 'ped' ? 0.5 : 1); return { rate: v, source: 'count', date: ld.date, basis: `City count on ${ld.date}, this hour` } }
  const total = arr.reduce((a, b) => a + b, 0) * (mode === 'ped' ? 0.5 : 1)
  return { rate: total / hours, source: 'count', date: ld.date, basis: `City count on ${ld.date}, average of ${hours} counted hours` }
}

/** Corridor-wide references so density means the same on every stretch: the busiest measured hour, and the busiest
 *  count-day average, per mode. Hour views use the first, averaged views the second. */
export function modeReference(fl: Flow): { hour: Record<Mode, number>; avg: Record<Mode, number> } {
  const hour: Record<Mode, number> = { ped: 1, bike: 1, veh: 1, bus: 1 }, avg: Record<Mode, number> = { ped: 1, bike: 1, veh: 1, bus: 1 }
  for (const days of Object.values(fl.station_days)) for (const sd of Object.values(days)) {
    const hours = sd.counted.filter(Boolean).length || 1
    for (const m of ['veh', 'bus', 'bike'] as const) for (const dir of ['eb', 'wb'] as const) { const arr = sd[`${m}_${dir}`]; hour[m] = Math.max(hour[m], ...arr); avg[m] = Math.max(avg[m], arr.reduce((a, b) => a + b, 0) / hours) }
    hour.ped = Math.max(hour.ped, ...sd.ped.map(v => v * 0.5)); avg.ped = Math.max(avg.ped, (sd.ped.reduce((a, b) => a + b, 0) * 0.5) / hours)
  }
  for (const hrs of Object.values(fl.counters_hourly)) for (const arr of Object.values(hrs)) hour.bike = Math.max(hour.bike, ...arr.map(v => v ?? 0))
  for (const dly of Object.values(fl.counters_daily)) for (const v of Object.values(dly)) if (v != null) avg.bike = Math.max(avg.bike, v / 24)
  return { hour, avg }
}
