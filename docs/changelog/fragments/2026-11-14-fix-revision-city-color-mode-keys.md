### fix(revision.city): let Enter and Space pick the color mode in the theme menu

In the theme menu of the diff viewer, a keyboard user can Tab to the Auto, Light and Dark buttons,
but Enter and Space did not pick the color mode, because the menu took the key and canceled the
click. The buttons now keep these keys, so the key picks the color mode and the menu stays open. The
look does not change.
