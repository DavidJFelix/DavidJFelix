### fix(harness-opencode): ask OpenRouter for the model that the reviews use

The first probe from a review run in production reached OpenRouter through the harness Worker, and
OpenRouter accepted the key. It then refused the model `deepseek/deepseek-v4.1-flash-1017`: the
guardrail of the OpenRouter workspace of the key does not allow that model. `ReviewAgent` now asks
for `deepseek/deepseek-v4.1-flash`, which is the model of the reviews today and which the guardrail
allows. With the same model in the harness and in the tool loop, a comparison of the two measures
only the harness.
