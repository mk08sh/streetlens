#!/usr/bin/env python3
"""Derive a compact corridor JSON for the UI from a dated snapshot.

    python core/derive/build_corridor.py --city toronto --corridor bloor-west --snapshot 2026-09-04

Everything here is a straight aggregation of archived files. No modelling, no interpolation, no normalization.
Positions are metres along the corridor from the first boundary. Points are attached to a segment when they
lie within `MAX_OFFSET_M` of the corridor line; otherwise they are dropped and counted in `dropped`.
"""
import argparse, csv, json, math, os, collections, datetime as dt
import yaml

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MAX_OFFSET_M = 60
BIKESHARE_OFFSET_M = 250
OCCUPANCY = 1.25  # persons per motor vehicle; published assumption, see docs/methodology.md


def proj(lon, lat, lat0):
    """Equirectangular projection to metres, good enough over 12 km."""
    return ((lon) * 111320 * math.cos(math.radians(lat0)), lat * 110540)


def build_axis(boundaries, lat0):
    pts = [proj(b["lon"], b["lat"], lat0) for b in boundaries]
    pos, acc = [0.0], 0.0
    for i in range(1, len(pts)):
        acc += math.dist(pts[i - 1], pts[i]); pos.append(acc)
    return pts, pos


def locate(lon, lat, pts, pos, lat0):
    """Return (position_m, offset_m, segment_index) for the nearest point on the polyline."""
    p = proj(lon, lat, lat0); best = None
    for i in range(len(pts) - 1):
        a, b = pts[i], pts[i + 1]; ab = (b[0] - a[0], b[1] - a[1]); L2 = ab[0] ** 2 + ab[1] ** 2
        t = max(0.0, min(1.0, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1]) / L2))
        q = (a[0] + t * ab[0], a[1] + t * ab[1]); d = math.dist(p, q)
        if best is None or d < best[1]:
            best = (pos[i] + t * math.sqrt(L2), d, i)
    return best


