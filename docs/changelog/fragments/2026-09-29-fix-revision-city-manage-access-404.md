### fix(revision.city): stop sending non-admins to an installation page that 404s

"Manage repository access" sent a signed-in visitor straight to the settings page of the one
installation their token could see. GitHub lists an installation to every collaborator on one of its
repositories and every member of its organization, but only an admin of that account can open the
page, so a visitor who had never installed the app landed on a 404. The direct link is now reserved
for an installation on the visitor's own account; everyone else goes through GitHub's install page,
which picks the account and handles who may configure it. The "not granted access" diagnosis follows
the same rule, since it offered the same page.
