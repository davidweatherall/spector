import { StreamlinedSeries } from '../utils/seriesConverter'

/**
 * Base interface for all analytics results
 */
export interface AnalyticsResult {
  name: string
  description: string
  data: unknown
  generatedAt: string
}

/**
 * Analytics function signature
 */
export type AnalyticsFunction = (series: StreamlinedSeries) => AnalyticsResult | null

/**
 * Combined analytics output stored in analytics.json
 */
export interface AnalyticsOutput {
  seriesId: string
  generatedAt: string
  results: AnalyticsResult[]
}
