### feat(revision.city): limit findings per answer and do not review diffs over 1500 lines

One model answer now adds at most 20 findings to a review, and they are the most severe ones. A
title longer than 200 characters or a body longer than 3000 characters is cut short. A suggestion
longer than 3000 characters is dropped, because a cut suggestion would replace the lines with broken
code. By default, a file whose diff has more than 1500 lines is not reviewed. A caller can change
this limit with the `maxPatchLinesPerFile` option. `fileReviewStatus` tells why a file is not
reviewed: skipped by design, no text diff, or a diff that is too large.
