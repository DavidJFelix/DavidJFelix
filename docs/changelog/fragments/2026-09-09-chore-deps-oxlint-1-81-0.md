### chore(deps): update oxlint to 1.81.0 and settle the onvibes.org streaming assertion

Renovate's oxlint bump failed CI on `@davidjfelix/onvibes.org#test`, in the browser test that
streams a reply into the active conversation: the last `onMessagesChange` call still carried the
reply one delta short. The bump itself was clean (root `package.json` and `bun.lock` only) and the
lint run passed; the test raced React. The locator assertion settles as soon as the final delta is
painted, but the `useEffect` that reports the messages upward flushes after that paint, so a
synchronous read of the mock could see the previous commit. The assertion now polls the mock's last
call with `expect.poll`, like the scroll assertions in `conversation-view.test.tsx`.