def f(x):
    try: return float(x)
    except (TypeError, ValueError): return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--city", default="toronto"); ap.add_argument("--corridor", default="bloor-west"); ap.add_argument("--snapshot", required=True)
    a = ap.parse_args()
    cdir = os.path.join(ROOT, "cities", a.city, a.corridor)
    snap = os.path.join(ROOT, "data", "snapshots", a.snapshot)
    gj = json.load(open(os.path.join(cdir, "segments.geojson")))
    inter = yaml.safe_load(open(os.path.join(cdir, "interventions.yaml")))
    sens = yaml.safe_load(open(os.path.join(cdir, "sensors.yaml")))
    dropped = collections.Counter()

    bnds = sorted([ft for ft in gj["features"] if ft["properties"]["kind"] == "boundary"], key=lambda x: x["properties"]["order"])
    boundaries = [{"id": ft["id"], "order": ft["properties"]["order"], "station": ft["properties"]["station"], "cross_street": ft["properties"]["cross_street"],
                   "lon": ft["geometry"]["coordinates"][0], "lat": ft["geometry"]["coordinates"][1],
                   "centreline_id": ft["properties"]["centreline_id"], "px": ft["properties"]["px"]} for ft in bnds]
    lat0 = sum(b["lat"] for b in boundaries) / len(boundaries)
    pts, pos = build_axis(boundaries, lat0)
    for b, p in zip(boundaries, pos): b["pos_m"] = round(p)
    segs = sorted([ft for ft in gj["features"] if ft["properties"]["kind"] == "segment"], key=lambda x: x["properties"]["order"])
    segments = [{"id": ft["id"], "order": ft["properties"]["order"], "name": ft["properties"]["name"], "from": ft["properties"]["from_boundary"], "to": ft["properties"]["to_boundary"],
                 "pos_start_m": boundaries[i]["pos_m"], "pos_end_m": boundaries[i + 1]["pos_m"], "length_m": boundaries[i + 1]["pos_m"] - boundaries[i]["pos_m"]} for i, ft in enumerate(segs)]
    seg_id = lambda i: segments[i]["id"]

    # --- Turning movement counts at boundary intersections (all history) ---
    by_cl = {b["centreline_id"]: b["id"] for b in boundaries}
    tmc = collections.defaultdict(list)
    for r in csv.DictReader(open(os.path.join(snap, "toronto-tmc-summary.csv"))):
        cl = int(r["centreline_id"]) if r["centreline_id"] else None
        if cl in by_cl:
            veh, bike, ped = f(r["total_vehicle"]), f(r["total_bike"]), f(r["total_pedestrian"])
            tmc[by_cl[cl]].append({"date": r["count_date"][:10], "hours": f(r["count_duration"]), "veh": veh, "bike": bike, "ped": ped,
                                   "am_peak_veh": f(r["am_peak_vehicle"]), "pm_peak_veh": f(r["pm_peak_vehicle"]),
                                   "people": round(veh * OCCUPANCY + (bike or 0) + (ped or 0)) if veh is not None else None})
    for k in tmc: tmc[k].sort(key=lambda x: x["date"])

    # --- Permanent bicycle counters, daily ---
    counters = []
    daily = collections.defaultdict(dict)
    for r in csv.DictReader(open(os.path.join(snap, "toronto-bike-counters-daily.csv"))):
        daily[r["location_dir_id"]][r["dt"][:10]] = f(r["daily_volume"])
    for c in sens.get("permanent_bicycle_counters", []):
        ids = [str(i) for i in c["location_dir_ids"]]
        loc = locate(c["lon"], c["lat"], pts, pos, lat0)
        dates = sorted(set().union(*[daily[i].keys() for i in ids]))
        series = [[d] + [daily[i].get(d) for i in ids] for d in dates]
        counters.append({"ids": ids, "name": c["name"], "segment": c["segment"], "pos_m": round(loc[0]), "active_since": str(c["active_since"]),
                         "directions": ["EB", "WB"], "daily": series})

    # --- KSI (one row per person; keep one row per collision + road user) ---
    ksi = collections.defaultdict(list); seen = set()
    for r in csv.DictReader(open(os.path.join(snap, "toronto-ksi.csv"))):
        lon, lat = f(r["longitude"]), f(r["latitude"])
        if lon is None: continue
        if not (-79.54 < lon < -79.38 and 43.63 < lat < 43.68): continue
        loc = locate(lon, lat, pts, pos, lat0)
        if loc[1] > MAX_OFFSET_M or loc[0] <= 0 or loc[0] >= pos[-1]: dropped["ksi_off_corridor"] += 1; continue
        key = (r["collision_id"], r["road_user"], r["injury"])
        if key in seen: continue
        seen.add(key)
        ksi[seg_id(loc[2])].append({"date": r["accdate"][:10], "collision_id": r["collision_id"], "road_user": r["road_user"], "injury": r["injury"], "acclass": r["acclass"],
                                    "cyclist": r["cyclist"] == "Yes", "pedestrian": r["pedestrian"] == "Yes", "pos_m": round(loc[0])})
    for k in ksi: ksi[k].sort(key=lambda x: x["date"])

    # --- TPS all-severity collisions, monthly per segment ---
    tps = collections.defaultdict(lambda: collections.defaultdict(lambda: {"total": 0, "injury": 0, "bicycle": 0, "pedestrian": 0, "ftr": 0}))
    t = json.load(open(os.path.join(snap, "tps-collisions.geojson")))
    for ft in t["features"]:
        p = ft["properties"]; lon, lat = f(p.get("LONG_WGS84")), f(p.get("LAT_WGS84"))
        if lon is None or lat is None or lon == 0: dropped["tps_no_coord"] += 1; continue
        loc = locate(lon, lat, pts, pos, lat0)
        if loc[1] > MAX_OFFSET_M or loc[0] <= 0 or loc[0] >= pos[-1]: dropped["tps_off_corridor"] += 1; continue
        ym = dt.datetime.fromtimestamp(p["OCC_DATE"] / 1000, dt.timezone.utc).strftime("%Y-%m") if isinstance(p.get("OCC_DATE"), (int, float)) else str(p.get("OCC_DATE"))[:7]
        m = tps[seg_id(loc[2])][ym]; m["total"] += 1
        if p.get("INJURY_COLLISIONS") == "YES": m["injury"] += 1
        if p.get("BICYCLE") == "YES": m["bicycle"] += 1
        if p.get("PEDESTRIAN") == "YES": m["pedestrian"] += 1
        if p.get("FTR_COLLISIONS") == "YES": m["ftr"] += 1

    # --- Weather, daily from hourly ---
    w = json.load(open(os.path.join(snap, "eccc-hourly-toronto-city.geojson")))
    wd = collections.defaultdict(lambda: {"t": [], "p": 0.0})
    for ft in w["features"]:
        p = ft["properties"]; d = p["LOCAL_DATE"][:10]
        if p.get("TEMP") is not None: wd[d]["t"].append(p["TEMP"])
        if p.get("PRECIP_AMOUNT") is not None: wd[d]["p"] += p["PRECIP_AMOUNT"]
    cond = collections.defaultdict(set)
    ccp = os.path.join(snap, "eccc-hourly-toronto-city-centre.geojson")
    if os.path.exists(ccp):
        for ft in json.load(open(ccp))["features"]:
            p = ft["properties"]; desc = (p.get("WEATHER_ENG_DESC") or "").lower(); d = p["LOCAL_DATE"][:10]
            if "freezing" in desc: cond[d].add("freezing_rain")
            if "snow" in desc: cond[d].add("snow")
            if "fog" in desc or "haze" in desc: cond[d].add("fog")
            if "rain" in desc or "drizzle" in desc or "shower" in desc: cond[d].add("rain")
    weather = []
    for d, v in sorted(wd.items()):
        c = set(cond.get(d, ()))
        if v["p"] >= 0.5 and v["t"] and min(v["t"]) > 1: c.add("rain")
        if v["t"] and max(v["t"]) >= 30: c.add("heat")
        if v["t"] and min(v["t"]) <= -10: c.add("deep_cold")
        if v["t"] and min(v["t"]) <= 0: c.add("freezing")
        weather.append({"date": d, "tmean": round(sum(v["t"]) / len(v["t"]), 1) if v["t"] else None, "tmax": max(v["t"]) if v["t"] else None, "tmin": min(v["t"]) if v["t"] else None,
                        "precip": round(v["p"], 1), "cond": sorted(c)})

    # --- Road restrictions currently on the corridor ---
    restrictions = []
    with open(os.path.join(snap, "toronto-road-restrictions.csv"), newline="") as fh:
        fh.readline()  # title row
        for r in csv.DictReader(fh):
            lon, lat = f(r.get("Longitude")), f(r.get("Latitude"))
            if lon is None or "bloor" not in (r.get("Road") or "").lower(): continue
            loc = locate(lon, lat, pts, pos, lat0)
            if loc[1] > 120 or loc[0] <= 0 or loc[0] >= pos[-1]: dropped["restrictions_off_corridor"] += 1; continue
            def ts(v):  # epoch milliseconds → ISO date; blank stays blank
                try: return dt.datetime.fromtimestamp(int(v) / 1000, dt.timezone.utc).strftime("%Y-%m-%d")
                except (TypeError, ValueError): return (v or "")[:10]
            restrictions.append({"id": r["ID"], "name": r.get("Name"), "from": r.get("FromRoad"), "to": r.get("ToRoad"), "start": ts(r.get("StartTime")), "end": ts(r.get("EndTime")),
                                 "type": r.get("WorkEventType") or r.get("Type"), "impact": r.get("CurrImpact") or r.get("MaxImpact"), "description": (r.get("Description") or "")[:200],
                                 "segment": seg_id(loc[2]), "pos_m": round(loc[0])})

    # --- Bike Share stations near the corridor ---
    info = {s["station_id"]: s for s in json.load(open(os.path.join(snap, "bikeshare-station-information.json")))["data"]["stations"]}
    status = {s["station_id"]: s for s in json.load(open(os.path.join(snap, "bikeshare-station-status.json")))["data"]["stations"]}
    bikeshare = collections.defaultdict(lambda: {"stations": 0, "capacity": 0, "bikes_available": 0, "ebikes_available": 0, "list": []})
    for sid, s in info.items():
        loc = locate(s["lon"], s["lat"], pts, pos, lat0)
        if loc[1] > BIKESHARE_OFFSET_M or loc[0] <= 0 or loc[0] >= pos[-1]: continue
        st = status.get(sid, {}); b = bikeshare[seg_id(loc[2])]
        b["stations"] += 1; b["capacity"] += s.get("capacity") or 0; b["bikes_available"] += st.get("num_bikes_available") or 0; b["ebikes_available"] += st.get("num_ebikes_available") or 0
        b["list"].append({"name": s["name"], "capacity": s.get("capacity"), "pos_m": round(loc[0]), "offset_m": round(loc[1])})

    # --- Cycling network: what the City currently maps on Bloor St W ---
    design = collections.defaultdict(list)
    for r in csv.DictReader(open(os.path.join(snap, "toronto-cycling-network.csv"))):
        if (r.get("STREET_NAME") or "").strip().lower() not in ("bloor st w",): continue
        try:
            g = json.loads(r["geometry"]); coords = g["coordinates"]
            while isinstance(coords[0][0], list): coords = coords[0]
            mid = coords[len(coords) // 2]
        except Exception: dropped["cycling_bad_geom"] += 1; continue
        loc = locate(mid[0], mid[1], pts, pos, lat0)
        if loc[1] > 80 or loc[0] <= 0 or loc[0] >= pos[-1]: continue
        design[seg_id(loc[2])].append({"from": r["FROM_STREET"], "to": r["TO_STREET"], "installed": r["INSTALLED"], "upgraded": r["UPGRADED"], "infra": r["INFRA_HIGHORDER"] or r["INFRA_LOWORDER"], "pos_m": round(loc[0])})

    # --- Subway: station usage (transcribed) and Line 2 delays per station per month ---
    su_path = os.path.join(cdir, "subway-usage.yaml")
    subway_usage = yaml.safe_load(open(su_path)) if os.path.exists(su_path) else None
    ALIAS = {"boundary:yonge": "YONGE BD", "boundary:st-george": "ST GEORGE BD", "boundary:spadina": "SPADINA BD"}
    def norm(n): return n.upper().replace(".", "").replace(" STATION", "").strip()
    want = {ALIAS.get(b["id"], norm(b["station"])): b["id"] for b in boundaries}
    subway_delays = collections.defaultdict(lambda: collections.defaultdict(lambda: {"count": 0, "minutes": 0}))
    dp = os.path.join(snap, "ttc-subway-delay-since-2025.csv")
    delay_range = None
    if os.path.exists(dp):
        for r in csv.DictReader(open(dp)):
            if (r.get("Line") or "").strip() not in ("BD", "YU/BD", "YUS/BD"): continue
            bid = want.get(norm(r["Station"]))
            if not bid: continue
            ym = r["Date"][:7]; m = subway_delays[bid][ym]; m["count"] += 1; m["minutes"] += int(f(r["Min Delay"]) or 0)
            delay_range = [min(delay_range[0], r["Date"]), max(delay_range[1], r["Date"])] if delay_range else [r["Date"], r["Date"]]

    # --- City traffic cameras at station intersections (still images, refreshed every few minutes) ---
    cameras = collections.defaultdict(list)
    cp = os.path.join(snap, "toronto-traffic-cameras.geojson")
    if os.path.exists(cp):
        for ft in json.load(open(cp))["features"]:
            cc = ft["geometry"]["coordinates"]
            while isinstance(cc[0], list): cc = cc[0]
            loc = locate(cc[0], cc[1], pts, pos, lat0)
            if loc[1] > 80 or loc[0] < 0 or loc[0] > pos[-1]: continue
            p = ft["properties"]
            near = min(boundaries, key=lambda b: abs(b["pos_m"] - loc[0]))
            if abs(near["pos_m"] - loc[0]) > 80: continue
            views = [{"url": p.get(f"REFURL{i}") or (p.get("IMAGEURL") if i == 1 else None), "direction": p.get(f"DIRECTION{i}")} for i in range(1, 5)]
            views = [v for v in views if v["url"]]
            cameras[near["id"]].append({"name": f"{p.get('MAINROAD')} / {p.get('CROSSROAD')}", "image": p.get("IMAGEURL"), "views": views})

    events = [{"id": e["id"], "kind": e["kind"], "date": str(e["date"]), "segments": e["segments"], "status": e["status"], "extent": e.get("extent"), "notes": e.get("notes")} for e in inter["entries"]]
    events += [{"id": c["id"], "kind": "confounder", "date": str(c["date"]), "segments": "all", "status": "verified", "notes": c["notes"]} for c in inter.get("confounders", [])]

    tps_months = sorted({m for v in tps.values() for m in v}); ksi_dates = sorted(k["date"] for v in ksi.values() for k in v)
    coverage = {"tps": [tps_months[0], tps_months[-1]] if tps_months else None, "ksi": [ksi_dates[0], ksi_dates[-1]] if ksi_dates else None,
                "counters": [min(c["daily"][0][0] for c in counters), max(c["daily"][-1][0] for c in counters)] if counters else None,
                "weather": [weather[0]["date"], weather[-1]["date"]] if weather else None, "restrictions": [a.snapshot, None], "subway_delays": delay_range}
    cat = yaml.safe_load(open(os.path.join(ROOT, "cities", a.city, "sources.yaml")))
    sources = [{"id": x["id"], "title": x["title"], "publisher": x["publisher"], "dataset": x["dataset"], "licence": cat["licences"].get(x["licence"], {}).get("name", x["licence"]),
                "licence_url": cat["licences"].get(x["licence"], {}).get("url"), "cadence": x["cadence"], "layer": x["layer"], "limits": x.get("limits", "")} for x in cat["sources"]]
    out = {"sources": sources, "not_open": cat.get("not_open", []), "coverage": coverage, "corridor": {"city": a.city, "id": a.corridor, "street": gj["properties"]["street"], "from": gj["properties"]["from"], "to": gj["properties"]["to"],
                        "length_m": boundaries[-1]["pos_m"], "snapshot": a.snapshot, "occupancy_assumption": OCCUPANCY, "max_offset_m": MAX_OFFSET_M},
           "boundaries": boundaries, "segments": segments, "tmc": tmc, "counters": counters, "ksi": ksi,
           "tps": {k: dict(v) for k, v in tps.items()}, "weather": weather, "restrictions": restrictions,
           "bikeshare": {k: v for k, v in bikeshare.items()}, "design": design, "events": events, "dropped": dict(dropped),
           "subway_usage": subway_usage, "subway_delays": {k: dict(v) for k, v in subway_delays.items()}, "cameras": dict(cameras)}
    op = os.path.join(ROOT, "app", "public", "data", f"{a.city}-{a.corridor}.json")
    os.makedirs(os.path.dirname(op), exist_ok=True)
    json.dump(out, open(op, "w"), separators=(",", ":"))
    print(f"wrote {op} ({os.path.getsize(op)/1e6:.1f} MB)")
    print("tmc boundaries with counts:", len(tmc), "| counter series:", [len(c['daily']) for c in counters], "| ksi rows:", sum(len(v) for v in ksi.values()),
          "| tps months:", sum(len(v) for v in tps.values()), "| weather days:", len(weather), "| restrictions:", len(restrictions),
          "| bikeshare segs:", len(bikeshare), "| design rows:", sum(len(v) for v in design.values()), "| dropped:", dict(dropped))


if __name__ == "__main__":
    main()
