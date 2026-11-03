### fix(revision.city): read findings sent as a JSON string or under a misspelled key

On #938's review, the review model sent two answers with the findings list as a JSON string. The
parser did not read them, so the review lost one medium and one low finding to "No findings list"
failures. A `findings` string that parses as a JSON array now counts as the list, in a text answer
and in a `submit_answer` call. The list also counts under the key `finding`, and under the key
`answer` as an object or a JSON string. A `findings` string that is not a JSON array still fails,
with the reason "the findings are a string that is not a JSON array".
