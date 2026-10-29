### fix(revision.city): put the answer-now note in the last tool result

On #882, one chunk review answered with the "tools are off" note itself, written as a JSON user
message, instead of its findings. The loop sent the note as a separate user message after the tool
results. It now adds the note to the end of the last tool result, so no user message follows the
tool results.
