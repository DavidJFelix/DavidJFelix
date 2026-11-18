### perf(revision.city): cache the hashed client assets for a day

`public/_headers` now gives every file under `/assets/` the header
`Cache-Control: public, max-age=86400, immutable`. Before, Workers static assets sent
`max-age=0, must-revalidate`, so on each visit the browser asked again for each script, style, and
grammar file, and got a 304. Each of these files has a content hash in its name, so a changed file
gets a new URL. The local smoke check now fails if a hashed asset loses the immutable header.
