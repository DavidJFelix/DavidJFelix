### refactor(revision.city): build the theme bootstrap and mode schema from @davidjfelix/theme

revision.city now builds its pre-paint theme script with `createThemeBootstrapScript` and reads the
theme mode with `themeModeSchema`, both from `@davidjfelix/theme`, like the other apps. The local
copy of the script and the local schema are gone, and with them the two "keep in sync" comments. The
root element now also carries `data-theme-mode` (light, dark or system), which the shared script
sets at first paint and the theme provider keeps current after a toggle.
