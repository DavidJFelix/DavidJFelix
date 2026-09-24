### feat(revision.city): unfurl a shared diff link as the diff it names

Every link below `/diffs` unfurled the same way: "Diffs · revision.city", the generic viewer blurb,
and the site card, with only `og:url` naming the page. A pull request, commit, or compare link now
carries its own title, description, document title, and 1200x630 card. The text comes first from the
URL itself -- `acme/widgets #7`, `acme/widgets @ 83fea5e`, `acme/widgets v1.0...v2.0` -- so every
GitHub link says at least its repository and what in it. A pull request GitHub shows to anyone leads
with its title and adds the author, the state (draft, merged, closed), and the file and line counts:
"Add widgets · acme/widgets #7", "Pull request #7 by maintainer in acme/widgets: 2 files changed,
+12 -3."

The rule for private diffs is that the card may carry only what the link already reveals. The pull
request lookup never authenticates as the visitor or as an installation; it sends the app's own
client id and secret as basic auth, which GitHub answers with public data only at the app's rate
limit rather than the anonymous per-address one the Worker shares with every other Worker, and
retries once anonymously if GitHub ever rejects them, remembering the rejection for an hour. A
private or missing pull request, or GitHub not answering within two seconds, falls back to the
URL-only text, and since GitHub answers 404 for both, the card is no oracle for whether a private
repository exists. Lookups are kept in the Workers cache for an hour (a miss for five minutes), so a
shared link costs one GitHub call per pull request per edge, not one per scraper; a card drawn
without GitHub's answer is cached for those same five minutes rather than the hour. The viewer
route's loader runs the lookup through a server function, so the same title also names the tab.
Parsing a diff path no longer throws on a compare range that does not percent-decode (a ref with a
stray percent sign): the range is taken as written, where the route used to fail.

The card lives at `/og/diffs/<path>.png`, mirroring the viewer path, rendered on the Worker from the
same text in the diffs dark theme with an added-to-deleted accent bar, and cached for an hour;
`@davidjfelix/og` grew `ogCards` for it, the per-request form of `ogCard` that resolves a card from
the request and answers 404, uncached, when the path names none. Both card routes now key that edge
cache on the deployed Worker version (the version metadata binding), because a rendered card
outlives the deploy that drew it: a deploy starts from an empty card cache instead of serving the
previous version's cards until they expire, which is how the preview's e2e run came to read the
cards of the deploy before it. Paths under an alternate domain (`?domain=`) keep the generic text
and the site card, since only GitHub paths have a shape the viewer can name, and `og:url` and the
canonical link now carry that `domain` query: the root route builds the shared path from the leaf
match's validated search params, where before a tangled.org link canonicalized to the GitHub reading
of the same path. Unit tests cover the share text, the card path round trip, and the lookup's auth,
caching, timeout, and fallback branches; the e2e suite asserts the rendered head and fetches the
card against a repository name GitHub cannot host, so it never depends on live content.
