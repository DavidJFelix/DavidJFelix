### fix(tooling): let the playwright apt cache actually save

The `setup-playwright` composite action (and the copy inlined in `preview-wrangler`) has cached
Chromium's apt `.deb` archives under `~/.cache/playwright-apt` since 2026-07-27, but the save never
once succeeded: every run logged `Cache not found for input keys: playwright-apt-Linux-<version>`,
took the cold `playwright install-deps` path, and then the post step failed with
`tar: ../../../.cache/playwright-apt/lock: Cannot open: Permission denied` (and the same for
`partial`), exit code 2, throwing the downloads away. The warm `dpkg -i` path was never exercised.

The cold path runs apt as root (`install-deps` wraps it in sudo), and apt leaves the archive
directory in a state the runner user cannot read: it creates a root-owned `lock` (mode 0640) and
takes over the `partial/` directory (owner `_apt`, mode 0700) -- the same run also warns that it
downloads as root rather than as `_apt`, because `_apt` cannot reach the runner's home. The cache
save runs tar as the runner user, which cannot open either entry, so the whole archive is abandoned.

`bin/install-playwright-deps.ts` now ends the cold path by handing the directory back: `chown -R` to
the current uid and gid, then remove `lock` and `partial/`, which are apt's working state rather
than cache content and which apt recreates on its own next time. The script also stops pre-creating
`partial/`, since apt creates it and takes it over regardless; only the cache directory itself needs
to exist before apt runs. Reproduced locally with a non-root user and apt 2.8.3: the same two tar
errors before the cleanup, a clean archive of just the `.deb` files after it.
