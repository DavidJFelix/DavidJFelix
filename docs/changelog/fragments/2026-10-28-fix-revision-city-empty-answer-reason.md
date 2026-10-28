### fix(revision.city): say why a chunk review answer is empty

After #877, 6 of 18 chunk reviews on #876 failed with an empty answer, and that run cost $0.23 where
the run before cost $0.006. The check run said only "No JSON object" and did not say why. Now an
empty answer fails with OpenRouter's finish reason (`length` means the reply used up its token
limit) or with the count of tool calls that the model made after the tools were off, plus the output
token count. The failure is not retried, because a retry would pay for the same empty answer again.
