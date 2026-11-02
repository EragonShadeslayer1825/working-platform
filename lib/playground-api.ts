export type Environment = 'collab' | 'local'
export type CredentialFormat = 'jsonld-vc-1.1' | 'sd-jwt-vc'
export type VerificationState = 'NOT_STARTED' | 'PENDING' | 'PASS' | 'INVALID' | 'EXPIRED' | 'INCONCLUSIVE' | 'ERROR'

export interface ModuleSelection { id: string; version: string }
export interface CreateRunRequest {
  environment: Environment
  modules: { issuer: ModuleSelection; wallet: ModuleSelection; verifier: ModuleSelection }
  credentialFormat: CredentialFormat
}
export interface ProtocolEvent {
  runId?: string; eventId?: string; timestamp?: string; step?: string; protocolStep?: string
  actor?: string; direction?: string; operation?: string; httpStatus?: number
  status?: number; request?: unknown; response?: unknown; error?: string
}
export interface RunRecord {
  runId: string; state?: string; verificationState?: VerificationState; verificationResult?: { state?: VerificationState; credentialType?: string; expectedCredentialType?: string; error?: string }
  createdAt?: string; updatedAt?: string; environment?: Environment; credentialFormat?: CredentialFormat
  modules?: { issuer?: ModuleSelection; wallet?: ModuleSelection; verifier?: ModuleSelection }; events?: ProtocolEvent[]
  nextAction?: string; error?: string
}

const API_BASE_URL = process.env.NEXT_PUBLIC_PLAYGROUND_API_URL?.replace(/\/$/, '')
const timeoutMs = 15000

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!API_BASE_URL) throw new Error('PLAYGROUND_API_NOT_CONFIGURED')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, { ...init, signal: controller.signal, headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(init.headers ?? {}) } })
    const text = await response.text()
    let body: unknown = null
    if (text) { try { body = JSON.parse(text) } catch { throw new Error('Playground API returned invalid JSON') } }
    if (!response.ok) throw new Error(typeof body === 'object' && body && 'message' in body ? String((body as { message: unknown }).message) : `Playground API returned HTTP ${response.status}`)
    if (body === null) throw new Error('Playground API returned an empty response')
    return body as T
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw new Error('Playground API request timed out')
    throw error
  } finally { clearTimeout(timer) }
}

const idPath = (runId: string, suffix = '') => `/api/runs/${encodeURIComponent(runId)}${suffix}`
export const playgroundApi = {
  isConfigured: Boolean(API_BASE_URL),
  baseUrl: API_BASE_URL,
  createRun: (payload: CreateRunRequest) => request<RunRecord>('/api/runs', { method: 'POST', body: JSON.stringify(payload) }),
  getRun: (runId: string) => request<RunRecord>(idPath(runId)),
  startIssuance: (runId: string) => request<RunRecord>(idPath(runId, '/issuance/start'), { method: 'POST' }),
  startPresentation: (runId: string) => request<RunRecord>(idPath(runId, '/presentation/start'), { method: 'POST' }),
}
