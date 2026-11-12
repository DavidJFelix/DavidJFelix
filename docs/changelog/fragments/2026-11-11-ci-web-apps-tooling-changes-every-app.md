### ci(web-apps): preview and deploy every app when a change affects no app

The preview and deploy workflows start on changes to repo-root tooling, such as `bin/`, the
composite actions and the tool pins. Turbo cannot see those files, so it found no affected app, and
the workflows previewed and deployed nothing. A tooling change then reached each app only with that
app's next change, and a break looked like that change's fault. Now, when the plan finds no app in
the shared matrix, it takes every app: the preview tests the tooling change on every app, and the
deploy on main ships every app built with it.
