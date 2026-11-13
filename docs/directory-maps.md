# Shared directory maps

Crew, marketplace, locations and companies use `LocationMap`. Company list, filters
and map share the same published rows. The server reads the company directory in
stable pages instead of stopping at 200; query failures use the page error/retry
boundary. Private companies, responsible-person snapshots and street addresses are
not part of this projection. Coordinates are approximate public city centres from
the existing canonical place resolver, not inferred private addresses.

The original CineGenius style in `lib/map-style.ts` uses soft blue water, sage green
land cover and pale neutral land, with dark brand controls and green markers. It uses OpenFreeMap vector tiles
with the documented OpenMapTiles schema. It is not a copy of a proprietary map
style. OpenFreeMap explicitly allows commercial website/app use and currently
requires neither a subscription nor an API key. Its public service has no SLA.
Keep the visible linked OpenMapTiles and OpenStreetMap attribution; OpenFreeMap is
also credited. GeoNames attribution below directory maps remains necessary for
the separate city-coordinate catalogue.

Sources checked 13 November 2026:

- https://openfreemap.org/ (commercial use, attribution, public service)
- https://openfreemap.org/tos/ (service terms; no availability guarantee)
- https://openfreemap.org/privacy/ (technical requests, possible CDN, logs)
- https://openmaptiles.org/docs/schema/ (CC BY schema and required attribution)
- https://www.openstreetmap.org/copyright (ODbL map data)
- https://github.com/maplibre/maplibre-gl-js (BSD-3-Clause renderer)
- https://github.com/maplibre/maplibre-gl-leaflet (ISC integration)

The renderer and its worker are bundled locally and loaded with the map. Remote
requests go to `tiles.openfreemap.org` for public basemap tiles and fonts. Member
names, profiles, messages and marker data are not uploaded to the map provider.
The privacy page lists this provider and describes browser requests; this is a
technical inventory update, not a new legal compliance certification.

Keep the existing Leaflet viewport, clusters, approximate-location circles and
history behavior. MapLibre only renders the background; locale changes update its
labels without recreating the map. Two workers bound background processing. Errors
keep the list available and offer an explicit retry; unsupported WebGL must fail
visibly rather than leave a silent empty map. Browser simulations do not establish
native iOS/Android compatibility or physical-device GPU performance.
