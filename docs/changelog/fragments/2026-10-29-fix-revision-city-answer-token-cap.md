### fix(revision.city): raise the chunk review output cap to 32,000 tokens

On #887, a chunk review on DeepSeek reasoned up to the 16,000-token output cap twice and gave no
answer, so the Revision City check failed with no findings. On 2026-10-29, 14 of 141 DeepSeek
answers were cut at the cap. The answers that finished spread evenly up to 16,000 tokens, so most
cut answers were long, not stuck in a loop. The cap is now 32,000 tokens. The second run of a cut
review stays. A review cut on both runs can now use 32,000 more output tokens, about $0.01 at the
prices on the #887 check.
