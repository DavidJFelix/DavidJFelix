### feat(revision.city): write the text of review comments and the check run

A finding's comment starts with a hidden fingerprint of the reviewer, path, title, and body. A later
run uses it to tell which findings an earlier run posted. The comment shows the severity, the
reviewer, the title, a suggestion block when the finding has one, and the body. The review body
lists the findings when GitHub does not accept them as inline comments. The check run output gives
the counts and the cost. It also lists the findings, the failed chunk reviews, and the files that
were not reviewed, cut to fit GitHub's limit. Model text and file paths can come from the pull
request's author. So the text breaks mentions, issue references, HTML, and the model's own
suggestion blocks. GitHub links go through redirect.github.com, so they do not show in the timelines
of other issues. Nothing posts this text yet.
