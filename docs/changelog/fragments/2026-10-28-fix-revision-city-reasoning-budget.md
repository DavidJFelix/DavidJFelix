### fix(revision.city): keep tokens for the review answer after reasoning

After #879, the failed chunk reviews on #876 all said "Empty answer: finish reason length, 32000
output tokens": the model used all of its output tokens to reason and wrote no answer. Each such
failure costs about $0.06 on DeepSeek V4.1 Flash. Each request now asks OpenRouter for medium
reasoning effort, which keeps about half of the 32,000 tokens for the answer.
