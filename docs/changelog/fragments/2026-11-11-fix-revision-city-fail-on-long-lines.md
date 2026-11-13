### fix(revision.city): fail the check on a file with a too-long diff line

A file with a diff line longer than 5,000 characters gets no review, so the check passed while the
file's change went unseen. The check now fails on such a file and counts it in the title. Resolved
threads cannot clear this failure.
