### fix(revision.city): give the review answer as a submit_answer tool call

After #894, 28 of 105 chunk reviews on #910 failed, and only 1 of them at the output token cap. 85
of 100 answers came on the last round, after the tools went off, and there the model often wrote the
tool calls that it still wanted as text, which does not parse. A reviewer with tools now gives its
answer as the arguments of a `submit_answer` tool call. On the last round, `submit_answer` is the
only tool, and the request makes the model call it. A text answer still counts, for a provider that
does not support a required tool call. The system prompt changes, so the first review after this
change pays again for each chunk review.
