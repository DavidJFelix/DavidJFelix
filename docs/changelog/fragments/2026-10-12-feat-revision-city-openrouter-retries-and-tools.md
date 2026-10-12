### feat(revision.city): retry OpenRouter requests and support tool calls

When a request fails for a temporary reason, the OpenRouter client tries it up to two more times, after 2
and then 8 seconds. Temporary reasons are a network error, a 408, 429, 500, 502, 503, or 504 status,
and an error object in a 200 response. Other failures, such as a bad key or a response the client
cannot read, do not cause a retry. An `OpenRouterError` says whether its cause is temporary. The
client now sends a list of chat messages, can offer tools, and returns the model's tool calls. The
reviewers do not use tools yet.
