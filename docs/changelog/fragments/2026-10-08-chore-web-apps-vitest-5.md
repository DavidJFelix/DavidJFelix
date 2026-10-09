### chore(web-apps): move to Vitest 5

In browser mode, Vitest 5 makes `toHaveTextContent` require an exact text match; the old substring
check moved to the new `toMatchTextContent` matcher. The onvibes.org reply-failed alert holds both
the message and the "Try again" button, so the two tests that check only its message now use
`toMatchTextContent`.
