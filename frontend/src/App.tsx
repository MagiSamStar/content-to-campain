import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, PointerEvent as ReactPointerEvent } from 'react'
import { api, formatDate, platformLabel } from './api'
import type { Campaign, CampaignInput, Draft, Platform } from './api'
import PhoneSimulator from './PhoneSimulator'
import {
  publishApprovalNotification,
  publishApprovalPending,
  publishRevisionSaved,
} from './notificationEvents'
import './App.css'

const platforms: Platform[] = ['linkedin', 'x', 'newsletter']

function App() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [view, setView] = useState<'overview' | 'campaign'>('overview')
  const [showCreate, setShowCreate] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [apiOnline, setApiOnline] = useState(false)

  const selectedCampaign =
    campaigns.find((campaign) => campaign.id === selectedId) ?? null

  const loadCampaigns = async () => {
    setLoading(true)
    setError('')

    try {
      const [items] = await Promise.all([api.campaigns(), api.health()])
      setCampaigns(items)
      setApiOnline(true)

      if (selectedId && !items.some((item) => item.id === selectedId)) {
        setSelectedId(null)
      }
    } catch (loadError) {
      setApiOnline(false)
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Could not load campaigns.',
      )
    } finally {
      setLoading(false)
    }
  }

  // The initial load intentionally runs once for this screen.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCampaigns()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openCampaign = (id: number) => {
    setSelectedId(id)
    setView('campaign')
    setShowCreate(false)
  }

  const handleCreated = (campaign: Campaign) => {
    setCampaigns((current) => [campaign, ...current])
    openCampaign(campaign.id)
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">C</span>
          <span>
            Content<span className="brand-muted"> / ops</span>
          </span>
        </div>
        <div className="workspace-label">CONTENT WORKSPACE</div>
        <nav aria-label="Main navigation">
          <button
            className={
              view === 'overview' && !showCreate ? 'nav-item active' : 'nav-item'
            }
            onClick={() => {
              setView('overview')
              setShowCreate(false)
            }}
          >
            <span>▦</span> Overview
          </button>
          <button
            className={
              view === 'campaign' && !showCreate ? 'nav-item active' : 'nav-item'
            }
            onClick={() => {
              setView('overview')
              setShowCreate(false)
            }}
          >
            <span>◫</span> Campaigns <b>{campaigns.length}</b>
          </button>
        </nav>
        <div className="sidebar-footer">
          <span className={apiOnline ? 'online-dot' : 'offline-dot'} />
          API {apiOnline ? 'connected' : 'offline'}
          <small>FastAPI · local workspace</small>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <span className="eyebrow">CONTENT OPERATIONS</span>
            <h1>
              {view === 'campaign' && selectedCampaign
                ? selectedCampaign.name
                : 'Campaign workspace'}
            </h1>
          </div>
          <div className="topbar-actions">
            <span className="sandbox-pill">
              <span /> SENT SANDBOX
            </span>
            <button
              className="primary-button"
              onClick={() => {
                setShowCreate(true)
                setView('overview')
              }}
            >
              + New campaign
            </button>
          </div>
        </header>

        <div className="main-canvas">
          <CursorLaserOverlay />
          {error && (
            <div className="alert error" role="alert">
              <strong>Connection issue</strong>
              <span>{error}</span>
              <button onClick={() => void loadCampaigns()}>Retry</button>
            </div>
          )}
          {showCreate ? (
            <CreateCampaign
              onCreated={handleCreated}
              onCancel={() => setShowCreate(false)}
            />
          ) : view === 'campaign' && selectedCampaign ? (
            <CampaignDetail campaign={selectedCampaign} />
          ) : (
            <Overview
              campaigns={campaigns}
              loading={loading}
              onOpen={openCampaign}
              onCreate={() => setShowCreate(true)}
            />
          )}
        </div>
      </main>
    </div>
  )
}

