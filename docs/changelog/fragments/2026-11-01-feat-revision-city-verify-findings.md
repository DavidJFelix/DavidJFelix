### feat(revision.city): check each finding before it posts

A second tool loop now checks each finding that a chunk review would post, at most 5 for each chunk
review. The check reads the code that the finding depends on and must quote the lines that show the
problem. A confirmed finding gets that proof in its comment. A rejected finding is not posted, and
the check run lists it under "Not checked, so not posted". When a check fails or does not parse, its
finding is not posted and the chunk review is not saved, so the next run checks it again. The saved
result key version is now 2, so the first review after this change pays again for each chunk review.
