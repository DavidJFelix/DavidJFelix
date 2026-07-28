### feat(forzamonica.com): social links, shop link, and newsletter signup on the landing

The coming-soon landing grows the pre-launch essentials: outline Instagram and Facebook icon links
(instagram.com/forzamonica, facebook.com/forzamonica), a secondary-button link to the current shop
at forzamonica.shop, and an email signup for the mailing list. The signup posts straight to a Loops
(loops.so) form's public endpoint from the browser -- no API key involved -- and stays dark-safe
until the real endpoint is pasted into `src/lib/loops.ts`: submissions fail soft into the form's
error state rather than pretending to subscribe anyone.
