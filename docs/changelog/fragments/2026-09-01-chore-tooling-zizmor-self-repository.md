### chore(tooling): disable zizmor's self-repository audit on the Depot workflows

The mise patch/minor bump took zizmor to 1.30.0, which adds a `self-repository` audit flagging every
`uses: ./.depot/actions/...` step and asking for GitHub's `$/...` self-repository syntax. That
syntax is a github.com runner feature; Depot CI does not document support for it, and actionlint
1.7.12 rejects it as an invalid action reference, so applying the auto-fix would only move the
failure to the actionlint step. Disabled the audit in `.github/zizmor.yml` with the re-enable
conditions recorded beside it: actionlint accepting `$/` and Depot documenting support.
