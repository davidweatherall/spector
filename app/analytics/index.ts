import { StreamlinedSeries } from '../utils/seriesConverter'
import { AnalyticsFunction, AnalyticsOutput, AnalyticsResult } from './types'
import { storeJSON, readJSON } from '../storage'

// Import all analytics functions
import { counterPickGoldDiff } from './counterPickGoldDiff'
import { botLaneDrakePrio } from './botLaneDrakePrio'
import { supportGrubRecall } from './supportGrubRecall'
import { adcJoinedGrubs } from './adcJoinedGrubs'
import { playerWorthAt15 } from './playerWorthAt15'
import { drakeGoldHolding } from './drakeGoldHolding'
import { comebackStats } from './comebackStats'
import { draftAnalysis } from './draftAnalysis'
import { banPhaseAnalysis } from './banPhaseAnalysis'
import { analyzeClassWinRate } from './classWinRate'

/**
 * All analytics functions to run
 * Add new analytics functions here
 */
const analyticsFunctions: AnalyticsFunction[] = [
  counterPickGoldDiff,
  botLaneDrakePrio,
  supportGrubRecall,
  adcJoinedGrubs,
  playerWorthAt15,
  drakeGoldHolding,
  comebackStats,
  draftAnalysis,
  banPhaseAnalysis,
  analyzeClassWinRate,
  // Add more analytics functions here as they are created
]

/**
 * Storage key for analytics results
 */
const getAnalyticsKey = (seriesId: string) => `analytics/series_${seriesId}.json`

/**
 * Run all analytics functions on a series and store the results
 */
export async function runAllAnalytics(
  seriesId: string,
  series: StreamlinedSeries
): Promise<AnalyticsOutput> {
  const results: AnalyticsResult[] = []
  
  for (const analyticsFn of analyticsFunctions) {
    try {
      const result = analyticsFn(series)
      if (result) {
        results.push(result)
      }
    } catch (error) {
      console.error(`Error running analytics function:`, error)
    }
  }
  
  const output: AnalyticsOutput = {
    seriesId,
    generatedAt: new Date().toISOString(),
    results,
  }
  
  // Store the analytics results
  const analyticsKey = getAnalyticsKey(seriesId)
  await storeJSON(analyticsKey, output)
  
  console.log(`Analytics complete: ${results.length} results stored for series ${seriesId}`)
  
  return output
}

/**
 * Get existing analytics for a series
 */
export async function getAnalytics(seriesId: string): Promise<AnalyticsOutput | null> {
  const analyticsKey = getAnalyticsKey(seriesId)
  const result = await readJSON<AnalyticsOutput>(analyticsKey)
  if (!result) {
    console.log(`getAnalytics: No data found for key ${analyticsKey}`)
  }
  return result
}

/**
 * Check if analytics exist for a series
 */
export async function analyticsExist(seriesId: string): Promise<boolean> {
  const analytics = await getAnalytics(seriesId)
  return analytics !== null
}