function CursorLaserOverlay() {
  const layerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pointsRef = useRef<Array<{ x: number; y: number; time: number }>>([])
  const pointerInsideRef = useRef(false)

  useEffect(() => {
    const layer = layerRef.current
    const canvas = canvasRef.current
    if (!layer || !canvas) return

    const context = canvas.getContext('2d')
    if (!context) return
    let frame = 0

    const resize = () => {
      const bounds = layer.getBoundingClientRect()
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)

      canvas.width = Math.max(1, Math.round(bounds.width * pixelRatio))
      canvas.height = Math.max(1, Math.round(bounds.height * pixelRatio))
      canvas.style.width = bounds.width + 'px'
      canvas.style.height = bounds.height + 'px'
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    }

    const drawTrail = (now: number) => {
      const bounds = layer.getBoundingClientRect()
      const points = pointsRef.current.filter(
        (point) => now - point.time < 760,
      )

      pointsRef.current = points
      context.clearRect(0, 0, bounds.width, bounds.height)

      if (points.length > 1) {
        context.lineCap = 'round'
        context.lineJoin = 'round'
        const distanceFromCursor = new Array(points.length).fill(0) as number[]

        for (let index = points.length - 2; index >= 0; index -= 1) {
          const current = points[index]
          const next = points[index + 1]
          distanceFromCursor[index] =
            distanceFromCursor[index + 1] +
            Math.hypot(next.x - current.x, next.y - current.y)
        }

        const bands = [
          { width: 1.2, alpha: 0.23, blur: 13, offset: 0 },
          { width: 1.4, alpha: 0.16, blur: 22, offset: 3 },
          { width: 0.8, alpha: 0.12, blur: 30, offset: -4 },
        ]

        bands.forEach((band, bandIndex) => {
          context.lineWidth = band.width
          context.shadowColor = 'rgba(82, 217, 255, 0.9)'
          context.shadowBlur = band.blur

          const fadeAt = (pointIndex: number) => {
            const age = (now - points[pointIndex].time) / 760
            const ageFade = Math.pow(Math.max(0, 1 - age), 0.85)
            const distanceRatio = Math.min(
              1,
              distanceFromCursor[pointIndex] / 190,
            )
            const distanceFade = Math.pow(
              Math.max(0, 1 - distanceRatio),
              2.2,
            )

            return (
              ageFade *
              distanceFade *
              (pointerInsideRef.current ? 1 : 0.45)
            )
          }

          for (let index = 1; index < points.length; index += 1) {
            const previous = points[index - 1]
            const point = points[index]
            const age = (now - point.time) / 760
            const previousFade = fadeAt(index - 1)
            const fade = fadeAt(index)
            const previousWave =
              Math.sin((index - 1) * 0.75 + now * 0.002 + bandIndex) *
              (1.5 + age * 5)
            const wave =
              Math.sin(index * 0.75 + now * 0.002 + bandIndex) *
              (1.5 + age * 5)
            const previousX = previous.x + band.offset + previousWave
            const previousY =
              previous.y +
              Math.cos((index - 1) * 0.58 + now * 0.0016) *
                (band.offset * 0.5)
            const x = point.x + band.offset + wave
            const y =
              point.y +
              Math.cos(index * 0.58 + now * 0.0016) *
                (band.offset * 0.5)
            const gradient = context.createLinearGradient(
              previousX,
              previousY,
              x,
              y,
            )

            gradient.addColorStop(
              0,
              'rgba(112, 230, 255, ' + band.alpha * previousFade + ')',
            )
            gradient.addColorStop(
              1,
              'rgba(196, 247, 255, ' + band.alpha * fade + ')',
            )

            context.beginPath()
            context.moveTo(previousX, previousY)
            context.lineTo(x, y)
            context.globalAlpha = 1
            context.strokeStyle = gradient
            context.stroke()
          }
        })

        context.globalAlpha = 1
        context.shadowBlur = 0
      }

      frame = requestAnimationFrame(drawTrail)
    }

    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(layer)
    frame = requestAnimationFrame(drawTrail)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [])

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const point = {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
      time: performance.now(),
    }
    const points = pointsRef.current
    const lastPoint = points[points.length - 1]

    if (
      !lastPoint ||
      Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y) > 1.5
    ) {
      points.push(point)
    }

    pointerInsideRef.current = true
  }

  return (
    <div
      ref={layerRef}
      className="cursor-laser-layer"
      onPointerMove={handlePointerMove}
      onPointerLeave={() => {
        pointerInsideRef.current = false
      }}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="cursor-laser-canvas" />
    </div>
  )
}

