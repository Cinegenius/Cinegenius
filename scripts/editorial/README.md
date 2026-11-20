# Reviewed newsroom runtime source

Versioned mirror of Agent NEWS's runtime handoff dated 21 November 2026.
Production runtime stays at `/srv/cinegenius/news-agent/runtime`; committing or
publishing the website does not install or enable these scripts there.

`run-research-and-publish.sh` mirrors runtime `bin/run-research.sh`. It holds the
existing overlap lock and separately observes publisher, expiry and feedback
activation markers. Research, source verification, image selection, verified input upload and independently expected derivative
hash readback, scoped legacy expiry, and aggregate feedback are separate
controllers. Provider credentials and private source evidence are not in Git.

Run isolated tests: `python3 -m unittest discover -s scripts/editorial -p 'test_*.py'`.
The publisher test patches ROOT to its temporary directory so current production
activation markers cannot switch tests into real image or publication work.
Never execute a controller's main function as a unit test or create live markers
from a website release. Runtime installation/activation belongs to Agent NEWS.

See `docs/news-gallery-readership.md` and the release handoff for the schema/API
contract and remaining product acceptance. Gallery and feedback require actual
product acceptance first; legacy hides require specific reviewed admin grants.

## Exact image normalization proof

`normalize-media.cjs` independently computes the published upload guard's
orientation/2560px-inside/WebP-quality85/metadata-removal transform, using the
established release checkout's Sharp. It records Sharp/libvips/WebP versions.
Original source bytes remain private and unchanged. Originals exceeding the
4 MiB upload limit use a bounded upload derivative; the controller then computes
the second transform the server will actually apply. The expected final WebP is
visually reviewed, its digest is kept separate from original/input digests, and
both readback bytes and the server digest must match it before publication.
A returned server hash alone is never sufficient. A library/transform mismatch
must stop publication and trigger a reviewed recheck, not relax the comparison.
Required visible change/archival/credit/license information remains attached.

The real private Hungarian article canary matched the independently calculated
stored bytes on 21 November 2026. Public article and automatic media selection are now accepted in the separate
NEWS receipt. Readership remains disabled without its runtime read credential.
The mirrored suite contains 64 passing cases. The final review policy records
the observed chronology correction: import day never becomes an opening date.
