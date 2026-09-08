#!/usr/bin/env python3
"""Snapshot every source listed in cities/<city>/sources.yaml into data/snapshots/<date>/.

Writes one file per source plus manifest.json recording URL, fetch time, byte size and SHA-256.
Stdlib only except PyYAML. Designed to be boring and reproducible.

    python core/ingest/snapshot.py --city toronto          # small sources
    python core/ingest/snapshot.py --city toronto --full   # include size: large
    python core/ingest/snapshot.py --city toronto --only toronto-ksi,eccc-hourly-toronto-city
"""
import argparse, datetime as dt, hashlib, json, os, sys, time, urllib.parse, urllib.request

import yaml

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CKAN = "https://ckan0.cf.opendata.inter.prod-toronto.ca"
UA = "StreetLens snapshot (https://github.com/mk08sh/streetlens)"


def get(url, timeout=300):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def fetch_url(f):
    return get(f["url"]), f["url"]


def fetch_ckan_dump(f):
    url = f"{CKAN}/datastore/dump/{f['resource_id']}"
    return get(url), url


def fetch_ckan_package(f):
    meta = json.loads(get(f"{CKAN}/api/3/action/package_show?id={f['package_id']}"))["result"]
    want = f.get("prefer_format", "").lower()
    res = [r for r in meta["resources"] if r["format"].lower() == want] or meta["resources"]
    if f.get("latest_only"):
        res = sorted(res, key=lambda r: r.get("last_modified") or "", reverse=True)[:1]
    r = res[0]
    return get(r["url"]), r["url"]


def fetch_arcgis(f):
    """Page through a FeatureServer query and return a single GeoJSON FeatureCollection."""
    feats, offset, page = [], 0, 2000
    base = dict(where=f.get("where", "1=1"), outFields="*", f="geojson", outSR=4326,
                resultRecordCount=page, orderByFields="OBJECTID")
    if f.get("bbox"):
        base.update(geometry=",".join(map(str, f["bbox"])), geometryType="esriGeometryEnvelope",
                    inSR=4326, spatialRel="esriSpatialRelIntersects")
    while True:
        q = dict(base, resultOffset=offset)
        url = f["url"] + "?" + urllib.parse.urlencode(q)
        d = json.loads(get(url))
        feats.extend(d.get("features", []))
        if not d.get("properties", {}).get("exceededTransferLimit") and len(d.get("features", [])) < page:
            break
        offset += page
        time.sleep(0.2)
    out = {"type": "FeatureCollection", "features": feats, "fetched_where": f.get("where"), "fetched_bbox": f.get("bbox")}
    return json.dumps(out).encode(), f["url"] + " (paged, " + str(len(feats)) + " features)"


def fetch_ogc(f):
    """OGC API Features paging. Filters by datetime window when since_days is set."""
    feats, offset, limit = [], 0, 10000
    params = dict(f.get("params", {}), f="json", limit=limit)
    if f.get("since_days"):
        start = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=f["since_days"])).strftime("%Y-%m-%dT00:00:00Z")
        params["datetime"] = f"{start}/.."
    while True:
        url = f["url"] + "?" + urllib.parse.urlencode(dict(params, offset=offset))
        d = json.loads(get(url))
        got = d.get("features", [])
        feats.extend(got)
        if len(got) < limit:
            break
        offset += limit
        time.sleep(0.2)
    out = {"type": "FeatureCollection", "features": feats, "fetched_params": params}
    return json.dumps(out).encode(), f["url"] + " (paged, " + str(len(feats)) + " features)"


FETCHERS = {"url": fetch_url, "ckan-dump": fetch_ckan_dump, "ckan-package": fetch_ckan_package,
            "arcgis": fetch_arcgis, "ogc": fetch_ogc}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--city", required=True)
    ap.add_argument("--full", action="store_true", help="also fetch size: large sources")
    ap.add_argument("--only", help="comma-separated source ids")
    ap.add_argument("--date", default=dt.date.today().isoformat())
    a = ap.parse_args()

    cat = yaml.safe_load(open(os.path.join(ROOT, "cities", a.city, "sources.yaml")))
    outdir = os.path.join(ROOT, "data", "snapshots", a.date)
    os.makedirs(outdir, exist_ok=True)
    mpath = os.path.join(outdir, "manifest.json")
    manifest = json.load(open(mpath)) if os.path.exists(mpath) else {"date": a.date, "city": a.city, "files": {}}

    only = set(a.only.split(",")) if a.only else None
    failures = 0
    for s in cat["sources"]:
        if only and s["id"] not in only:
            continue
        if s.get("size") == "large" and not a.full and not only:
            print(f"skip   {s['id']} (large; use --full)")
            continue
        f = s["fetch"]
        fname = f"{s['id']}.{f.get('ext', 'bin')}"
        t0 = time.time()
        try:
            data, url = FETCHERS[f["kind"]](f)
        except Exception as e:  # keep going; record the failure
            print(f"FAIL   {s['id']}: {e}")
            manifest["files"][fname] = {"source": s["id"], "error": str(e), "fetched_at": dt.datetime.now(dt.timezone.utc).isoformat()}
            failures += 1
            continue
        with open(os.path.join(outdir, fname), "wb") as fh:
            fh.write(data)
        manifest["files"][fname] = {
            "source": s["id"], "url": url, "licence": s.get("licence"), "layer": s.get("layer"),
            "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest(),
            "fetched_at": dt.datetime.now(dt.timezone.utc).isoformat(), "seconds": round(time.time() - t0, 1)}
        print(f"ok     {s['id']}  {len(data)/1e6:.1f} MB  {time.time()-t0:.0f}s")
        json.dump(manifest, open(mpath, "w"), indent=1)
    json.dump(manifest, open(mpath, "w"), indent=1)
    print(f"\nmanifest: {mpath}  ({len(manifest['files'])} entries, {failures} failures)")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
