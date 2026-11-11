### fix(revision.city): draw the label on share cards whose title the font cannot draw

The share card font has only the Latin letters, so a pull request title in Cyrillic, Chinese or
Polish, or with an arrow, showed as boxes on the card. Now the card shows the repository label
(`owner/repo #n`) in place of such a title, and it removes emoji from a title and keeps its words.
The new `./glyphs` export of `@davidjfelix/og` has `canDrawText`, which does the check. The tags and
the page title keep the full title.
