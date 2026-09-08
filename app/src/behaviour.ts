export type Bin = { lo: number; n: number; mean: number | null }
export type Q1 = { counter: string; segment: string; since: string; weekdays: number; dry_days: number; wet_days: number; dry_bins: Bin[]; wet_bins: Bin[]; per_degree: number | null; summer_mean: number | null; winter_mean: number | null; winter_retention_pct: number | null; rain_retention_pct: number | null }
export type Q2 = { counter: string; segment: string; days: number; eb: number[]; wb: number[]; peak_share_pct: number; am_eastbound_pct: number; pm_eastbound_pct: number; dry_hourly: number[] | null; wet_hourly: number[] | null; dry_days: number; wet_days: number }
export type Peak = { date: string; duration: string; am_start: string | null; pm_start: string | null; am_veh: number | null; pm_veh: number | null; veh: number | null; bike: number | null; ped: number | null }
export type ModeStation = { date: string; car: number; bike: number; foot: number; subway: number | null; hours: string }
export type ModeSeg = { car: number; bike: number; foot: number; subway: number; n: number }
export type KsiPattern = { n: number; impact: [string, number][]; user: [string, number][]; dark_pct: number | null; first: string; last: string }
export type DelayCauses = { months: number; total: number; top: { code: string; what: string; n: number; minutes: number }[] }
export type Parallel = { name: string; street: string; side: string; offset_m: number; date: string; veh: number | null; duration: string }
export type Behaviour = {
  built: string; weather_span: [string, string]; occupancy: number; parallel_streets: string[]
  q1_weather: Q1[]; q2_hours: Q2[]; q3_peaks: Record<string, Peak[]>
  q4_mode: { station: Record<string, ModeStation>; segment: Record<string, ModeSeg> }
  q5_conflicts: { ksi: Record<string, KsiPattern>; subway: Record<string, DelayCauses> }
  q6_parallel: Record<string, Parallel[]>
}
export const MODE_COLOURS = { car: '#5b6670', foot: '#c9a86a', bike: '#6a9bb5', subway: '#8b7a9e' }
export const MODE_LABEL = { car: 'in vehicles', foot: 'on foot', bike: 'on bicycles', subway: 'by subway' }
export const QUESTIONS = [
  { id: 'q1', short: 'Cold and rain', text: 'How do people on bicycles respond to cold and rain here?' },
  { id: 'q2', short: 'Time of day', text: 'When do people move through here, and which way?' },
  { id: 'q3', short: 'Rush hour', text: 'Is the rush hour starting earlier at these stations?' },
  { id: 'q4', short: 'What it is for', text: 'What is this stretch used for?' },
  { id: 'q5', short: 'Where design gets hit', text: 'Where does the design get hit, and how?' },
  { id: 'q6', short: 'Side streets', text: 'Does traffic move to the side streets?' },
] as const
export type QId = (typeof QUESTIONS)[number]['id']
export const minutes = (hhmm: string | null) => hhmm ? parseInt(hhmm.slice(0, 2)) * 60 + parseInt(hhmm.slice(3, 5)) : null
export const hhmm = (m: number) => `${Math.floor(m / 60)}:${String(Math.round(m % 60)).padStart(2, '0')}`
