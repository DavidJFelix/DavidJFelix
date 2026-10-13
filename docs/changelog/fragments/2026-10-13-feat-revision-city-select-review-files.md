### feat(revision.city): select the files that a review covers

`selectReviewFiles` picks the files of a pull request that a review covers, in GitHub's order. It
leaves out lockfiles, generated files, and removed files with no note. It lists each file with no
text diff, a diff longer than 1500 lines, or a diff over the review size limit, so that the check
run can show what was not reviewed. The files to review fit in 700,000 bytes, because a Cloudflare
Workflow keeps at most 1 MiB for each step result. The list of files that it cannot review stops
after 65,000 characters, because the check run cuts its text there. Nothing calls it yet.
