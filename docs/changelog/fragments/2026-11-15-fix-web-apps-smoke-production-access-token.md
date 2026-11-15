### fix(web-apps): pass the Cloudflare Access service token to the production smoke

The production smoke step from #1070 did not get `CF_ACCESS_CLIENT_ID` and
`CF_ACCESS_CLIENT_SECRET`, so the onvibes.org deploy failed: Access sent the smoke to its login
page. The step now gets the same service token that the preview smoke uses.
