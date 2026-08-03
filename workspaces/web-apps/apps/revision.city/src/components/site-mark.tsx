import {Building2} from 'lucide-react'

// The in-page twin of the tab mark: the same Lucide `building-2` glyph that
// public/favicon.svg draws, imported from the dependency here rather than
// copied, because on this side there is a module graph to import it from.
//
// It deliberately drops the two things the favicon needs. No tile -- that is
// there so the mark survives an arbitrary browser chrome at 16px, but in the
// page it sits on our own surfaces, where a filled tile next to a wordmark
// reads as noise. And no color, so `currentColor` carries the glyph: on the
// diffs header, whose foreground comes from whichever Shiki theme is active, a
// hard-coded black or white would clash with most of the catalog.
//
// Sized in `em` so it tracks the text beside it. Between that and the inherited
// color, all three placements sit at different font sizes on differently
// colored chrome while passing nothing -- hence no props at all. Decorative for
// a related reason: every placement pairs the mark with the name in text, so
// that text is the accessible name and lucide's own aria-hidden default stands.
export function SiteMark() {
  return <Building2 data-slot="site-mark" width="1em" height="1em" />
}
