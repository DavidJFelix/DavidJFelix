### docs(revision.city): record what telemetry may hold

The revision.city plan now has a "Telemetry and privacy" section. PostHog, Honeycomb and Cloudflare
Workers Logs may hold repository names and file paths. Sentry holds route templates, and no service
holds private code. The section also says which parts of the rule the code does not follow yet.
