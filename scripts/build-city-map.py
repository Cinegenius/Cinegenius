#!/usr/bin/env python3
"""Project an explicitly supplied GeoNames cities15000.zip onto existing city IDs.

No network requests, database writes, or changes to the canonical place catalogue.
Usage: python3 scripts/build-city-map.py /path/to/cities15000.zip
"""
import argparse
import hashlib
import json
import math
import zipfile
from datetime import datetime, timezone
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("archive", type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
catalog_path = root / "lib/places/catalog.json"
cities = {city["id"]: city for city in json.loads(catalog_path.read_text())["cities"]}
coordinates = {}
with zipfile.ZipFile(args.archive) as archive:
    for line in archive.read("cities15000.txt").decode("utf-8").splitlines():
        fields = line.split("\t")
        key = "geonames:" + fields[0]
        city = cities.get(key)
        if not city or city["country"] != fields[8] or fields[6] != "P" or fields[7] in {"PPLH", "PPLQ", "PPLW", "PPLX"}:
            continue
        lat, lng = float(fields[4]), float(fields[5])
        if math.isfinite(lat) and math.isfinite(lng) and abs(lat) <= 90 and abs(lng) <= 180:
            coordinates[key] = [fields[8], lat, lng]
if set(coordinates) != set(cities):
    raise SystemExit("Incomplete catalogue coverage; review the source before replacing map data.")
output = root / "lib/places/city-coordinates.json"
output.write_text(json.dumps(dict(sorted(coordinates.items())), ensure_ascii=False, separators=(",", ":")) + "\n")
source = {
    "source": "https://download.geonames.org/export/dump/cities15000.zip",
    "format": "https://download.geonames.org/export/dump/readme.txt",
    "license": "https://creativecommons.org/licenses/by/4.0/",
    "generatedUtc": datetime.now(timezone.utc).isoformat(),
    "inputSha256": hashlib.sha256(args.archive.read_bytes()).hexdigest(),
    "catalogSha256": hashlib.sha256(catalog_path.read_bytes()).hexdigest(),
    "coordinateSha256": hashlib.sha256(output.read_bytes()).hexdigest(),
    "matchedCities": len(coordinates), "catalogCities": len(cities),
    "selection": "Exact existing GeoNames ID and matching country only; populated places; no name matching, private addresses or catalogue ID changes.",
}
(root / "lib/places/city-coordinates-source.json").write_text(json.dumps(source, indent=2) + "\n")
print(f"Verified {len(coordinates)} existing city coordinates.")
