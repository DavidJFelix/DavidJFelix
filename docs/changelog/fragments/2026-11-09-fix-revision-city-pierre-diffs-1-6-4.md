### fix(revision.city): update @pierre/diffs to 1.6.4

In @pierre/diffs 1.6.4, the second argument of `parsePatchFiles` is an options object, not a cache
key string. The diff viewer now gives the cache key as `cacheKeyPrefix`, so the typecheck passes
with the update.
