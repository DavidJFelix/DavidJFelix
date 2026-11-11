### fix(revision.city): take the text answer when submit_answer has empty arguments

A `submit_answer` call with an empty object (`{}`) was used as the answer even when the reply text
held a JSON answer, so the chunk review failed and the next run paid again. The tool loop now takes
the reply text when the call has blank arguments or an empty object and the text has a JSON object.
With no JSON in the text, the empty object stays the answer and fails as before.
