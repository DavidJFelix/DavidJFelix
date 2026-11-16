### fix(revision.city): read a findings list sent as JSON text with prose after it

A chunk review whose `findings` value is JSON text no longer fails when the model adds prose or a
closing Markdown fence after the array, or opens the text with a fence. The parser reads the array
from its `[` to the matching `]` and ignores the rest. This replaces the earlier rule that removed
only trailing braces.
