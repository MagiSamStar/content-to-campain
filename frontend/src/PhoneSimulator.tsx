import { useEffect, useState } from 'react'
import type { Draft } from './api'
import { approvalNotificationEvent, approvalPendingEvent } from './notificationEvents'

interface SimulatedMessage { draftId: number; campaignName: string; timestamp: string; status: 'accepted' | 'failed'; sandboxStatus: string; messageId: string }
let sessionMessages: SimulatedMessage[] = []

const acceptedStatuses = ['sent', 'queued', 'accepted']

export default function PhoneSimulator() {
  const [messages, setMessages] = useState<SimulatedMessage[]>(() => sessionMessages)
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
        setMetadataError('The approval response is missing campaign_name or approval_timestamp. No simulated message was added.')
        return
      }
      const notificationAccepted = acceptedStatuses.includes(status ?? '') && Boolean(messageId)
      const notificationFailed = status === 'failed'
      if (!notificationAccepted && !notificationFailed) {
        setMetadataError('Sent returned an unrecognized or incomplete notification result. No simulated message was added.')
        return
      }
      setMetadataError('')
      setMessages((current) => {
        if (current.some((message) => message.draftId === draft.id)) return current
        const next = [{ draftId: draft.id, campaignName, timestamp, status: notificationAccepted ? 'accepted' as const : 'failed' as const, sandboxStatus: status ?? 'failed', messageId: messageId ?? '' }, ...current].slice(0, 10)
        sessionMessages = next
        return next
      })
    }
    const handlePending = (event: Event) => setPending((event as CustomEvent<boolean>).detail)
    window.addEventListener(approvalNotificationEvent, handleApproval)
    window.addEventListener(approvalPendingEvent, handlePending)
    return () => { window.removeEventListener(approvalNotificationEvent, handleApproval); window.removeEventListener(approvalPendingEvent, handlePending) }
  }, [])

  return <aside className="phone-simulator" aria-label="Simulated Sent sandbox inbox"><div className="phone-heading"><div><p className="section-kicker">MESSAGE PREVIEW</p><h3>Sent sandbox inbox</h3></div><span className="simulation-label">SIMULATION</span></div><div className="phone-frame"><div className="phone-status"><span>9:41</span><span>▮▮▮ ◒</span></div><div className="phone-speaker" /><div className="phone-screen"><div className="phone-appbar"><span className="phone-back">‹</span><div><strong>Sent</strong><small>Sandbox messages</small></div><span className="phone-more">•••</span></div>{pending && <div className="phone-loading"><div className="spinner" /><span>Waiting for sandbox response…</span></div>}{metadataError && !pending && <div className="phone-error" role="status">{metadataError}</div>}{!pending && messages.length === 0 ? <div className="phone-empty"><div className="phone-empty-icon">✦</div><strong>Inbox is waiting</strong><p>Approve a draft to preview its sandbox notification here.</p></div> : !pending && <div className="message-list">{messages.map((message) => <article className="sim-message" key={message.draftId}><div className="sim-message-meta"><span>Sent notification</span><time>{message.timestamp}</time></div><div className="sim-bubble"><strong>{message.campaignName}</strong><p>Your campaign was approved and is ready for the next step.</p></div><div className={message.status === 'accepted' ? 'sim-status sent' : 'sim-status failed'}><span />{message.status === 'accepted' ? `Sandbox ${message.sandboxStatus.toUpperCase()} accepted` : 'Sandbox request failed'}<small>{message.status === 'accepted' && message.messageId ? `ID ${message.messageId.slice(0, 8)}…` : 'Approval remains saved'}</small></div></article>)}</div>}<div className="phone-disclaimer"><span>ⓘ</span> Simulation only — no real SMS delivered</div></div></div></aside>
}
