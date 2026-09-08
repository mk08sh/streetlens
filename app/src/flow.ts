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

/** Latest count day at a station on or before a date. */
export function latestDay(fl: Flow, bid: string, date: string): { date: string; sd: StationDay } | null {
  const days = fl.station_days[bid]; if (!days) return null
  let best: string | null = null
  for (const d of Object.keys(days)) if (d <= date && (best == null || d > best)) best = d
  return best ? { date: best, sd: days[best] } : null
}

export type LaneValue = { rate: number | null; basis: string }  // rate = per hour

/** Rate per hour for a lane on a stretch at the cursor and granularity. Honest about what it is based on. */
export function laneRate(fl: Flow, segId: string, mode: Mode, dir: Dir, c: Cursor, g: Gran): LaneValue {
  const seg = fl.segments.find(s => s.id === segId)!
  const date = cursorDate(c), ym = cursorYm(c)
  // Bicycles from a permanent counter if the stretch has one.
  if (mode === 'bike' && fl.counters_hourly[`${segId}|${dir}`]) {
    const hrs = fl.counters_hourly[`${segId}|${dir}`], dly = fl.counters_daily[`${segId}|${dir}`]
    if (g === 'hour') { const arr = hrs[ym]; const v = arr?.[c.h]; return { rate: v ?? null, basis: v == null ? 'counter has no data for this month' : `counter, weekday average for this hour in ${ym}` } }
    if (g === 'day') { const v = dly[date]; return { rate: v == null ? null : v / 24, basis: v == null ? 'counter has no data for this day' : 'counter, this day' } }
    const keys = Object.keys(dly).filter(d => g === 'month' ? d.startsWith(ym) : d.startsWith(String(c.y)))
    const vals = keys.map(d => dly[d]).filter((v): v is number => v != null)
    return { rate: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length / 24 : null, basis: vals.length ? `counter, average day in ${g === 'month' ? ym : c.y} (${vals.length} days)` : 'counter has no data for this period' }
  }
  // Everything else from the count day at the entering intersection: eastbound enters at the west end (to), westbound at the east end (from).
  const bid = dir === 'eb' ? seg.to : seg.from
  const ld = latestDay(fl, bid, g === 'hour' || g === 'day' ? date : g === 'month' ? `${ym}-${pad(daysIn(c.y, c.m))}` : `${c.y}-12-31`)
  if (!ld) return { rate: null, basis: 'no City count at this intersection yet' }
  const key = (mode === 'ped' ? 'ped' : `${mode}_${dir}`) as keyof StationDay
  const arr = ld.sd[key] as number[]
  const counted = ld.sd.counted
  const hours = counted.filter(Boolean).length || 1
  if (g === 'hour') { if (!counted[c.h]) return { rate: null, basis: `count day ${ld.date} did not cover ${pad(c.h)}:00` }; const v = arr[c.h] * (mode === 'ped' ? 0.5 : 1); return { rate: v, basis: `City count on ${ld.date}, this hour` } }
  const total = arr.reduce((a, b) => a + b, 0) * (mode === 'ped' ? 0.5 : 1)
  return { rate: total / hours, basis: `City count on ${ld.date}, average of ${hours} counted hours` }
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
