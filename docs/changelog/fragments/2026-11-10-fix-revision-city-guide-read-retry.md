### fix(revision.city): retry the guide read before reviewing without guides

The review reads the `AGENTS.md` guides at the base commit for each reviewer's prompt. Before, any
failure of that read, such as one GitHub 502, gave a review without the guides at once. Because the
guides are part of the key for saved chunk reviews, each chunk then missed its saved result, and the
run paid for it again. Now a failure before the last attempt of the `read pull request and guides`
step throws, so the Workflow retries the step. Only the last attempt reviews without guides, as
before.
