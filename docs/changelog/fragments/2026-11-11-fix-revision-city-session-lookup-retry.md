### fix(revision.city): ask for the session again after a failed lookup

The diff viewer asked once per page whether the visitor is signed in and kept the answer, also when
the request failed. One failed request showed a signed-in visitor as signed out, with no file
expansion, until a full reload. Now a network error or an error status is not kept, so the next
component that mounts asks again. A real signed-in or signed-out answer is still kept for the page
life.
