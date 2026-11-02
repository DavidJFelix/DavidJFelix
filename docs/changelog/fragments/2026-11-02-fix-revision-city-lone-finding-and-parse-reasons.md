### fix(revision.city): accept a lone finding and say why an answer does not parse

On #915's review, 2 of 8 failed chunk reviews were one real finding without the
`{"findings": [...]}` list around it. That finding now counts as a list of one, unless the token
limit cut the answer. A failed answer now says more than "No findings list": it says when the answer
is a tool call or a message written as text, or an empty object. A `submit_answer` call that the
token limit cuts now gets the second run that a cut text answer gets, and fails as "Answer cut at
the output token limit" after it.
