### refactor(revision.city): move the Workflow step adapter into a tested helper

The review Workflow now gets its step function from `createRunStep` in `src/reviews/lib`. The helper
gives each step body its attempt number and marks only attempt `limit + 1` as the last attempt. A
new test fakes the Cloudflare retries and checks that mapping. The behavior does not change.
