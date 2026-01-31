import { ValorantStreamlinedSeries } from '../utils/valorantSeriesConverter'

/**
 * Base interface for all Valorant analytics results
 */
export interface ValorantAnalyticsResult {
  name: string
  description: string
  data: unknown
  generatedAt: string
}

/**
 * Valorant analytics function signature
 */
export type ValorantAnalyticsFunction = (series: ValorantStreamlinedSeries) => ValorantAnalyticsResult | null

/**
 * Combined analytics output stored in analytics.json
 */
export interface ValorantAnalyticsOutput {
  seriesId: string
  generatedAt: string
  results: ValorantAnalyticsResult[]
}
