# revision.city — Context

revision.city (`apps/revision.city`) is a version control service centered on review. This glossary
holds the words of the diff viewer under `/diffs` and its Symbols tab. The words of the review
engine join it later.

## Language

### Diff viewer

**Diff**: The file changes of one pull request, one commit or one compare, as the viewer shows them.
_Avoid_: patch, changeset

**Compare**: A diff between two refs of one repository, named by a range such as `main...feature`.
_Avoid_: range diff, branch diff

**Diff URL**: The address of a pull request, commit or compare on GitHub or Codeberg. The viewer
path is the same address after `/diffs/`. _Avoid_: patch URL, diff link

**Share card**: The image that a shared viewer link shows in a chat or a feed. _Avoid_: OG image,
unfurl image

**File diff**: The changes to one file in a diff. _Avoid_: diff item, entry

**Hunk**: One run of changed lines and the context lines around them, inside a file diff. _Avoid_:
block

**Collapsed context**: The unchanged lines between hunks that the viewer hides until a visitor
expands them. _Avoid_: hidden lines, gap

**Split view** / **Unified view**: The two layouts of a file diff: old and new side by side, or one
column with the deleted lines above the added lines. _Avoid_: side-by-side, inline view

**File tree**: The sidebar list of the files in a diff, each with its Git status letter. _Avoid_:
file list, file browser

**Comment**: A note that a visitor adds on one line of a file diff. Today a comment stays in the
page, and the viewer does not post it to GitHub or Codeberg. _Avoid_: annotation

**Pull request list**: The open pull requests that a signed-in visitor can open in the viewer,
grouped by how the visitor is connected to each one. _Avoid_: inbox, dashboard

### Symbols

**Symbol**: A named declaration in a file diff, such as a function, a class, a method or a config
key. _Avoid_: entity

**Symbol kind**: The category of a symbol, shown as a short label such as `fn`, `class` or `key`.
_Avoid_: entity kind, symbol type

**Symbol change**: One change to a symbol between the two revisions of a file: added, modified,
renamed, moved or deleted. _Avoid_: entity change

**Renamed** / **Moved**: A renamed symbol has a new name and the same or a similar body. A moved
symbol has the same name under a different parent symbol. _Avoid_: relocated

**Symbol diff**: The list of symbol changes in one file diff. _Avoid_: entity diff
