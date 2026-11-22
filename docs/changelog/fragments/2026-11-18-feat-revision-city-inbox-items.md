### feat(revision.city): read the inbox items of the signed-in visitor

The inbox has its item type, `InboxItem`, in `src/inbox/lib/inbox-item.ts`. The `useInboxItems` hook
gives each open pull request of the signed-in visitor one time, with the reasons that it is in the
inbox. The most recent update is first. `formatRelativeTime` says how long ago a time was, such as
"3 hours ago". The inbox page uses them in a later change.
