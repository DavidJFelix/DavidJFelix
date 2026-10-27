### fix(revision.city): log why a GitHub sign-in fails

A failed sign-in answered 502 with "GitHub sign-in failed" and kept no cause, so a 502 in Workers
Logs did not show which GitHub call failed or why. Now each failed GitHub auth call logs one
`github auth failure` event with the step (`code exchange`, `token refresh`, or `user lookup`), the
HTTP status, and GitHub's error name and description, such as `bad_verification_code` or
`unverified_user_email`. The event never contains the code or a token. The responses do not change.
