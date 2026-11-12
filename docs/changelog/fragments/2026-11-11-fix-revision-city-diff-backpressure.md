### fix(revision.city): read the GitHub diff only as fast as the client reads

The diff route copied the GitHub diff into its response as fast as GitHub sent it. When the browser
read more slowly, for example while it parsed each file of a very large diff, the unread rest of the
diff waited in the Worker's memory. The route now reads one chunk from GitHub only when the browser
asks for one, and a cancelled load now also cancels the GitHub body.
