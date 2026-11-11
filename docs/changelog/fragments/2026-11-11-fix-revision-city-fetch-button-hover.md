### fix(revision.city): show the whole hover highlight on the diff form arrow button

On the `/diffs` page the hover highlight of the arrow button at the end of the URL box was cut off
on the right in dark mode, and absent in light mode. A negative right margin pushed the button 8px
past the edge of the form, which clips its overflow, and a hover override took effect only in light
mode. The button now sits inside the form and uses the plain ghost hover, the same as the clear
button beside it.
