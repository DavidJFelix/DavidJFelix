### fix(revision.city): retry when OpenRouter puts a provider error inside an answer

When a provider accepts a request and then fails, OpenRouter can answer 200 with the error in the
first choice, next to a partial answer. The review used the partial answer as the model's answer. So
a cut-off answer failed to parse, or, if it held a complete JSON object, passed as a clean review
and was saved. Now the review treats this answer as a temporary failure and sends the request again,
as it does for an error at the top level of the answer.
