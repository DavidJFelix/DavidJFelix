### fix(djf.io): vertically center the search hotkey hint chip

The header's search button renders its hotkey hint (Ctrl K / Cmd K) in a small bordered chip whose
height came entirely from the inherited line box, so the cap-height-only text sat on the baseline
with the font's empty descent zone below it -- the chip read bottom-heavy, with visibly more space
under the glyphs than above them. The chip now sets `lineHeight: 1` with explicit vertical padding,
one extra pixel on top to offset the remaining descent, so the glyphs sit visually centered.
