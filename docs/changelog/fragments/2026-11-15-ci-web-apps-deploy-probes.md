### ci(web-apps): probe sign-in and the review webhook after deploy

The production smoke fetched pages only, so a deploy without the sign-in credentials or without the
review Workflow still passed. After the pages pass, the revision.city production smoke now sends two
probes that carry no credential and change nothing: the sign-in config route must report
`configured` true, and an unsigned review webhook delivery must get 401, not 503. The registry in
`bin/plan-affected-apps.ts` has a `probes` list, which only the production deploy entry carries. A
failed probe marks the job red and does not roll back.
