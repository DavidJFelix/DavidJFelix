### build(revision.city): deny server-only modules in the client build

The client build now fails when a server-only module is still in a browser chunk after tree shaking.
The Vite config gives the TanStack Start import protection a list of these modules: the review
engine, the symbol grammar modules, the diff endpoints and file servers, the pull request modules,
and the GitHub sign-in module. Before this change, only the habit of each author kept this code out
of the browser. No module moves, and visitors see no change.
