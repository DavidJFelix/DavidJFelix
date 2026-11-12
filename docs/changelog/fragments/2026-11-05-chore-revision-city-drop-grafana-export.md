### chore(revision.city): stop sending logs and traces to Grafana Cloud

revision.city now sends its Workers logs and traces only to Honeycomb. Both destinations ran side by
side for a week, and Honeycomb got the review run and model call events the whole time. The other
apps still send to Grafana Cloud.
