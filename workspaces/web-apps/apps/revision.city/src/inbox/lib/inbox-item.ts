// Why a pull request is in the inbox of the signed-in visitor, most direct reason first.
export const INBOX_REASONS = ['review-requested', 'assigned', 'owned', 'member', 'watched'] as const

export type InboxReason = (typeof INBOX_REASONS)[number]

// One open pull request in the inbox.
export interface InboxItem {
  owner: string
  repo: string
  number: number
  title: string
  authorLogin?: string
  updatedAt?: Date
  draft: boolean
  assigneeLogins: string[]
  // At least one reason, in the order of INBOX_REASONS.
  reasons: InboxReason[]
}
