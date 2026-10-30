### feat(revision.city): show public Codeberg diffs

The diff viewer now opens Codeberg pull requests, commits, and compares. Paste a `codeberg.org` URL,
or open `/diffs/<owner>/<repo>/pulls/<n>?domain=codeberg.org`. Pull requests and commits come from
the Codeberg API (`/api/v1/repos/<owner>/<repo>/pulls/<n>.diff` and `git/commits/<sha>.diff`). The
API has no diff form of a compare, so compares come from the `.diff` form of the compare page. Only
public repositories work for now, and full-file expansion and symbol changes stay off for Codeberg
diffs.
