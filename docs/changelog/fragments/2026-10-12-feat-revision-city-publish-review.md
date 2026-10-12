### feat(revision.city): post reviews and check runs to GitHub

`createCheckRun` and `completeCheckRun` start and finish the Revision City check on a commit.
`postReview` posts at most 50 of the reported findings, most severe first, as one review of inline
comments. It reads the fingerprints in the app's earlier review comments, and skips a finding that
the app already posted on the same path and line. GitHub refuses the whole review when it cannot
place one inline comment. Then `postReview` posts a review without inline comments, and its body
lists the findings. `removeLabel` takes a label off a pull request. Nothing calls these functions
yet.
