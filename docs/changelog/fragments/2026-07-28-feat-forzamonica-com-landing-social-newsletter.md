### feat(forzamonica.com): social links, shop link, and newsletter signup on the landing

The coming-soon landing grows the pre-launch essentials: outline Instagram and Facebook icon links
(instagram.com/forzamonica, facebook.com/forzamonica) pinned to the top-right corner, an underlined
external link to the current shop at forzamonica.shop marked with a box-and-arrow icon, and a
mailing-list signup below it. The signup runs through a server function that calls the Loops
(loops.so) Contacts API, keeping the API key server-side as a Worker secret, and stays dark-safe
until `LOOPS_API_KEY` is set: submissions fail soft into the form's error state rather than
pretending to subscribe anyone.
