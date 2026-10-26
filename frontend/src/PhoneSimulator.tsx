import { useEffect, useState } from 'react'
import type { Draft } from './api'
import {
  approvalNotificationEvent,
  approvalPendingEvent,
  revisionSavedEvent,
} from './notificationEvents'
import type { RevisionSavedEvent } from './notificationEvents'

interface SimulatedMessage {
  draft: Draft
  draftId: number
  campaignName: string
  timestamp: string
  kind: 'approval' | 'revision'
  status: 'accepted' | 'failed' | 'local'
  sandboxStatus: string
  messageId: string
  revision?: number
}

interface PhoneSimulatorProps {
  onOpenRevision: (draft: Draft) => void
}

let sessionMessages: SimulatedMessage[] = []

const acceptedStatuses = ['sent', 'queued', 'accepted']

function providerState(draft: Draft) {
  const sandboxStatus = draft.notification_status?.toLowerCase() ?? 'not_sent'
  const accepted =
    acceptedStatuses.includes(sandboxStatus) && Boolean(draft.sent_message_id)

  return {
    status: accepted
      ? ('accepted' as const)
      : sandboxStatus === 'failed'
        ? ('failed' as const)
        : ('local' as const),
    sandboxStatus,
    messageId: draft.sent_message_id ?? '',
  }
}

