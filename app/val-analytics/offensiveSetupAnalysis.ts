/**
 * Offensive Setup Analysis
 * 
 * Analyzes where attackers position themselves at the moment of first kill.
 * This reveals their execute patterns and site preferences.
 */

import { ValorantStreamlinedSeries, ValorantRound } from '../utils/valorantSeriesConverter'
import { getClosestCalloutData } from '../utils/valorantMapData'
import { ValorantAnalyticsResult } from './types'

// ============================================================================
// TYPES
// ============================================================================

export interface OffensiveFormation {
  formationKey: string
  superRegions: { [superRegionName: string]: number }
  count: number
  percentage: number
}

export interface MapOffensiveSetups {
  mapId: string
  mapName: string
  totalRounds: number
  formations: OffensiveFormation[]
}

export interface TeamOffensiveAnalysis {
  teamId: string
  teamName: string
  totalOffensiveRounds: number
  byMap: MapOffensiveSetups[]
}

export interface OffensiveSetupAnalysisResult {
  team1: TeamOffensiveAnalysis
  team2: TeamOffensiveAnalysis
}

// ============================================================================
// HELPERS
// ============================================================================

function formatMapName(mapId: string): string {
  return mapId.charAt(0).toUpperCase() + mapId.slice(1).toLowerCase()
}

function createFormationKey(superRegions: { [name: string]: number }): string {
  const entries = Object.entries(superRegions)
    .filter(([_, count]) => count > 0)
    .sort((a, b) => a[0].localeCompare(b[0]))
  
  return entries.map(([region, count]) => `${count} ${region}`).join(', ')
}

/**
 * Get offensive player positions at first kill for a round
 */
function getOffensivePositions(
  round: ValorantRound,
  teamId: string,
  mapId: string,
  players: { id: string; teamId: string }[]
): { [superRegionName: string]: number } | null {
  // Find team's side this round
  const teamSide = round.teamSides.find(ts => ts.teamId === teamId)
  if (!teamSide || teamSide.side !== 'attacker') {
    return null // Not on attack this round
  }
  
  // Find the first kill in the round
  const kills = round.kills || []
  if (kills.length === 0) {
    return null // No kills in round
  }
  
  // Get the timestamp of the first kill
  const firstKill = kills[0]
  const firstKillTime = new Date(firstKill.occurredAt).getTime()
  
  // Get coordinate snapshots
  const snapshots = round.coordinateTracking || []
  if (snapshots.length === 0) {
    return null
  }
  
  // Find the snapshot closest to (but before or at) the first kill
  let bestSnapshot = snapshots[0]
  let bestDiff = Math.abs(snapshots[0].time - firstKillTime)
  
  for (const snapshot of snapshots) {
    const diff = Math.abs(snapshot.time - firstKillTime)
    // Prefer snapshots at or just before the kill
    if (diff < bestDiff || (snapshot.time <= firstKillTime && bestSnapshot.time > firstKillTime)) {
      bestDiff = diff
      bestSnapshot = snapshot
    }
  }
  
  // Get team's player IDs
  const teamPlayerIds = new Set(
    players.filter(p => p.teamId === teamId).map(p => p.id)
  )
  
  // Count players by super region
  const superRegionCounts: { [name: string]: number } = {}
  
  for (const coord of bestSnapshot.playerCoordinates) {
    if (!teamPlayerIds.has(coord.playerId)) continue
    
    const callout = getClosestCalloutData(mapId, coord.x, coord.y)
    if (callout) {
      const region = callout.superRegionName
      superRegionCounts[region] = (superRegionCounts[region] || 0) + 1
    }
  }
  
  // Only return if we found at least some players
  const totalPlayers = Object.values(superRegionCounts).reduce((a, b) => a + b, 0)
  if (totalPlayers < 3) {
    return null // Not enough data
  }
  
  return superRegionCounts
}

// ============================================================================
// MAIN ANALYSIS
// ============================================================================

export function analyzeOffensiveSetups(
  series: ValorantStreamlinedSeries,
  teamId: string
): TeamOffensiveAnalysis {
  const team = series.teams.find(t => t.id === teamId)
  const teamName = team?.name || 'Unknown Team'
  
  const mapFormations: { [mapId: string]: { [formationKey: string]: { superRegions: { [name: string]: number }; count: number } } } = {}
  const mapRoundCounts: { [mapId: string]: number } = {}
  
  for (const game of series.games) {
    const mapId = game.mapId
    if (!mapFormations[mapId]) {
      mapFormations[mapId] = {}
      mapRoundCounts[mapId] = 0
    }
    
    const players = game.players.map(p => ({ id: p.id, teamId: p.teamId }))
    
    for (const round of game.rounds) {
      const positions = getOffensivePositions(round, teamId, mapId, players)
      if (!positions) continue
      
      mapRoundCounts[mapId]++
      
      const formationKey = createFormationKey(positions)
      if (!mapFormations[mapId][formationKey]) {
        mapFormations[mapId][formationKey] = {
          superRegions: positions,
          count: 0,
        }
      }
      mapFormations[mapId][formationKey].count++
    }
  }
  
  const byMap: MapOffensiveSetups[] = []
  let totalOffensiveRounds = 0
  
  for (const [mapId, formations] of Object.entries(mapFormations)) {
    const totalRounds = mapRoundCounts[mapId]
    totalOffensiveRounds += totalRounds
    
    const formationList: OffensiveFormation[] = Object.entries(formations)
      .map(([formationKey, data]) => ({
        formationKey,
        superRegions: data.superRegions,
        count: data.count,
        percentage: totalRounds > 0 ? (data.count / totalRounds) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count)
    
    if (formationList.length > 0) {
      byMap.push({
        mapId,
        mapName: formatMapName(mapId),
        totalRounds,
        formations: formationList,
      })
    }
  }
  
  byMap.sort((a, b) => b.totalRounds - a.totalRounds)
  
  return {
    teamId,
    teamName,
    totalOffensiveRounds,
    byMap,
  }
}

export function runOffensiveSetupAnalysis(
  series: ValorantStreamlinedSeries
): OffensiveSetupAnalysisResult {
  const [team1, team2] = series.teams
  
  return {
    team1: analyzeOffensiveSetups(series, team1?.id || ''),
    team2: analyzeOffensiveSetups(series, team2?.id || ''),
  }
}

/**
 * Analytics function for the analytics runner
 */
export function offensiveSetupAnalysis(series: ValorantStreamlinedSeries): ValorantAnalyticsResult | null {
  const result = runOffensiveSetupAnalysis(series)
  
  const hasData = result.team1.totalOffensiveRounds > 0 || result.team2.totalOffensiveRounds > 0
  if (!hasData) {
    return null
  }
  
  return {
    name: 'offensiveSetupAnalysis',
    description: 'Analyzes offensive positioning at first kill',
    data: {
      teams: [result.team1, result.team2],
    },
    generatedAt: new Date().toISOString(),
  }
}
