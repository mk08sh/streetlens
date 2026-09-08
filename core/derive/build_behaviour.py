#!/usr/bin/env python3
"""Derive the behaviour-question dataset: how people respond to weather, time, capacity and design on the corridor.

    python core/derive/build_behaviour.py --city toronto --corridor bloor-west

Reads the newest copy of each file across data/snapshots/*/ . Everything is descriptive aggregation; no modelling beyond
binned means and one least-squares slope, both reported with their sample sizes.
"""
import argparse, collections, csv, datetime as dt, glob, json, math, os, sys
import yaml
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_corridor import ROOT, locate, build_axis, f  # noqa: E402

PARALLEL = ["Dupont St", "Harbord St", "Davenport Rd", "Annette St", "Dundas St W", "Hoskin Ave", "Barton Ave", "Wallace Ave", "Lowther Ave", "College St"]
OCCUPANCY = 1.25


def newest(name):
    paths = sorted(glob.glob(os.path.join(ROOT, "data", "snapshots", "*", name)))
    if not paths: raise FileNotFoundError(name)
    return paths[-1]


def weekday(d): return dt.date.fromisoformat(d).weekday() < 5


def ols(xs, ys):
    """Slope, intercept of y on x."""
    n = len(xs); mx, my = sum(xs) / n, sum(ys) / n
    sxx = sum((x - mx) ** 2 for x in xs); sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    b = sxy / sxx if sxx else 0.0
    return b, my - b * mx


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--city", default="toronto"); ap.add_argument("--corridor", default="bloor-west"); a = ap.parse_args()
    cdir = os.path.join(ROOT, "cities", a.city, a.corridor)
    gj = json.load(open(os.path.join(cdir, "segments.geojson")))
    sens = yaml.safe_load(open(os.path.join(cdir, "sensors.yaml")))
    su = yaml.safe_load(open(os.path.join(cdir, "subway-usage.yaml")))
    bnds = sorted([ft for ft in gj["features"] if ft["properties"]["kind"] == "boundary"], key=lambda x: x["properties"]["order"])
    boundaries = [{"id": ft["id"], "station": ft["properties"]["station"], "lon": ft["geometry"]["coordinates"][0], "lat": ft["geometry"]["coordinates"][1], "centreline_id": ft["properties"]["centreline_id"]} for ft in bnds]
    lat0 = sum(b["lat"] for b in boundaries) / len(boundaries)
    pts, pos = build_axis(boundaries, lat0)
    for b, p in zip(boundaries, pos): b["pos_m"] = round(p)
    segs = sorted([ft for ft in gj["features"] if ft["properties"]["kind"] == "segment"], key=lambda x: x["properties"]["order"])
    segments = [{"id": ft["id"], "from": ft["properties"]["from_boundary"], "to": ft["properties"]["to_boundary"], "pos_start_m": boundaries[i]["pos_m"], "pos_end_m": boundaries[i + 1]["pos_m"]} for i, ft in enumerate(segs)]

    # ---------- daily weather since 2022 ----------
    wx = {}
    for ft in json.load(open(newest("eccc-daily-toronto-city.geojson")))["features"]:
        p = ft["properties"]; d = p["LOCAL_DATE"][:10]
        wx[d] = {"t": p.get("MEAN_TEMPERATURE"), "tmax": p.get("MAX_TEMPERATURE"), "tmin": p.get("MIN_TEMPERATURE"), "precip": p.get("TOTAL_PRECIPITATION") or 0.0, "rain": p.get("TOTAL_RAIN") or 0.0, "snow": p.get("TOTAL_SNOW") or 0.0}

    # ---------- counters: daily totals ----------
    daily = collections.defaultdict(dict)
    for r in csv.DictReader(open(newest("toronto-bike-counters-daily.csv"))):
        daily[r["location_dir_id"]][r["dt"][:10]] = f(r["daily_volume"])
    counters = []
    for c in sens["permanent_bicycle_counters"]:
        ids = [str(i) for i in c["location_dir_ids"]]
        days = sorted(set(daily[ids[0]]) | set(daily[ids[1]]))
        tot = {d: sum(daily[i].get(d) or 0 for i in ids) for d in days if any(daily[i].get(d) is not None for i in ids)}
        counters.append({"ids": ids, "name": c["name"], "short": c["name"].replace("Bloor St W, ", ""), "segment": c["segment"], "since": str(c["active_since"]), "tot": tot})

    # ---------- Q1 weather response ----------
    BINS = list(range(-15, 36, 5))
    q1 = []
    for k in counters:
        rows = [(d, v, wx[d]) for d, v in k["tot"].items() if d in wx and wx[d]["t"] is not None and weekday(d) and v > 0]
        dry = [(w["t"], v) for d, v, w in rows if w["precip"] < 0.5 and w["snow"] < 0.2]
        wet = [(w["t"], v) for d, v, w in rows if w["precip"] >= 2.0 and w["t"] > 2]  # rain, not snow
        def binned(pairs):
            out = []
            for lo in BINS:
                sel = [v for t, v in pairs if lo <= t < lo + 5]
                out.append({"lo": lo, "n": len(sel), "mean": round(sum(sel) / len(sel)) if len(sel) >= 3 else None})
            return out
        mid = [(t, v) for t, v in dry if 0 <= t <= 25]
        slope, _ = ols([t for t, v in mid], [v for t, v in mid]) if len(mid) > 20 else (None, None)
        summer = [v for t, v in dry if 18 <= t <= 26]; winter = [v for t, v in dry if t <= 0]
        # rain effect: compare wet vs dry within the same temperature bins, weighted by wet-day count
        num = den = 0.0
        for lo in BINS:
            wv = [v for t, v in wet if lo <= t < lo + 5]; dv = [v for t, v in dry if lo <= t < lo + 5]
            if len(wv) >= 3 and len(dv) >= 3:
                num += len(wv) * (sum(wv) / len(wv)) / (sum(dv) / len(dv)); den += len(wv)
        q1.append({"counter": k["short"], "segment": k["segment"], "since": k["since"], "weekdays": len(rows), "dry_days": len(dry), "wet_days": len(wet),
                   "dry_bins": binned(dry), "wet_bins": binned(wet),
                   "per_degree": round(slope) if slope is not None else None,
                   "summer_mean": round(sum(summer) / len(summer)) if len(summer) >= 5 else None,
                   "winter_mean": round(sum(winter) / len(winter)) if len(winter) >= 5 else None,
                   "winter_retention_pct": round(100 * (sum(winter) / len(winter)) / (sum(summer) / len(summer))) if len(winter) >= 5 and len(summer) >= 5 else None,
                   "rain_retention_pct": round(100 * num / den) if den else None})

    # ---------- Q2 hour × direction shape, and dry vs wet by hour ----------
    fifteen = collections.defaultdict(lambda: collections.defaultdict(lambda: [0.0, 0]))  # (loc_dir) -> hour -> [sum, n]
    hour_day = collections.defaultdict(lambda: collections.defaultdict(float))  # (counter idx, date) -> hour -> volume
    idmap = {i: (ki, di) for ki, k in enumerate(counters) for di, i in enumerate(k["ids"])}
    start, end = "2025-09-01", "2026-08-31"
    for name in ("toronto-bike-counters-15min-2025-2026.csv", "toronto-bike-counters-15min-2026-2027.csv"):
        for r in csv.DictReader(open(newest(name))):
            if r["location_dir_id"] not in idmap: continue
            d = r["datetime_bin"][:10]
            if d < start or d > end or not weekday(d): continue
            h = int(r["datetime_bin"][11:13]); v = f(r["bin_volume"]) or 0
            ki, di = idmap[r["location_dir_id"]]
            hour_day[(ki, d)][(di, h)] += v
    q2 = []
    for ki, k in enumerate(counters):
        days = [d for (kk, d) in hour_day if kk == ki]
        if not days: continue
        prof = {0: [0.0] * 24, 1: [0.0] * 24}; n = 0
        dryp, wetp = [0.0] * 24, [0.0] * 24; nd = nw = 0
        for d in days:
            hd = hour_day[(ki, d)]
            tot = sum(hd.values())
            if tot < 20: continue  # counter down
            n += 1
            for (di, h), v in hd.items(): prof[di][h] += v
            w = wx.get(d)
            both = [sum(hd.get((di, h), 0) for di in (0, 1)) for h in range(24)]
            if w and w["precip"] < 0.5: nd += 1; dryp = [x + y for x, y in zip(dryp, both)]
            elif w and w["precip"] >= 2.0 and (w["t"] or 0) > 2: nw += 1; wetp = [x + y for x, y in zip(wetp, both)]
        eb = [round(x / n, 1) for x in prof[0]]; wb = [round(x / n, 1) for x in prof[1]]
        both = [e + w for e, w in zip(eb, wb)]; total = sum(both) or 1
        am = sum(both[7:10]); pm = sum(both[16:19])
        am_eb = sum(eb[7:10]) / (am or 1); pm_eb = sum(eb[16:19]) / (pm or 1)
        q2.append({"counter": k["short"], "segment": k["segment"], "days": n, "eb": eb, "wb": wb,
                   "peak_share_pct": round(100 * (am + pm) / total), "am_eastbound_pct": round(100 * am_eb), "pm_eastbound_pct": round(100 * pm_eb),
                   "dry_hourly": [round(x / nd, 1) for x in dryp] if nd else None, "wet_hourly": [round(x / nw, 1) for x in wetp] if nw else None, "dry_days": nd, "wet_days": nw})

    # ---------- Q3 peak history per station, and Q6 parallel streets ----------
    by_cl = {b["centreline_id"]: b["id"] for b in boundaries}
    peaks = collections.defaultdict(list); parallel = collections.defaultdict(list)
    for r in csv.DictReader(open(newest("toronto-tmc-summary.csv"))):
        cl = int(r["centreline_id"]) if r["centreline_id"] else None
        if cl in by_cl:
            peaks[by_cl[cl]].append({"date": r["count_date"][:10], "duration": r["count_duration"], "am_start": r["am_peak_start"][11:16] if r["am_peak_start"] else None, "pm_start": r["pm_peak_start"][11:16] if r["pm_peak_start"] else None,
                                     "am_veh": f(r["am_peak_vehicle"]), "pm_veh": f(r["pm_peak_vehicle"]), "veh": f(r["total_vehicle"]), "bike": f(r["total_bike"]), "ped": f(r["total_pedestrian"])})
            continue
        try: lon, lat = float(r["longitude"]), float(r["latitude"])
        except ValueError: continue
        if not (-79.54 < lon < -79.384): continue
        street = r["location_name"].split("/")[0].strip()
        if street not in PARALLEL: continue
        loc = locate(lon, lat, pts, pos, lat0)
        if not (150 < loc[1] < 900) or loc[0] <= 0 or loc[0] >= pos[-1]: continue
        seg = segments[loc[2]]["id"]
        parallel[seg].append({"name": r["location_name"], "street": street, "side": "north" if lat > (boundaries[0]["lat"] + (boundaries[-1]["lat"] - boundaries[0]["lat"]) * loc[0] / pos[-1]) else "south", "offset_m": round(loc[1]), "date": r["count_date"][:10], "veh": f(r["total_vehicle"]), "duration": r["count_duration"]})
    for k in peaks: peaks[k].sort(key=lambda x: x["date"])
    for k in parallel: parallel[k].sort(key=lambda x: (x["name"], x["date"]))

    # ---------- Q4 mode share per station and per stretch ----------
    mode = {}
    for b in boundaries:
        lst = [p for p in peaks.get(b["id"], []) if p["veh"] is not None]
        if not lst: continue
        t = lst[-1]; sub = su["stations"].get(b["id"], {}).get("2024-2025")
        car = t["veh"] * OCCUPANCY; bike = t["bike"] or 0; ped = t["ped"] or 0
        mode[b["id"]] = {"date": t["date"], "car": round(car), "bike": round(bike), "foot": round(ped), "subway": sub, "hours": t["duration"]}
    mode_seg = {}
    for s in segments:
        parts = [mode[x] for x in (s["from"], s["to"]) if x in mode]
        if not parts: continue
        agg = {k: sum(p[k] or 0 for p in parts) for k in ("car", "bike", "foot", "subway")}
        tot = sum(agg.values()) or 1
        mode_seg[s["id"]] = {k: round(100 * v / tot) for k, v in agg.items()} | {"n": len(parts)}

    # ---------- Q5 conflicts: KSI patterns at stations, subway delay causes ----------
    ksi_pat = collections.defaultdict(lambda: {"n": 0, "impact": collections.Counter(), "user": collections.Counter(), "light": collections.Counter(), "years": collections.Counter()})
    seen = set()
    for r in csv.DictReader(open(newest("toronto-ksi.csv"))):
        lon, lat = f(r["longitude"]), f(r["latitude"])
        if lon is None or not (-79.54 < lon < -79.38 and 43.63 < lat < 43.68): continue
        loc = locate(lon, lat, pts, pos, lat0)
        if loc[1] > 60: continue
        near = min(boundaries, key=lambda b: abs(b["pos_m"] - loc[0]))
        if abs(near["pos_m"] - loc[0]) > 80: continue
        key = (r["collision_id"], near["id"])
        if key in seen: continue
        seen.add(key)
        k = ksi_pat[near["id"]]; k["n"] += 1
        k["impact"][r["impactype"] or "Unknown"] += 1; k["light"][r["light"] or "Unknown"] += 1; k["years"][r["accdate"][:4]] += 1
        if r["cyclist"] == "Yes": k["user"]["cyclist"] += 1
        elif r["pedestrian"] == "Yes": k["user"]["pedestrian"] += 1
        else: k["user"]["vehicle occupants"] += 1
    ksi_out = {b: {"n": v["n"], "impact": v["impact"].most_common(4), "user": v["user"].most_common(), "dark_pct": round(100 * sum(n for l, n in v["light"].items() if l.startswith("Dark")) / v["n"]) if v["n"] else None, "first": min(v["years"]), "last": max(v["years"])} for b, v in ksi_pat.items()}

    codes = {r["CODE"]: r["DESCRIPTION"].title() for r in csv.DictReader(open(newest("ttc-subway-delay-codes.csv")))}
    ALIAS = {"boundary:yonge": "YONGE BD", "boundary:st-george": "ST GEORGE BD", "boundary:spadina": "SPADINA BD"}
    def norm(n): return n.upper().replace(".", "").replace(" STATION", "").strip()
    want = {ALIAS.get(b["id"], norm(b["station"])): b["id"] for b in boundaries}
    causes = collections.defaultdict(lambda: collections.defaultdict(lambda: [0, 0])); months = set()
    for r in csv.DictReader(open(newest("ttc-subway-delay-since-2025.csv"))):
        if (r.get("Line") or "").strip() not in ("BD", "YU/BD", "YUS/BD"): continue
        bid = want.get(norm(r["Station"]))
        if not bid: continue
        months.add(r["Date"][:7]); c = causes[bid][r["Code"]]; c[0] += 1; c[1] += int(f(r["Min Delay"]) or 0)
    delay_out = {b: {"months": len(months), "total": sum(v[0] for v in cs.values()), "top": [{"code": code, "what": codes.get(code, code), "n": v[0], "minutes": v[1]} for code, v in sorted(cs.items(), key=lambda kv: -kv[1][0])[:6]]} for b, cs in causes.items()}

    out = {"built": dt.date.today().isoformat(), "weather_span": [min(wx), max(wx)], "q1_weather": q1, "q2_hours": q2, "q3_peaks": dict(peaks), "q4_mode": {"station": mode, "segment": mode_seg},
           "q5_conflicts": {"ksi": ksi_out, "subway": delay_out}, "q6_parallel": dict(parallel), "parallel_streets": PARALLEL, "occupancy": OCCUPANCY}
    op = os.path.join(ROOT, "app", "public", "data", f"{a.city}-{a.corridor}-behaviour.json")
    json.dump(out, open(op, "w"), separators=(",", ":"))
    print(f"wrote {op} ({os.path.getsize(op)/1e6:.2f} MB)")
    for q in q1: print(" Q1", q["counter"], "per °C", q["per_degree"], "| winter keeps", q["winter_retention_pct"], "% | rain keeps", q["rain_retention_pct"], "%", "| days", q["dry_days"], q["wet_days"])
    for q in q2: print(" Q2", q["counter"], "peak share", q["peak_share_pct"], "% | AM eastbound", q["am_eastbound_pct"], "% | PM eastbound", q["pm_eastbound_pct"], "%", "days", q["days"])
    print(" Q3 stations", len(peaks), "| Q4 stretches", len(mode_seg), "| Q5 ksi stations", len(ksi_out), "delay stations", len(delay_out), "| Q6 parallel", {k: len(v) for k, v in parallel.items()})


if __name__ == "__main__":
    main()
