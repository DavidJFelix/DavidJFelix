### fix(djf.io): skip analytics when the PostHog chunk does not load

When the browser cannot load the PostHog SDK chunk, the page now skips analytics. Before, the failed
import was an unhandled rejection that Sentry reported as an error (DJF-IO-2). The chunk fails to
load when a tab stays open across a deploy and asks for a hashed file that is gone, or when the
visitor leaves the page during the fetch.
