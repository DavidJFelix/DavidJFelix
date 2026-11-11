### fix(revision.city): read a bare findings list and fail on loose findings

A review answer can be a JSON array with no object around it. That array now counts as the findings
list. Before, the parser kept only the first finding of the array and saved the short result with no
failure. Two or more findings with no list around them, for example an array inside prose or a
Markdown fence, now give a failed chunk review. Its reason is "No findings list: N findings without
a list around them". The engine does not save a failed chunk review, so the next run asks the model
again. One finding with no list still counts as a list of one.
