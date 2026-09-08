#!/usr/bin/env python3
"""Validate every cities/<city>/ folder against core/schema. Exit 1 on any error."""
import glob, json, os, sys

import yaml
from jsonschema import Draft202012Validator

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
S = os.path.join(ROOT, "core", "schema")
schemas = {n: json.load(open(os.path.join(S, f"{n}.schema.json"))) for n in ("sources", "segments", "interventions", "sensors")}
errors = 0


def check(name, path, doc):
    global errors
    v = Draft202012Validator(schemas[name])
    errs = sorted(v.iter_errors(doc), key=lambda e: list(e.path))
    rel = os.path.relpath(path, ROOT)
    if errs:
        errors += len(errs)
        for e in errs:
            print(f"ERROR {rel}: {'/'.join(map(str, e.path)) or '<root>'}: {e.message}")
    else:
        print(f"ok    {rel}")


for city in sorted(glob.glob(os.path.join(ROOT, "cities", "*"))):
    check("sources", os.path.join(city, "sources.yaml"), yaml.safe_load(open(os.path.join(city, "sources.yaml"))))
    for corr in sorted(glob.glob(os.path.join(city, "*", ""))):
        seg_path = os.path.join(corr, "segments.geojson")
        seg = json.load(open(seg_path))
        check("segments", seg_path, seg)
        ids = {f["id"] for f in seg["features"]}
        for name in ("interventions", "sensors"):
            p = os.path.join(corr, f"{name}.yaml")
            if not os.path.exists(p):
                continue
            doc = yaml.safe_load(open(p))
            check(name, p, doc)
            # cross-check segment references
            refs = []
            if name == "interventions":
                for e in doc.get("entries", []):
                    if e.get("segments") != "all":
                        refs += e.get("segments", [])
            else:
                refs += [c["segment"] for c in doc.get("permanent_bicycle_counters", []) if "segment" in c]
            for r in refs:
                if r not in ids:
                    errors += 1
                    print(f"ERROR {os.path.relpath(p, ROOT)}: unknown segment id {r}")

print(f"\n{errors} error(s)")
sys.exit(1 if errors else 0)
