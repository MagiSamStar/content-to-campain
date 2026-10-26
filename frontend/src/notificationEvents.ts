import type { Draft } from './api'

export const approvalNotificationEvent = 'codie:approval-notification'
export const approvalPendingEvent = 'codie:approval-pending'
export const revisionSavedEvent = 'codie:revision-saved'

export interface RevisionSavedEvent {
  draft: Draft
  campaignName: string
  timestamp: string
}

export function publishApprovalNotification(draft: Draft) { window.dispatchEvent(new CustomEvent<Draft>(approvalNotificationEvent, { detail: draft })) }
export function publishApprovalPending(pending: boolean) { window.dispatchEvent(new CustomEvent<boolean>(approvalPendingEvent, { detail: pending })) }
export function publishRevisionSaved(draft: Draft, campaignName: string) {
  window.dispatchEvent(new CustomEvent<RevisionSavedEvent>(revisionSavedEvent, { detail: { draft, campaignName, timestamp: new Date().toISOString() } }))
}
