### fix(revision.city): report render errors to Sentry and show an app error panel

When a page throws while it renders, the router now shows an app panel with a "Try again" button in
place of its stock "Something went wrong!" panel, and it sends the error to `reportError`, so
Sentry's global handler records it. Before, the router caught the error and only wrote it to the
console, so Sentry never saw it. The panel does not show the error text.
