### refactor(revision.city): remove the rate limiting binding from the entity diff route

In production, the Workers rate limiting binding from #849 never returned a 429. Loops of quick
requests from one IP got only 400s. Cloudflare's docs say that each check uses a locally cached
count, and that requests can exceed the limit before the shared count updates. This removes the
binding, the route's limit check, and its IPv6 key. Its replacement is a rate limiting rule on the
revision.city zone, a dashboard step that #871 tracks. After a 429, the viewer still waits 10
seconds and sends the batch again. The dev worker and its previews have no limit, the same as before
#849.