function Overview({
  campaigns,
  loading,
  onOpen,
  onCreate,
}: {
  campaigns: Campaign[]
  loading: boolean
  onOpen: (id: number) => void
  onCreate: () => void
}) {
  return (
    <section className="content-wrap">
      <div className="hero-row">
        <div>
          <p className="section-kicker">HELLO, CREATOR</p>
          <h2>
            Turn source material into <em>campaigns.</em>
          </h2>
          <p className="lede">
            Build, generate, review, and refine content from one focused
            workspace.
          </p>
        </div>
        <div className="hero-orb" aria-hidden="true">
          <span>✦</span>
        </div>
      </div>

      <div className="stat-grid">
        <Stat
          label="Total campaigns"
          value={loading ? '…' : String(campaigns.length)}
          detail="Across your workspace"
        />
        <Stat
          label="Draft workflow"
          value="3"
          detail="LinkedIn · X · newsletter"
        />
        <Stat label="Delivery mode" value="Sandbox" detail="Sent notifications" />
      </div>

      <div className="section-heading">
        <div>
          <p className="section-kicker">WORKSPACE</p>
          <h3>Recent campaigns</h3>
        </div>
        <button className="text-button" onClick={onCreate}>
          Create campaign <span>→</span>
        </button>
      </div>

      {loading ? (
        <div className="empty-card">
          <div className="spinner" />
          <p>Loading campaigns…</p>
        </div>
      ) : campaigns.length === 0 ? (
        <div className="empty-card">
          <div className="empty-icon">＋</div>
          <h3>No campaigns yet</h3>
          <p>Start with a source document, audience, and clear objective.</p>
          <button className="primary-button" onClick={onCreate}>
            Create your first campaign
          </button>
        </div>
      ) : (
        <div className="campaign-grid">
          {campaigns.map((campaign) => (
            <button
              className="campaign-card"
              key={campaign.id}
              onClick={() => onOpen(campaign.id)}
            >
              <div className="card-top">
                <span className="status-badge">
                  <i /> {campaign.status}
                </span>
                <span className="card-arrow">↗</span>
              </div>
              <h3>{campaign.name}</h3>
              <p>{campaign.objective}</p>
              <div className="card-meta">
                <span>{campaign.audience}</span>
                <span>{formatDate(campaign.created_at)}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

function Stat({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  )
}

function CreateCampaign({
  onCreated,
  onCancel,
}: {
  onCreated: (campaign: Campaign) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<CampaignInput>({
    name: '',
    source_material: '',
    audience: '',
    objective: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const update = (key: keyof CampaignInput, value: string) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')

    try {
      onCreated(await api.createCampaign(form))
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Could not create campaign.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="content-wrap narrow">
      <button className="back-button" onClick={onCancel}>
        ← Back to campaigns
      </button>
      <div className="form-heading">
        <p className="section-kicker">NEW WORKFLOW</p>
        <h2>Create a campaign</h2>
        <p>Give your content a source, an audience, and a job to do.</p>
      </div>
      <form className="campaign-form" onSubmit={submit}>
        <label>
          Campaign name
          <input
            required
            maxLength={120}
            value={form.name}
            onChange={(event) => update('name', event.target.value)}
            placeholder="e.g. Local AI launch"
          />
        </label>
        <label>
          Source material
          <textarea
            required
            value={form.source_material}
            onChange={(event) => update('source_material', event.target.value)}
            placeholder="Paste notes, a brief, transcript, or source document…"
            rows={7}
          />
        </label>
        <div className="form-columns">
          <label>
            Target audience
            <input
              required
              maxLength={200}
              value={form.audience}
              onChange={(event) => update('audience', event.target.value)}
              placeholder="e.g. Developer advocates"
            />
          </label>
          <label>
            Campaign objective
            <input
              required
              maxLength={200}
              value={form.objective}
              onChange={(event) => update('objective', event.target.value)}
              placeholder="e.g. Explain the new workflow"
            />
          </label>
        </div>
        {error && <div className="form-error">{error}</div>}
        <div className="form-actions">
          <button type="button" className="secondary-button" onClick={onCancel}>
            Cancel
          </button>
          <button className="primary-button" disabled={saving}>
            {saving ? 'Creating…' : 'Create campaign →'}
          </button>
        </div>
      </form>
    </section>
  )
}

function CampaignDetail({ campaign }: { campaign: Campaign }) {
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [generating, setGenerating] = useState<Platform | null>(null)
  const [activePlatform, setActivePlatform] = useState<Platform>('linkedin')

  const loadDrafts = async () => {
    setLoading(true)

    try {
      setDrafts(await api.drafts(campaign.id))
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Could not load drafts.',
      )
    } finally {
      setLoading(false)
    }
  }

  // Draft loading is synchronized with the selected campaign.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDrafts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign.id])

  const activeDraft = useMemo(
    () => drafts.find((draft) => draft.platform === activePlatform),
    [drafts, activePlatform],
  )

  const generate = async (platform: Platform) => {
    setGenerating(platform)
    setActivePlatform(platform)
    setError('')

    try {
      const draft = await api.generate(campaign.id, platform)
      setDrafts((current) => [draft, ...current])
    } catch (generateError) {
      setError(
        generateError instanceof Error
          ? generateError.message
          : 'Generation failed.',
      )
    } finally {
      setGenerating(null)
    }
  }

  const replaceDraft = (draft: Draft) => {
    setDrafts((current) =>
      current.map((item) => (item.id === draft.id ? draft : item)),
    )
  }

  const openRevision = (draft: Draft) => {
    setActivePlatform(draft.platform)
    requestAnimationFrame(() => {
      document
        .getElementById('content-studio')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  return (
    <section className="content-wrap detail-wrap">
      <div className="detail-intro">
        <div>
          <span className="status-badge">
            <i /> {campaign.status}
          </span>
          <h2>{campaign.name}</h2>
          <p className="lede">{campaign.objective}</p>
        </div>
        <div className="detail-date">
          Created {formatDate(campaign.created_at)}
        </div>
      </div>
      <div className="source-grid">
        <div className="source-panel">
          <p className="section-kicker">SOURCE MATERIAL</p>
          <p className="source-text">{campaign.source_material}</p>
        </div>
        <div className="brief-panel">
          <Brief label="AUDIENCE" value={campaign.audience} />
          <Brief label="OBJECTIVE" value={campaign.objective} />
        </div>
      </div>
      <div className="section-heading drafts-heading">
        <div>
          <p className="section-kicker">CONTENT STUDIO</p>
          <h3>Drafts & review</h3>
        </div>
        <span className="sandbox-note">✦ AI generation uses local Ollama</span>
      </div>
      {error && (
        <div className="alert error">
          <strong>Action failed</strong>
          <span>{error}</span>
          <button onClick={() => void loadDrafts()}>Retry</button>
        </div>
      )}
      <div className="studio" id="content-studio">
        <div className="platform-rail">
          <p className="rail-label">GENERATE FOR</p>
          {platforms.map((platform) => {
            const count = drafts.filter(
              (draft) => draft.platform === platform,
            ).length
            const isGenerating = generating === platform

            return (
              <button
                key={platform}
                className={
                  activePlatform === platform
                    ? 'platform-button active'
                    : 'platform-button'
                }
                aria-busy={isGenerating}
                onClick={() => setActivePlatform(platform)}
              >
                <span
                  className={
                    isGenerating
                      ? 'platform-icon ' + platform + ' generating'
                      : 'platform-icon ' + platform
                  }
                >
                  {platform === 'linkedin'
                    ? 'in'
                    : platform === 'x'
                      ? '𝕏'
                      : '✉'}
                </span>
                <span>
                  {platformLabel(platform)}
                  <small>
                    {count
                      ? String(count) + ' draft' + (count > 1 ? 's' : '')
                      : 'Not generated'}
                  </small>
                </span>
              </button>
            )
          })}
          <div className="generate-actions">
            {generating && (
              <p className="generation-status" role="status" aria-live="polite">
                <span className="generation-status-dot" />
                Your content is being generated…
              </p>
            )}
            {platforms.map((platform) => (
              <button
                key={platform}
                className="generate-button"
                disabled={generating !== null}
                onClick={() => void generate(platform)}
              >
                {generating === platform
                  ? 'Generating…'
                  : 'Generate ' + platformLabel(platform)}
              </button>
            ))}
          </div>
        </div>
        <div className="editor-area">
          {loading ? (
            <div className="empty-editor">
              <div className="spinner" />
              <p>Loading drafts…</p>
            </div>
          ) : activeDraft ? (
            <DraftEditor
              draft={activeDraft}
              campaignName={campaign.name}
              onSaved={replaceDraft}
            />
          ) : (
            <div className="empty-editor">
              <div className="empty-icon">✦</div>
              <h3>No {platformLabel(activePlatform)} draft yet</h3>
              <p>
                Generate a first draft from the campaign brief to begin review.
              </p>
              <button
                className="primary-button"
                disabled={generating !== null}
                onClick={() => void generate(activePlatform)}
              >
                Generate {platformLabel(activePlatform)} draft
              </button>
            </div>
          )}
        </div>
      </div>
      <PhoneSimulator onOpenRevision={openRevision} />
    </section>
  )
}

function Brief({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="brief-label">{label}</p>
      <p>{value}</p>
    </div>
  )
}

function DraftEditor({
  draft,
  campaignName,
  onSaved,
}: {
  draft: Draft
  campaignName: string
  onSaved: (draft: Draft) => void
}) {
  const [content, setContent] = useState(draft.content)
  const [saving, setSaving] = useState(false)
  const [approving, setApproving] = useState(false)
  const [message, setMessage] = useState('')

  const notificationStatus =
    draft.notification_status === 'sent' || draft.sent_message_id
      ? 'Sandbox notification sent'
      : draft.notification_status === 'failed'
        ? 'Sandbox notification failed'
        : draft.approval_status === 'approved'
          ? 'No notification sent'
          : 'No sandbox notification recorded'

  const notificationClass =
    draft.notification_status === 'failed'
      ? 'notification-dot failed'
      : draft.notification_status === 'sent' || draft.sent_message_id
        ? 'notification-dot sent'
        : 'notification-dot'

  const save = async () => {
    setSaving(true)
    setMessage('')

    try {
      const updated = await api.updateDraft(draft.id, content)
      onSaved(updated)
      publishRevisionSaved(updated, campaignName)
      setMessage('Revision saved.')
    } catch (saveError) {
      setMessage(
        saveError instanceof Error
          ? saveError.message
          : 'Could not save draft.',
      )
    } finally {
      setSaving(false)
    }
  }

  const approve = async () => {
    setApproving(true)
    publishApprovalPending(true)
    setMessage('')

    try {
      const approved = await api.approveDraft(draft.id)
      onSaved(approved)
      publishApprovalNotification(approved)
      setMessage('Approval saved.')
    } catch (approveError) {
      setMessage(
        approveError instanceof Error
          ? approveError.message
          : 'Could not approve draft.',
      )
    } finally {
      setApproving(false)
      publishApprovalPending(false)
    }
  }

  const dirty = content !== draft.content

  return (
    <div className="editor-card">
      <div className="editor-top">
        <div>
          <span className="editor-platform">
            {platformLabel(draft.platform)}
          </span>
          <span
            className={
              draft.approval_status === 'approved'
                ? 'approval approved'
                : 'approval'
            }
          >
            {draft.approval_status === 'approved'
              ? '✓ Approved'
              : '○ Needs review'}
          </span>
        </div>
        <span className="revision">
          Revision {draft.revision} · {formatDate(draft.created_at)}
        </span>
      </div>
      <textarea
        className="draft-textarea"
        value={content}
        onChange={(event) => setContent(event.target.value)}
        aria-label={platformLabel(draft.platform) + ' draft content'}
      />
      <div className="editor-bottom">
        <div className="notification-status">
          <span className={notificationClass} />
          {notificationStatus}
          <small>Test environment only</small>
        </div>
        <div className="editor-actions">
          {message && <span className="save-message">{message}</span>}
          <button
            className="secondary-button"
            disabled={!dirty || saving}
            onClick={() => void save()}
          >
            {saving ? 'Saving…' : 'Save revision'}
          </button>
          <button
            className="approve-button"
            disabled={
              approving || draft.approval_status === 'approved' || dirty
            }
            onClick={() => void approve()}
          >
            {approving
              ? 'Approving…'
              : draft.approval_status === 'approved'
                ? 'Approved'
                : 'Approve draft'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default App
