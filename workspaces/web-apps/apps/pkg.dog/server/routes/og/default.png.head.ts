// Nitro mounts one route file per method suffix and its h3 router has no
// HEAD-to-GET fallback -- a HEAD on the card fell through to the page renderer
// and answered the HTML document -- so HEAD is mounted beside GET on the same
// handler, which answers it with GET's headers and no body.
export {default} from './default.png.get'
