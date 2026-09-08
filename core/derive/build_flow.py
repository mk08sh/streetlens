#!/usr/bin/env python3
"""Directional flow by hour for the flow map: vehicles, buses, bicycles, pedestrians per stretch and direction.

Vehicles, buses and pedestrians come from City count days (raw 15-minute turning movements at the 18 station intersections).
Bicycles come from the four permanent counters where they exist, otherwise from count days. Subway is a constant per station.

Eastbound flow entering a stretch = through + turning movements that leave the west-end intersection heading east.
Westbound flow entering a stretch = the same at the east-end intersection heading west.
"""
import argparse, collections, csv, datetime as dt, glob, json, os, sys
import yaml
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_corridor import ROOT, f, locate, build_axis  # noqa: E402


def newest(name):
    p = sorted(glob.glob(os.path.join(ROOT, "data", "snapshots", "*", name)))
    if not p: raise FileNotFoundError(name)
    return p[-1]


def g(r, k): return float(r.get(k) or 0)


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--city", default="toronto"); ap.add_argument("--corridor", default="bloor-west"); a = ap.parse_args()
    cdir = os.path.join(ROOT, "cities", a.city, a.corridor)
    gj = json.load(open(os.path.join(cdir, "segments.geojson")))
    sens = yaml.safe_load(open(os.path.join(cdir, "sensors.yaml")))
    su = yaml.safe_load(open(os.path.join(cdir, "subway-usage.yaml")))
    bnds = sorted([ft for ft in gj["features"] if ft["properties"]["kind"] == "boundary"], key=lambda x: x["properties"]["order"])
    boundaries = [{"id": ft["id"], "station": ft["properties"]["station"], "cross_street": ft["properties"]["cross_street"], "lon": ft["geometry"]["coordinates"][0], "lat": ft["geometry"]["coordinates"][1], "centreline_id": ft["properties"]["centreline_id"]} for ft in bnds]
    lat0 = sum(b["lat"] for b in boundaries) / len(boundaries)
    pts, pos = build_axis(boundaries, lat0)
    for b, p in zip(boundaries, pos): b["pos_m"] = round(p)
    segs = sorted([ft for ft in gj["features"] if ft["properties"]["kind"] == "segment"], key=lambda x: x["properties"]["order"])
    segments = [{"id": ft["id"], "name": ft["properties"]["name"], "from": ft["properties"]["from_boundary"], "to": ft["properties"]["to_boundary"]} for ft in segs]

    # ---------- raw 15-minute counts at stations -> hourly directional entering flows per count day ----------
    raw = json.load(open(newest("toronto-tmc-raw-stations.json")))
    by_cl = {b["centreline_id"]: b["id"] for b in boundaries}
    days = collections.defaultdict(lambda: collections.defaultdict(lambda: {"veh_eb": [0.0] * 24, "veh_wb": [0.0] * 24, "bus_eb": [0.0] * 24, "bus_wb": [0.0] * 24, "bike_eb": [0.0] * 24, "bike_wb": [0.0] * 24, "ped": [0.0] * 24, "bins": 0, "counted": [False] * 24}))
    for r in raw:
        bid = by_cl.get(int(r["centreline_id"])); d = r["count_date"][:10]; h = int(r["start_time"][11:13])
        x = days[bid][d]; x["bins"] += 1; x["counted"][h] = True
        veh = lambda k: g(r, f"{k}_cars_t") + g(r, f"{k}_cars_l") + g(r, f"{k}_cars_r") + g(r, f"{k}_truck_t") + g(r, f"{k}_truck_l") + g(r, f"{k}_truck_r")
        # eastbound leaving the intersection: from west through, from north turning left, from south turning right
        x["veh_eb"][h] += g(r, "w_appr_cars_t") + g(r, "w_appr_truck_t") + g(r, "n_appr_cars_l") + g(r, "n_appr_truck_l") + g(r, "s_appr_cars_r") + g(r, "s_appr_truck_r")
        x["veh_wb"][h] += g(r, "e_appr_cars_t") + g(r, "e_appr_truck_t") + g(r, "s_appr_cars_l") + g(r, "s_appr_truck_l") + g(r, "n_appr_cars_r") + g(r, "n_appr_truck_r")
        x["bus_eb"][h] += g(r, "w_appr_bus_t") + g(r, "n_appr_bus_l") + g(r, "s_appr_bus_r")
        x["bus_wb"][h] += g(r, "e_appr_bus_t") + g(r, "s_appr_bus_l") + g(r, "n_appr_bus_r")
        x["bike_eb"][h] += g(r, "w_appr_bike"); x["bike_wb"][h] += g(r, "e_appr_bike")
        x["ped"][h] += g(r, "n_appr_peds") + g(r, "s_appr_peds")  # crossing the side street's legs = walking along Bloor
        del veh
    station_days = {bid: {d: {k: ([round(v) for v in val] if isinstance(val, list) and k != "counted" else val) for k, val in x.items()} for d, x in sorted(dd.items())} for bid, dd in days.items()}

    # ---------- permanent counters: hourly weekday means per month, daily totals, monthly and yearly means ----------
    idmap = {}
    for c in sens["permanent_bicycle_counters"]:
        for di, i in enumerate(c["location_dir_ids"]): idmap[str(i)] = (c["segment"], "eb" if di == 0 else "wb")
    hourly = collections.defaultdict(lambda: collections.defaultdict(lambda: [[0.0, 0] for _ in range(24)]))  # (seg,dir) -> ym -> hour -> [sum, n]
    for name in sorted(glob.glob(os.path.join(ROOT, "data", "snapshots", "*", "toronto-bike-counters-15min-*.csv"))):
        seen = set()
        for r in csv.DictReader(open(name)):
            key = idmap.get(r["location_dir_id"]);
            if not key: continue
            d = r["datetime_bin"][:10]
            if dt.date.fromisoformat(d).weekday() >= 5: continue
            h = int(r["datetime_bin"][11:13]); ym = d[:7]
            cell = hourly[key][ym][h]; cell[0] += f(r["bin_volume"]) or 0
            if (key, d, h) not in seen: seen.add((key, d, h)); cell[1] += 1
    counters_hourly = {f"{s}|{dr}": {ym: [round(c[0] / c[1], 1) if c[1] else None for c in hrs] for ym, hrs in yms.items()} for (s, dr), yms in hourly.items()}
    daily = collections.defaultdict(dict)
    for r in csv.DictReader(open(newest("toronto-bike-counters-daily.csv"))):
        key = idmap.get(r["location_dir_id"])
        if key: daily[f"{key[0]}|{key[1]}"][r["dt"][:10]] = f(r["daily_volume"])
    counters_daily = {k: v for k, v in daily.items()}

    # ---------- subway constant ----------
    subway = {b["id"]: su["stations"].get(b["id"], {}).get("2024-2025") for b in boundaries}

    # ---------- every Bloor intersection, for the cross-street ticks ----------
    cross = []
    for r in csv.DictReader(open(newest("toronto-tmc-most-recent.csv"))):
        try: lon, lat = float(r["longitude"]), float(r["latitude"])
        except ValueError: continue
        if "bloor" not in r["location_name"].lower() or not (-79.54 < lon < -79.384 and 43.63 < lat < 43.68): continue
        loc = locate(lon, lat, pts, pos, lat0)
        if loc[1] > 40 or loc[0] <= 0 or loc[0] >= pos[-1]: continue
        parts = [p.strip() for p in r["location_name"].split("/")]
        name = next((p for p in parts if "bloor" not in p.lower()), parts[0])
        cross.append({"name": name, "pos_m": round(loc[0]), "px": r["px"] or None})
    cross.sort(key=lambda c: c["pos_m"])

    out = {"built": dt.date.today().isoformat(), "boundaries": [{k: b[k] for k in ("id", "station", "cross_street", "pos_m")} for b in boundaries], "segments": segments,
           "station_days": station_days, "counters_hourly": counters_hourly, "counters_daily": counters_daily, "subway": subway, "cross_streets": cross,
           "notes": {"veh": "cars + trucks entering the stretch in that direction, per hour, on a City count day", "bus": "buses entering the stretch in that direction on a City count day; Bloor West has no daytime surface route, so this is mostly cross-street buses turning",
                     "ped": "people crossing the side street on either Bloor sidewalk, i.e. walking along Bloor, direction unknown so split evenly", "bike": "permanent counter where one exists (weekday hourly means for the month), otherwise bicycles entering by approach on a count day",
                     "subway": "typical-weekday riders at the station (TTC, Sep 2024 to Nov 2025); no hourly or directional data exists"}}
    op = os.path.join(ROOT, "app", "public", "data", f"{a.city}-{a.corridor}-flow.json")
    json.dump(out, open(op, "w"), separators=(",", ":"))
    print(f"wrote {op} ({os.path.getsize(op)/1e6:.2f} MB) | station-days {sum(len(v) for v in station_days.values())} | counter series {len(counters_hourly)} | cross streets {len(cross)}")
    b0 = station_days["boundary:bathurst"]; d0 = sorted(b0)[-1]; print("Bathurst", d0, "veh_eb by hour", b0[d0]["veh_eb"], "bus_eb", sum(b0[d0]["bus_eb"]), "ped", sum(b0[d0]["ped"]))


if __name__ == "__main__":
    main()
