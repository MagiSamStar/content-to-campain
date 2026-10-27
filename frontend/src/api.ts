export type Platform = 'linkedin' | 'x' | 'newsletter'
export type ApprovalStatus = 'draft' | 'approved'

export interface Campaign {
  id: number
  name: string
  source_material: string
  audience: string
  objective: string
  status: string
  created_at: string
}

export interface Draft {
  id: number
  campaign_id: number
  platform: Platform
  content: string
  approval_status: ApprovalStatus
  revision: number
  created_at: string
  sent_message_id: string | null
  notification_status?: string
  campaign_name?: string
  approval_timestamp?: string
}

export interface SimulatedNotification {
  draft_id: number
  campaign_name: string
  approval_timestamp: string
  notification_status: string
  sent_message_id: string | null
}

export interface CampaignInput {
  name: string
  source_material: string
  audience: string
  objective: string
}

class ApiError extends Error {
  status: number
  retryAfter: number | null

  constructor(status: number, message: string, retryAfter: number | null = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.retryAfter = retryAfter
  }
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '')
  .trim()
  .replace(/\/$/, '')

const isPlaceholderApiUrl =
  API_BASE_URL === 'https://your-backend.onrender.com'

function apiUrl(path: string) {
  if (isPlaceholderApiUrl) {
    throw new Error(
      'The frontend API URL is still a placeholder. Set VITE_API_BASE_URL to the deployed backend URL and rebuild the frontend.',
    )
  }

  return `${API_BASE_URL}${path}`
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  try {
    const response = await fetch(apiUrl(path), {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    })

    const payload = (await response.json().catch(() => null)) as {
      detail?: string
    } | null

    if (!response.ok) {
      const retryHeader = response.headers.get('Retry-After')
      const retryAfter = retryHeader ? Number.parseInt(retryHeader, 10) : null
      const message =
        response.status === 429 && Number.isFinite(retryAfter)
          ? `Rate limit reached. Try again in ${retryAfter} seconds.`
          : payload?.detail || `Request failed with status ${response.status}`

      throw new ApiError(
        response.status,
        message,
        Number.isFinite(retryAfter) ? retryAfter : null,
      )
    }

    return payload as T
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }

    throw new Error('Unable to reach the Content-to-Campaign API.', {
      cause: error,
    })
  }
}


export const api = {
  health: () =>
    request<{ status: string; project: string }>('/api/health'),

  campaigns: () => request<Campaign[]>('/api/campaigns'),

  campaign: (id: number) => request<Campaign>(`/api/campaigns/${id}`),

  createCampaign: (input: CampaignInput) =>
    request<Campaign>('/api/campaigns', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  drafts: (campaignId: number) =>
    request<Draft[]>(`/api/campaigns/${campaignId}/drafts`),

  generate: (campaignId: number, platform: Platform) =>
    request<Draft>(`/api/campaigns/${campaignId}/generate`, {
      method: 'POST',
      body: JSON.stringify({ platform }),
    }),

  updateDraft: (draftId: number, content: string) =>
    request<Draft>(`/api/drafts/${draftId}`, {
      method: 'PATCH',
      body: JSON.stringify({ content }),
    }),

  approveDraft: (draftId: number) =>
    request<Draft>(`/api/drafts/${draftId}/approve`, {
      method: 'POST',
    }),
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${value.replace(' ', 'T')}Z`))
}

export function platformLabel(platform: Platform) {
  return platform === 'x'
    ? 'X'
    : platform === 'linkedin'
      ? 'LinkedIn'
      : 'Newsletter'
}
