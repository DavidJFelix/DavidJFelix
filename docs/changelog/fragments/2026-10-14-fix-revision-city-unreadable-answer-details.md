### fix(revision.city): show why a chunk answer did not parse

When no JSON object in an answer had a findings list, the check run showed the schema error of the
first object. If the answer is cut off or has an error in its JSON, that object is a finding inside
the answer. So the check run said "expected array, received undefined" and hid the cause.

Now the failure shows the parse error of the longest top-level object that is not valid JSON, which
is most likely the answer. An object starts with a brace, then optional white space, then a quote or
a closing brace. So a brace in prose, such as `{x}`, does not count. If all objects are valid, it
says "No findings list", or "No JSON object" when the answer has none. Then it shows the length of
the answer and its first and last 40 characters. Each failure is now in a code span, so Markdown
does not change the quoted answer.
