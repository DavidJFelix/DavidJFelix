### test(revision.city): replay saved step results in the review run tests

The review run tests now restart a run, as a Cloudflare Workflow instance restarts. A new step fake
keeps a copy of each step result. A first run stops after a given step, and a second run gets the
kept results back. For a stop after each of six steps, the test checks that the two runs together
make one check run, one review, one check run update, one summary comment, one set of model calls
and one run event. A change that runs a finished step again now fails a test, and does not post a
second review on a real pull request.
