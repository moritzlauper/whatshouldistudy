import type { SiteId } from './site/config.ts'

export const PAYWALL_EXPERIMENT = 'google-ads-paywall-v1'
/** One fixed decision after fourteen days, even when the sample is small. */
export const TEST_DURATION_MS = 14 * 86400_000
export const ATTRIBUTION_MS = 14 * 86400_000
export const RECORD_RETENTION_SECONDS = 90 * 86400
export type PaywallVariant = 'direct' | 'late'
export interface PaywallAssignment {
  id: string
  site: SiteId
  variant: PaywallVariant
  assignedAt: number
  inTest: boolean
}
export const validParticipant = (id: unknown): id is string => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
export const validVariant = (v: unknown): v is PaywallVariant => v === 'direct' || v === 'late'
export const assignmentActive = (at: number, now = Date.now()) => Number.isFinite(at) && at <= now && now < at + ATTRIBUTION_MS
