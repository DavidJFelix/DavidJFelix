### test(og): pin that share card text never reaches the SVG as text

satori is held at 0.32 for Cloudflare Workers, and that hold keeps advisory GHSA-wx4j-mvgx-mqwp
(improper escaping in the SVG) open. The share card is safe because its embedded fonts turn text
into glyph paths. A new test in the og package fails when input text gets into the SVG, and the
Renovate hold and the og README now name the advisory.
