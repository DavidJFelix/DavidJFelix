### fix(revision.city): anchor large symbol groups on unique content

When a changed run of array elements or same-name symbols was too large for the alignment table, the
Symbols tab did not align it at all. In a large JSON array, one insert near the top and one delete
near the bottom gave hundreds of false `modified` rows. The alignment now first pairs the items
whose content occurs only once on each side and keeps the longest run of those pairs that is in
order. Then it aligns each part between them as before. A part that is still too large keeps the old
result.
