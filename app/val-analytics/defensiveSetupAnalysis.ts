/**
 * Defensive Setup Analysis
 * 
 * Analyzes where players position themselves at the end of freeze time
 * when on the defender side. Groups positions by super region (A, Mid, B, etc.)
 * and calculates frequency of different defensive formations.
 */

import { ValorantStreamlinedSeries, ValorantGame, ValorantRound, TeamSide } from '../utils/valorantSeriesConverter'
import { getClosestCalloutData } from '../utils/valorantMapData'
import { ValorantAnalyticsResult } from './types'

// ============================================================================
// TYPES
// ============================================================================

export interface DefensiveFormation {
  // Sorted list of super regions with player counts, e.g., "2 A, 2 B, 1 Mid"
  formationKey: string
  // Breakdown by super region
  superRegions: { [superRegionName: string]: number }
  // Number of rounds this formation was used
  count: number
  // Percentage of rounds using this formation
  percentage: number
}

export interface MapDefensiveSetups {
  mapId: string
  mapName: string
  totalRounds: number
  formations: DefensiveFormation[]
}

export interface TeamDefensiveAnalysis {
  teamId: string
  teamName: string
  totalDefensiveRounds: number
  byMap: MapDefensiveSetups[]
}

export interface DefensiveSetupAnalysisResult {
  team1: TeamDefensiveAnalysis
  team2: TeamDefensiveAnalysis
}

// ============================================================================
// HELPERS
// ============================================================================

function formatMapName(mapId: string): string {
  return mapId.charAt(0).toUpperCase() + mapId.slice(1).toLowerCase()
}

/**
 * Creates a formation key from super region counts
 * e.g., { 'A Site': 2, 'Mid': 1, 'B Site': 2 } -> "2 A Site, 1 Mid, 2 B Site"
 */
function createFormationKey(superRegions: { [name: string]: number }): string {
  // Sort by region name for consistency
  const entries = Object.entries(superRegions)
    .filter(([_, count]) => count > 0)
    .sort((a, b) => a[0].localeCompare(b[0]))
  
  return entries.map(([region, count]) => `${count} ${region}`).join(', ')
}

/**
 * Get defensive player positions at freeze time end for a round
 */
function getDefensivePositions(
  round: ValorantRound,
  teamId: string,
  mapId: string,
  players: { id: string; teamId: string }[]
): { [superRegionName: string]: number } | null {
  // Find team's side this round
  const teamSide = round.teamSides.find(ts => ts.teamId === teamId)
  if (!teamSide || teamSide.side !== 'defender') {
    return null // Not on defense this round
  }
  
  // Get coordinate snapshot closest to freeze time end
  const snapshots = round.coordinateTracking || []
  if (snapshots.length === 0) {
    return null
  }
  
  // Find the first snapshot AFTER freeze time ends
  // snapshot.time is the absolute timestamp in ms
  // snapshots[0] is at round-started-freezetime (spawn positions)
  // We want the first snapshot after freezetimeEndedAt, which is when players are set up
  let snapshot = snapshots[0]
  
  if (round.freezetimeEndedAt && snapshots.length > 1) {
    const freezeEndTime = new Date(round.freezetimeEndedAt).getTime()
    
    // Find the first snapshot that occurred after freeze time ended
    const afterFreezeSnapshots = snapshots.filter(s => s.time >= freezeEndTime)
    
    if (afterFreezeSnapshots.length > 0) {
      // Use the first snapshot after freeze ends (players are set up)
      snapshot = afterFreezeSnapshots[0]
    } else {
      // If no snapshots after freeze (unlikely), use the last available snapshot
      // which should be the most recent position before freeze ended
      snapshot = snapshots[snapshots.length - 1]
    }
  } else if (snapshots.length > 1) {
    // No freezetimeEndedAt but we have multiple snapshots
    // Use the second snapshot (first one is spawn)
    snapshot = snapshots[1]
  }
  
  // Get team's player IDs
  const teamPlayerIds = new Set(
    players.filter(p => p.teamId === teamId).map(p => p.id)
  )
  
  // Count players by super region
  const superRegionCounts: { [name: string]: number } = {}
  
  for (const coord of snapshot.playerCoordinates) {
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

export function analyzeDefensiveSetups(
  series: ValorantStreamlinedSeries,
  teamId: string
): TeamDefensiveAnalysis {
  const team = series.teams.find(t => t.id === teamId)
  const teamName = team?.name || 'Unknown Team'
  
  // Group by map
  const mapFormations: { [mapId: string]: { [formationKey: string]: { superRegions: { [name: string]: number }; count: number } } } = {}
  const mapRoundCounts: { [mapId: string]: number } = {}
  
  for (const game of series.games) {
    const mapId = game.mapId
    if (!mapFormations[mapId]) {
      mapFormations[mapId] = {}
      mapRoundCounts[mapId] = 0
    }
    
    // Build player list from game
    const players = game.players.map(p => ({ id: p.id, teamId: p.teamId }))
    
    for (const round of game.rounds) {
      const positions = getDefensivePositions(round, teamId, mapId, players)
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
  
  // Convert to output format
  const byMap: MapDefensiveSetups[] = []
  let totalDefensiveRounds = 0
  
  for (const [mapId, formations] of Object.entries(mapFormations)) {
    const totalRounds = mapRoundCounts[mapId]
    totalDefensiveRounds += totalRounds
    
    const formationList: DefensiveFormation[] = Object.entries(formations)
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
  
  // Sort maps by total rounds
  byMap.sort((a, b) => b.totalRounds - a.totalRounds)
  
  return {
    teamId,
    teamName,
    totalDefensiveRounds,
    byMap,
  }
}

/**
 * Run defensive setup analysis for both teams
 */
export function runDefensiveSetupAnalysis(
  series: ValorantStreamlinedSeries
): DefensiveSetupAnalysisResult {
  const [team1, team2] = series.teams
  
  return {
    team1: analyzeDefensiveSetups(series, team1?.id || ''),
    team2: analyzeDefensiveSetups(series, team2?.id || ''),
  }
}

/**
 * Analytics function for the analytics runner
 */
export function defensiveSetupAnalysis(series: ValorantStreamlinedSeries): ValorantAnalyticsResult | null {
  const result = runDefensiveSetupAnalysis(series)
  
  // Check if we have any data
  const hasData = result.team1.totalDefensiveRounds > 0 || result.team2.totalDefensiveRounds > 0
  if (!hasData) {
    return null
  }
  
  return {
    name: 'defensiveSetupAnalysis',
    description: 'Analyzes defensive positioning at freeze time end',
    data: {
      teams: [result.team1, result.team2],
    },
    generatedAt: new Date().toISOString(),
  }
}
