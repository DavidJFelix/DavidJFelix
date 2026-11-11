### feat(revision.city): log the verdict of each finding check

Each finding that the review would post goes through a check, and until now the result of that
check was not logged. The check now logs one `finding check` event per such finding, with the
reviewer, the file path, the finding number, the severity and the verdict: `confirmed`, `rejected`,
`failed`, `unparsed` or `over-limit`. A count of verdicts by reviewer shows if the check rejects
more findings from one reviewer. The prompts do not change, so saved chunk reviews stay valid.
