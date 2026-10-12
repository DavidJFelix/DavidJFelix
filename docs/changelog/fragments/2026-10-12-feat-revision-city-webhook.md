### feat(revision.city): check GitHub webhooks and decide which events start a review

`handleReviewWebhook` checks the HMAC signature of a GitHub App webhook against its body. It starts
a review Workflow only for a `pull_request` event that the trigger rules accept. A review starts
when a pull request in an allowed repository opens, gets a push, reopens, or becomes ready for
review. It does not start for a draft, or when the author is a bot or has no access to the
repository. Adding the `Revision City` label to an open pull request starts a review in these cases
too. A repeated delivery of one event does not start a second review. Until billing exists, only
this repository is allowed. No route serves the handler yet.
