### fix(revision.city): show every streamed file in the Symbols tab

The Symbols tab read its file list from the first streamed batch only, so on a diff with more files
than that batch (25 to 96 files, or fewer after half a second) it did not list the later files. The
patch loader now keeps every item it loads and gives that list to the Symbols tab when the load
ends. A new e2e test streams a 150-file patch one file at a time and expects the last file in the
tab.
