### test(revision.city): reset spies, env and globals between tests

The test runner now restores spies, env stubs and global stubs before each test, so a failed test no
longer leaves them in place for later tests in the same file. The two sign-in tests for missing app
credentials now set the two variables to empty values, so they pass when the shell exports the
GitHub App credentials.
