### ci(web-apps): preview a canary app when a change affects no app

The preview workflow starts on changes to repo-root tooling, such as `bin/`, the composite actions
and the tool pins. Turbo cannot see those files, so it found no affected app and the workflow
previewed nothing. A break in the preview path then showed first on the next app pull request. Now,
when the preview plan finds no app, it previews revision.city on its dev worker. Deploys on main do
not change.
