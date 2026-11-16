### fix(ci): name the repository for gh in Depot CI workflows

The changelog roll-up failed at `gh pr list` with "no git remotes found". The Depot Code checkout
does not add a github.com remote, so `gh` cannot find the repository from git. The roll-up step and
the `gh pr comment` and `gh pr edit` steps of the two snapshot bots now set `GH_REPO` to the run's
repository.
