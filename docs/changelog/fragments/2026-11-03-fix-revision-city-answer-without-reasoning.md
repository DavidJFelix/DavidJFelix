### fix(revision.city): ask for the answer without reasoning after a cut reply

On #938, 3 of 24 chunk reviews failed with an empty answer. Each one used all 32,000 output tokens
to reason, two times, because a cut review ran again from the start and reasoned as long the second
time. Now, when the output token limit cuts a reply, the review does not run again. It makes one
more call on the same conversation with the reasoning off and `submit_answer` as the only tool, so
the model answers from the files that it read before the cut. An answer without reasoning is short,
so this call costs less than a second run. The `model call` log events show `reasoningEffort` as
`none` for this call, and they no longer have a `run` field.
