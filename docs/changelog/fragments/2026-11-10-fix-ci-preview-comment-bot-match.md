### fix(ci): match the preview comment by bot author

The sticky preview comment script now keeps and edits only a comment that a bot wrote and that
starts with the app's marker. Before this change it matched any comment that contained the marker,
so a person's comment with the marker could become the edited comment, and the bot deleted a
person's comment that quoted the marker. The check on the author type finds the comments of the
Depot CI app and the older comments of `github-actions[bot]`.
