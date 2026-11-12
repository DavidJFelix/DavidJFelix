### test: compare every app's share card with a committed PNG

The Playwright suites of revision.city, startchi.com, ravrun, forzamonica.com, davidjfelix.com,
monicandavid.com, pkg.dog, and djf.io now fetch each share card route and compare the PNG with a
committed baseline, with the same 1% allowance as their page screenshots. revision.city also checks
its pull request and compare cards. djf.io checks its default card and one fixed post, so a new post
does not need a new baseline.
