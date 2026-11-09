### fix(revision.city): reject dot segments in GitHub diff paths

The GitHub diff source and the GitHub file loader now reject a path or file name with a `.` or `..`
segment, as the Codeberg side already does. `hasDotSegment` moved to `github-diff-source.ts`, so
both sides use one copy.
