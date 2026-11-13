### fix(revision.city): read the app's installations in one place, 100 per page

The access diagnosis read the app's installations without a page size, so GitHub sent only the
first 30. A visitor whose token sees more installations than that got the install page, not the "not
granted" message and the settings link of the right installation. One shared reader now asks for 100
per page, and the access diagnosis and the pull request list both use it.