export default function PhoneSimulator({
  onOpenRevision,
}: PhoneSimulatorProps) {
  const [messages, setMessages] = useState<SimulatedMessage[]>(
    () => sessionMessages,
  )
  const [pending, setPending] = useState(false)
  const [metadataError, setMetadataError] = useState('')

  useEffect(() => {
    const handleApproval = (event: Event) => {
      const draft = (event as CustomEvent<Draft>).detail
      const status = draft?.notification_status?.toLowerCase()

      if (status === 'not_sent') return

      const campaignName = draft?.campaign_name
      const timestamp = draft?.approval_timestamp
      const messageId = draft?.sent_message_id

      if (!campaignName || !timestamp) {
        setMetadataError(
          'The approval response is missing campaign_name or approval_timestamp. No simulated message was added.',
        )
        return
      }

      const notificationAccepted =
        acceptedStatuses.includes(status ?? '') && Boolean(messageId)
      const notificationFailed = status === 'failed'

      if (!notificationAccepted && !notificationFailed) {
        setMetadataError(
          'Sent returned an unrecognized or incomplete notification result. No simulated message was added.',
        )
        return
      }

      setMetadataError('')
      setMessages((current) => {
        const alreadyAdded = current.some(
          (message) =>
            message.kind === 'approval' && message.draftId === draft.id,
        )

        if (alreadyAdded) return current

        const next = [
          {
            draft,
            draftId: draft.id,
            campaignName,
            timestamp,
            kind: 'approval' as const,
            status: notificationAccepted
              ? ('accepted' as const)
              : ('failed' as const),
            sandboxStatus: status ?? 'failed',
            messageId: messageId ?? '',
          },
          ...current,
        ].slice(0, 10)

        sessionMessages = next
        return next
      })
    }

    const handleRevisionSaved = (event: Event) => {
      const { draft, campaignName, timestamp } = (
        event as CustomEvent<RevisionSavedEvent>
      ).detail

      if (!draft || !campaignName || !timestamp) return

      const provider = providerState(draft)
      setMetadataError('')
      setMessages((current) => {
        const alreadyAdded = current.some(
          (message) =>
            message.kind === 'revision' &&
            message.draftId === draft.id &&
            message.revision === draft.revision,
        )

        if (alreadyAdded) return current

        const next = [
          {
            draft,
            draftId: draft.id,
            campaignName,
            timestamp,
            kind: 'revision' as const,
            revision: draft.revision,
            ...provider,
          },
          ...current,
        ].slice(0, 10)

        sessionMessages = next
        return next
      })
    }

    const handlePending = (event: Event) => {
      setPending((event as CustomEvent<boolean>).detail)
    }

    window.addEventListener(approvalNotificationEvent, handleApproval)
    window.addEventListener(approvalPendingEvent, handlePending)
    window.addEventListener(revisionSavedEvent, handleRevisionSaved)

    return () => {
      window.removeEventListener(approvalNotificationEvent, handleApproval)
      window.removeEventListener(approvalPendingEvent, handlePending)
      window.removeEventListener(revisionSavedEvent, handleRevisionSaved)
    }
  }, [])

  return (
    <aside
      className="phone-simulator"
      aria-label="Simulated Sent sandbox inbox"
    >
      <div className="phone-heading">
        <div>
          <p className="section-kicker">MESSAGE PREVIEW</p>
          <h3>Sent sandbox inbox</h3>
        </div>
        <span className="simulation-label">SIMULATION</span>
      </div>

      <div className="phone-frame">
        <div className="phone-status">
          <span>9:41</span>
          <span>▮▮▮ ◒</span>
        </div>
        <div className="phone-speaker" />

        <div className="phone-screen">
          <div className="phone-appbar">
            <span className="phone-back">‹</span>
            <div>
              <strong>Sent</strong>
              <small>Sandbox messages</small>
            </div>
            <span className="phone-more">•••</span>
          </div>

          {pending && (
            <div className="phone-loading">
              <div className="spinner" />
              <span>Waiting for sandbox response…</span>
            </div>
          )}

          {metadataError && !pending && (
            <div className="phone-error" role="status">
              {metadataError}
            </div>
          )}

          {!pending && messages.length === 0 ? (
            <div className="phone-empty">
              <div className="phone-empty-icon">✦</div>
              <strong>Inbox is waiting</strong>
              <p>
                Approve a draft or save a revision to preview its sandbox
                message here.
              </p>
            </div>
          ) : (
            !pending && (
              <div className="message-list">
                {messages.map((message) => (
                  <article
                    className="sim-message"
                    key={
                      message.kind +
                      '-' +
                      message.draftId +
                      '-' +
                      (message.revision ?? 'approval')
                    }
                  >
                    <div className="sim-message-meta">
                      <span>
                        {message.kind === 'revision'
                          ? 'Revision preview'
                          : 'Sent notification'}
                      </span>
                      <time>{message.timestamp}</time>
                    </div>

                    <div className="sim-bubble">
                      <strong>{message.campaignName}</strong>
                      {message.kind === 'revision' ? (
                        <p>
                          Revision {message.revision} has been saved and is
                          ready for approval.{' '}
                          <a
                            href="#content-studio"
                            onClick={(event) => {
                              event.preventDefault()
                              onOpenRevision(message.draft)
                            }}
                          >
                            Review the updated draft →
                          </a>
                        </p>
                      ) : (
                        <p>
                          Your campaign was approved and is ready for the next
                          step.
                        </p>
                      )}
                    </div>

                    {message.kind === 'revision' ? (
                      <div
                        className={
                          message.status === 'accepted'
                            ? 'sim-status sent'
                            : message.status === 'failed'
                              ? 'sim-status failed'
                              : 'sim-status local'
                        }
                      >
                        <span />
                        {message.status === 'accepted'
                          ? 'Local preview · Sandbox accepted'
                          : message.status === 'failed'
                            ? 'Local preview · Provider failed'
                            : 'Local preview only · Sandbox unavailable'}
                        <small>
                          {message.status === 'accepted' && message.messageId
                            ? 'Provider ID ' +
                              message.messageId.slice(0, 8) +
                              '…'
                            : 'No SMS delivered'}
                        </small>
                      </div>
                    ) : (
                      <div
                        className={
                          message.status === 'accepted'
                            ? 'sim-status sent'
                            : 'sim-status failed'
                        }
                      >
                        <span />
                        {message.status === 'accepted'
                          ? 'Sandbox ' +
                            message.sandboxStatus.toUpperCase() +
                            ' accepted'
                          : 'Sandbox request failed'}
                        <small>
                          {message.status === 'accepted' && message.messageId
                            ? 'ID ' + message.messageId.slice(0, 8) + '…'
                            : 'Approval remains saved'}
                        </small>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )
          )}

          <div className="phone-disclaimer">
            <span>ⓘ</span> Simulation only — no real SMS delivered
          </div>
        </div>
      </div>
    </aside>
  )
}
