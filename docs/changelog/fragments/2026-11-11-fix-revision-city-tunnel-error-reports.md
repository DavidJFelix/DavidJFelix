### fix(revision.city): stop reporting Sentry tunnel 5xx answers to Sentry

The server reported each 5xx answer as a Sentry issue, so a 503 from Sentry ingest that the `/bugs`
tunnel passed on to the browser became a revision.city issue. That answer is a Sentry failure, not
an app failure, and Honeycomb showed it was 1 of 10,010 forwards in 7 days. The reporter now skips
the tunnel route. A tunnel that throws is still captured by `withSentry`.
