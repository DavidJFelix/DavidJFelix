### refactor(revision.city): move the dropdown menus from Radix to Ark UI

The settings, theme and status filter menus now use the Ark UI menu, and
`@radix-ui/react-dropdown-menu`, the last Radix package, is removed. This completes the move from
Radix to Ark. Items that keep the menu open now say `closeOnSelect={false}`, the menu alignment
moves from the content to the menu root, and item highlight styles follow Ark's `data-highlighted`.
A new browser test opens each menu and checks that it stays open or closes as it should.
