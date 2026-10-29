### feat(revision.city): send logs and traces to Honeycomb

revision.city now also sends its Workers logs and traces to Honeycomb, through the `honeycomb-logs`
and `honeycomb-traces` destinations. Grafana Cloud still gets them too. After a side-by-side week, a
later change removes the Grafana destinations.
