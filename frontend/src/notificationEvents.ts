import type { Draft } from './api'

export const approvalNotificationEvent = 'codie:approval-notification'
export const approvalPendingEvent = 'codie:approval-pending'

export function publishApprovalNotification(draft: Draft) { window.dispatchEvent(new CustomEvent<Draft>(approvalNotificationEvent, { detail: draft })) }
export function publishApprovalPending(pending: boolean) { window.dispatchEvent(new CustomEvent<boolean>(approvalPendingEvent, { detail: pending })) }
