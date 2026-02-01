import { ValorantStreamlinedSeries } from '../utils/valorantSeriesConverter'
import { ValorantAnalyticsFunction, ValorantAnalyticsOutput, ValorantAnalyticsResult } from './types'
import { storeJSON, readJSON } from '../storage'

// Import all Valorant analytics functions
import { mapVetoAnalysis } from './mapVetoAnalysis'
import { agentPickAnalysis } from './agentPickAnalysis'
import { defensiveSetupAnalysis } from './defensiveSetupAnalysis'
import { offensiveSetupAnalysis } from './offensiveSetupAnalysis'
import { economySetupAnalysis } from './economySetupAnalysis'
import { playerPositionAnalysis } from './playerPositionAnalysis'
import { lurkerAnalysis } from './lurkerAnalysis'

/**
 * All Valorant analytics functions to run
 * Add new analytics functions here
 */
const analyticsFunctions: ValorantAnalyticsFunction[] = [
  mapVetoAnalysis,
  agentPickAnalysis,
  defensiveSetupAnalysis,
  offensiveSetupAnalysis,
  economySetupAnalysis,
  playerPositionAnalysis,
  lurkerAnalysis,
  // Add more Valorant analytics functions here as they are created
]

/**
 * Storage key for Valorant analytics results
 */
const getAnalyticsKey = (seriesId: string) => `val/analytics/series_${seriesId}.json`

/**
 * Run all Valorant analytics functions on a series and store the results
 */
export async function runAllValorantAnalytics(
  seriesId: string,
  series: ValorantStreamlinedSeries
): Promise<ValorantAnalyticsOutput> {
  const results: ValorantAnalyticsResult[] = []
  
  for (const analyticsFn of analyticsFunctions) {
    try {
      const result = analyticsFn(series)
      if (result) {
        results.push(result)
      }
    } catch (error) {
      console.error(`Error running Valorant analytics function:`, error)
    }
  }
  
  const output: ValorantAnalyticsOutput = {
    seriesId,
    generatedAt: new Date().toISOString(),
    results,
  }
  
  // Store the analytics results
  const analyticsKey = getAnalyticsKey(seriesId)
  await storeJSON(analyticsKey, output)
  
  console.log(`Valorant analytics complete: ${results.length} results stored for series ${seriesId}`)
  
  return output
}

/**
 * Get existing Valorant analytics for a series
 */
export async function getValorantAnalytics(seriesId: string): Promise<ValorantAnalyticsOutput | null> {
  const analyticsKey = getAnalyticsKey(seriesId)
  const result = await readJSON<ValorantAnalyticsOutput>(analyticsKey)
  if (!result) {
    console.log(`getValorantAnalytics: No data found for key ${analyticsKey}`)
  }
  return result
}

/**
 * Check if Valorant analytics exist for a series
 */
export async function valorantAnalyticsExist(seriesId: string): Promise<boolean> {
  const analytics = await getValorantAnalytics(seriesId)
  return analytics !== null
}

// Re-export types and functions for easy importing
export * from './types'
export { mapVetoAnalysis } from './mapVetoAnalysis'
export { agentPickAnalysis } from './agentPickAnalysis'
export { analyzeDefensiveSetups, runDefensiveSetupAnalysis, type TeamDefensiveAnalysis, type MapDefensiveSetups, type DefensiveFormation } from './defensiveSetupAnalysis'
export { analyzeOffensiveSetups, runOffensiveSetupAnalysis, type TeamOffensiveAnalysis, type MapOffensiveSetups, type OffensiveFormation } from './offensiveSetupAnalysis'
export { analyzeEconomySetups, runEconomySetupAnalysis, economySetupAnalysis, type TeamEconomyAnalysis, type EconomySetupData, type MapEconomySetups } from './economySetupAnalysis'
export { analyzePlayerPositions, runPlayerPositionAnalysis, playerPositionAnalysis, type TeamPlayerPositionAnalysis, type MapPlayerPositions, type PlayerPositionData, type PositionCluster } from './playerPositionAnalysis'
export { analyzeLurkers, runLurkerAnalysis, lurkerAnalysis, type TeamLurkerAnalysis, type MapLurkerAnalysis, type PlayerLurkerStats } from './lurkerAnalysis'
export { aggregateValorantScoutingReport, type ValorantScoutingReport } from './scoutingReport'
