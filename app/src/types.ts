export type Boundary = { id: string; order: number; station: string; cross_street: string; lon: number; lat: number; centreline_id: number; px: number; pos_m: number }
export type Segment = { id: string; order: number; name: string; from: string; to: string; pos_start_m: number; pos_end_m: number; length_m: number }
export type Tmc = { date: string; hours: number | null; veh: number | null; bike: number | null; ped: number | null; am_peak_veh: number | null; pm_peak_veh: number | null; people: number | null }
export type Counter = { ids: string[]; name: string; segment: string; pos_m: number; active_since: string; directions: string[]; daily: [string, number | null, number | null][] }
export type Ksi = { date: string; collision_id: string; road_user: string; injury: string; acclass: string; cyclist: boolean; pedestrian: boolean; pos_m: number }
export type TpsMonth = { total: number; injury: number; bicycle: number; pedestrian: number; ftr: number }
export type Weather = { date: string; tmean: number | null; tmax: number | null; tmin: number | null; precip: number; cond: string[] }
export type Restriction = { id: string; name: string; from: string; to: string; start: string; end: string; type: string; impact: string; description: string; segment: string; pos_m: number }
export type Bikeshare = { stations: number; capacity: number; bikes_available: number; ebikes_available: number; list: { name: string; capacity: number; pos_m: number; offset_m: number }[] }
export type Design = { from: string; to: string; installed: string; upgraded: string; infra: string; pos_m: number }
export type Event = { id: string; kind: string; date: string; segments: string[] | 'all'; status: string; extent?: string; notes?: string }
export type Source = { id: string; title: string; publisher: string; dataset: string; licence: string; licence_url?: string; cadence: string; layer: string; limits: string }

export type Corridor = {
  sources: Source[]
  not_open: string[]
  coverage: { tps: [string, string] | null; ksi: [string, string] | null; counters: [string, string] | null; weather: [string, string] | null; restrictions: [string, string | null]; subway_delays: [string, string] | null }
  corridor: { city: string; id: string; street: string; from: string; to: string; length_m: number; snapshot: string; occupancy_assumption: number; max_offset_m: number }
  boundaries: Boundary[]
  segments: Segment[]
  tmc: Record<string, Tmc[]>
  counters: Counter[]
  ksi: Record<string, Ksi[]>
  tps: Record<string, Record<string, TpsMonth>>
  weather: Weather[]
  restrictions: Restriction[]
  bikeshare: Record<string, Bikeshare>
  design: Record<string, Design[]>
  events: Event[]
  dropped: Record<string, number>
  subway_usage: { measure: string; periods: Record<string, { covers: string; source: string }>; line_total: Record<string, number>; stations: Record<string, Record<string, number | string>> } | null
  subway_delays: Record<string, Record<string, { count: number; minutes: number }>>
  cameras: Record<string, { name: string; image: string; views: { url: string; direction: string | null }[] }[]>
}
