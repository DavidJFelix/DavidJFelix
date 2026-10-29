### fix(revision.city): send the model's reasoning back between tool rounds

Chunk reviews on DeepSeek V4.1 Flash sometimes wrote a tool call as JSON text instead of calling the
tool. The tool loop dropped the model's reasoning after each round. DeepSeek requires that a request
with tools sends back the reasoning of each earlier reply, and OpenRouter recommends the same for
tool calling. The loop now keeps the `reasoning` and `reasoning_details` of each tool call reply and
sends them back with that assistant message.
