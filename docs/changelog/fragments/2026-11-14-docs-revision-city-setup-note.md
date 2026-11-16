### docs(revision.city): add a setup note and a .dev.vars.example

revision.city now has a `README.md` that says how to set up, run and test the app, how to make the
local D1 database, which build-time names it reads, and how the review webhook is signed. A new
`.dev.vars.example` lists the local secret names, without values. The app's `.gitignore` now also
ignores `.dev.vars.<env>` files. The note is a `README.md`, not an `AGENTS.md`, because the review
engine sends the nearest `AGENTS.md` with each model call.
