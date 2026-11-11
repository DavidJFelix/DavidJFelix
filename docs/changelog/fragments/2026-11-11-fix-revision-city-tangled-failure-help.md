### fix(revision.city): keep GitHub sign-in help off tangled.org failures

When a signed-in visitor's tangled.org patch fails to load, the viewer now shows the plain upstream
error. Before, the server asked GitHub about the visitor's sign-in and showed GitHub text or a "sign
in again" button, which cannot help with a tangled.org patch.
