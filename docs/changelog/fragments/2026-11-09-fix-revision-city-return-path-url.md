### fix(revision.city): resolve the sign-in return path as a URL

The return path after sign-in and sign-out is now parsed with the URL rules that the browser uses.
Only a path that stays on this site is kept, and the redirect sends the parsed path. Before, the
check looked at single characters, so some values that a browser reads differently got through.
