### fix(revision.city): stop review models writing tool calls as text

Most failed chunk reviews were a `read_file` call written as JSON text instead of an answer. This
was 10 of 15 chunks on #873 with DeepSeek V4.1 Flash, and 3 to 6 per push on the model before it.
Each request asked for JSON mode even while tools were on, and the last round took the tools away
without telling the model.

Now JSON mode is on only when the tools are off. The last round tells the model to answer now and to
leave out what it could not check. Each reply stops at 32,000 tokens. Before, a model that repeated
itself (one 393k-character answer on #873) could cost a lot for an answer that cannot parse.
