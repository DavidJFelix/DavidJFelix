### fix(revision.city): run a chunk review again when the token limit cuts it

After #882, one chunk review on #876 still used all 16,000 output tokens to reason and gave an empty
answer. A review that the token limit cuts now runs once more. At temperature 1.0, the second run
reasons differently, so it often finishes. The check fails only when the second run is also cut.
