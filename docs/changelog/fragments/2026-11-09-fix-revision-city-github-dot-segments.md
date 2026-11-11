### fix(revision.city): reject dot segments in GitHub diff paths

The GitHub diff source and the GitHub file loader now reject a path or file name with a `.` or `..`
segment, as the Codeberg side already does. Both sources also reject a compare range that decodes to
a dot segment. `hasDotSegment` moved to `github-diff-source.ts`, so both sides use one copy.
