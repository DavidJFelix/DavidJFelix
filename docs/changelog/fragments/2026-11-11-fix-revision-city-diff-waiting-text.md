### fix(revision.city): say what the diff page is waiting for

When the patch was loaded and the syntax highlighter was still starting, the loading panel said
that files were streaming in, but no file showed. The panel now says that it waits for the
highlighter. The fetch text also names the real host, so a Codeberg diff no longer says that the
patch comes from GitHub.
