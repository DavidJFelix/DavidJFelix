### feat(harness-opencode): run the caller's tools in the review agent

`ReviewAgent.ask` now also takes a request: a prompt, a system prompt, tool definitions, a callback
that runs a tool, and a step limit. The model sees only the system prompt and the tools of the
request. The callback is a function stub of Workers RPC, so each tool runs in the caller. Thus the
harness does not know GitHub, and each later harness can get the same tools. The answer has a new
field, `toolCalls`, and its findings are the final text of the answer.

OpenCode's own tools need a local disk and a shell, and the model does not get them now. A deny rule
on the review agent turns off Code Mode, so the model does not get the `execute` tool either. That
tool runs JavaScript with `fetch`. Before this change, each model call carried a system prompt of
8,616 characters and 13 tools in 16,012 characters of JSON. A prompt string, which revision.city's
probe still sends, now gets the system prompt `Answer the prompt.` and no tools. With the three read
tools of the reviews, the tools are 1,589 characters.

OpenCode sets up one instance for each set of tools, and the requests with the same tools share it.
Thus two requests with different tools at the same time do not see the tools of each other. Only the
memory of the Durable Object holds the callbacks. A session whose caller is gone stops before its
next model call. That is the case after an eviction, when OpenCode continues the turn, and after a
callback fails.

The smoke test now also sends three requests with one tool each at the same time. It fails if the
model gets a tool or a system prompt of another request, or a tool that OpenCode adds. It also fails
if a tool result is not in the next model call, or if a failed callback does not end the turn.
