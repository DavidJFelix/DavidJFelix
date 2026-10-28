### fix(revision.city): stop reasoning loops in chunk reviews

After #881, the same two chunk reviews on #876 still failed on every run with "Empty answer: finish
reason length, 32000 output tokens". At temperature 0, the same prompt gives the same reasoning, so
the model repeated it until the cap each time. Requests now use temperature 1.0 and top_p 0.95,
which DeepSeek recommends for its V4 models, and the output cap is 16,000 tokens, so a loop that
still happens costs half as much.
