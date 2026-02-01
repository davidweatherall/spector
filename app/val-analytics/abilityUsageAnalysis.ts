/**
 * Ability Usage Analysis
 * 
 * Tracks ability usage positions before and within 5 seconds of freeze time ending.
 * Clusters positions to find common ability usage spots.
 */

import { ValorantStreamlinedSeries, ValorantRound } from '../utils/valorantSeriesConverter'
import { getClosestCalloutData } from '../utils/valorantMapData'
import { ValorantAnalyticsResult } from './types'

// ============================================================================
// TYPES
// ============================================================================

const ABILITY_WINDOW_MS = 5000 // Track abilities within 5 seconds of freeze end
const CLUSTER_RADIUS = 300 // Units to consider positions as "same spot"

interface RawPosition {
  x: number
  y: number
}

interface AbilityPosition {
  x: number
  y: number
  abilityId: string
  agentName: string
}

export interface AbilityCluster {
  centroidX: number
  centroidY: number
  callout: string
  superRegion: string
  abilityId: string
  agentName: string
  count: number
  percentage: number
  positions: { x: number; y: number }[]
}

export interface PlayerAbilityData {
  playerId: string
  playerName: string
  totalRounds: number
  clusters: AbilityCluster[]
}

export interface MapAbilityPositions {
  mapId: string
  mapName: string
  players: PlayerAbilityData[]
}

export interface TeamAbilityAnalysis {
  teamId: string
  teamName: string
  byMap: MapAbilityPositions[]
}

export interface AbilityUsageAnalysisResult {
  team1: TeamAbilityAnalysis
  team2: TeamAbilityAnalysis
}

// ============================================================================
// HELPERS
// ============================================================================

function formatMapName(mapId: string): string {
  return mapId.charAt(0).toUpperCase() + mapId.slice(1).toLowerCase()
}

function distance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x1 - x2
  const dy = y1 - y2
  return Math.sqrt(dx * dx + dy * dy)
}

interface Cluster {
  positions: RawPosition[]
  centroidX: number
  centroidY: number
  abilityId: string
  agentName: string
}

/**
 * Simple clustering: add position to nearest cluster if within radius and same ability+agent,
 * otherwise create new cluster
 */
function clusterAbilityPositions(positions: AbilityPosition[], radius: number): Cluster[] {
  const clusters: Cluster[] = []
  
  for (const pos of positions) {
    let foundCluster = false
    
    for (const cluster of clusters) {
      // Must be same ability AND same agent AND within radius
      if (cluster.abilityId === pos.abilityId && 
          cluster.agentName === pos.agentName &&
          distance(pos.x, pos.y, cluster.centroidX, cluster.centroidY) <= radius) {
        cluster.positions.push({ x: pos.x, y: pos.y })
        // Update centroid
        const n = cluster.positions.length
        cluster.centroidX = cluster.positions.reduce((sum, p) => sum + p.x, 0) / n
        cluster.centroidY = cluster.positions.reduce((sum, p) => sum + p.y, 0) / n
        foundCluster = true
        break
      }
    }
    
    if (!foundCluster) {
      clusters.push({
        positions: [{ x: pos.x, y: pos.y }],
        centroidX: pos.x,
        centroidY: pos.y,
        abilityId: pos.abilityId,
        agentName: pos.agentName,
      })
    }
  }
  
  return clusters
}

/**
 * Get ability usages around freeze time end (before and within 5 seconds after)
 * Only tracks the first usage of each ability type per round
 */
function getEarlyAbilityUsages(
  round: ValorantRound,
  playerId: string,
  teamId: string,
  agentName: string
): AbilityPosition[] {
  const abilityUsages = round.abilityUsages || []
  if (abilityUsages.length === 0) return []
  
  // Check if team is on defense (more relevant for setup abilities)
  const teamSide = round.teamSides.find(ts => ts.teamId === teamId)
  if (!teamSide || teamSide.side !== 'defender') {
    return []
  }
  
  if (!round.freezetimeEndedAt) {
    return []
  }
  
  const freezeEndTime = new Date(round.freezetimeEndedAt).getTime()
  const windowEnd = freezeEndTime + ABILITY_WINDOW_MS
  
  const relevantAbilities: AbilityPosition[] = []
  const seenAbilities = new Set<string>() // Track which ability types we've already counted
  
  for (const usage of abilityUsages) {
    if (usage.playerId !== playerId) continue
    
    const usageTime = new Date(usage.occurredAt).getTime()
    
    // Include abilities used before freeze end OR within 5 seconds after
    if (usageTime <= windowEnd) {
      // Only count first usage of each ability type per round
      if (seenAbilities.has(usage.abilityId)) continue
      
      // Only include if we have valid position data
      if (usage.position && (usage.position.x !== 0 || usage.position.y !== 0)) {
        seenAbilities.add(usage.abilityId)
        relevantAbilities.push({
          x: usage.position.x,
          y: usage.position.y,
          abilityId: usage.abilityId,
          agentName: agentName,
        })
      }
    }
  }
  
  return relevantAbilities
}

// ============================================================================
// MAIN ANALYSIS
// ============================================================================

export function analyzeAbilityUsage(
  series: ValorantStreamlinedSeries,
  teamId: string
): TeamAbilityAnalysis {
  const team = series.teams.find(t => t.id === teamId)
  const teamName = team?.name || 'Unknown Team'
  
  // Track positions: map -> player -> ability positions[]
  const abilityByMapPlayer: {
    [mapId: string]: {
      [playerId: string]: {
        playerName: string
        totalRounds: number
        abilities: AbilityPosition[]
      }
    }
  } = {}
  
  for (const game of series.games) {
    const mapId = game.mapId
    if (!abilityByMapPlayer[mapId]) {
      abilityByMapPlayer[mapId] = {}
    }
    
    // Get team players for this game
    const teamPlayers = game.players.filter(p => p.teamId === teamId)
    
    for (const round of game.rounds) {
      // Check if this is a defensive round for the team
      const teamSide = round.teamSides.find(ts => ts.teamId === teamId)
      if (!teamSide || teamSide.side !== 'defender') continue
      
      for (const player of teamPlayers) {
        // Get the player's agent for this game
        const agentName = player.characterId || 'Unknown'
        
        if (!abilityByMapPlayer[mapId][player.id]) {
          abilityByMapPlayer[mapId][player.id] = {
            playerName: player.name,
            totalRounds: 0,
            abilities: [],
          }
        }
        
        abilityByMapPlayer[mapId][player.id].totalRounds++
        
        const abilities = getEarlyAbilityUsages(round, player.id, teamId, agentName)
        abilityByMapPlayer[mapId][player.id].abilities.push(...abilities)
      }
    }
  }
  
  // Build output with clustering
  const byMap: MapAbilityPositions[] = []
  
  for (const [mapId, playerData] of Object.entries(abilityByMapPlayer)) {
    const players: PlayerAbilityData[] = []
    
    for (const [playerId, data] of Object.entries(playerData)) {
      if (data.abilities.length < 2) continue // Need at least 2 uses
      
      const clusters = clusterAbilityPositions(data.abilities, CLUSTER_RADIUS)
      
      // Convert clusters to output format
      const abilityClusters: AbilityCluster[] = clusters
        .filter(c => c.positions.length >= 2) // Only clusters with 2+ occurrences
        .map(c => {
          const callout = getClosestCalloutData(mapId, c.centroidX, c.centroidY)
          return {
            centroidX: c.centroidX,
            centroidY: c.centroidY,
            callout: callout ? `${callout.superRegionName}: ${callout.regionName}` : 'Unknown',
            superRegion: callout?.superRegionName || 'Unknown',
            abilityId: c.abilityId,
            agentName: c.agentName,
            count: c.positions.length,
            percentage: (c.positions.length / data.totalRounds) * 100,
            positions: c.positions,
          }
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 10) // Top 10 ability spots per player
      
      if (abilityClusters.length > 0) {
        players.push({
          playerId,
          playerName: data.playerName,
          totalRounds: data.totalRounds,
          clusters: abilityClusters,
        })
      }
    }
    
    // Sort players by name
    players.sort((a, b) => a.playerName.localeCompare(b.playerName))
    
    if (players.length > 0) {
      byMap.push({
        mapId,
        mapName: formatMapName(mapId),
        players,
      })
    }
  }
  
  // Sort maps by name
  byMap.sort((a, b) => a.mapName.localeCompare(b.mapName))
  
  return {
    teamId,
    teamName,
    byMap,
  }
}

export function runAbilityUsageAnalysis(
  series: ValorantStreamlinedSeries
): AbilityUsageAnalysisResult {
  const [team1, team2] = series.teams
  
  return {
    team1: analyzeAbilityUsage(series, team1?.id || ''),
    team2: analyzeAbilityUsage(series, team2?.id || ''),
  }
}

/**
 * Analytics function for the analytics runner
 */
export function abilityUsageAnalysis(series: ValorantStreamlinedSeries): ValorantAnalyticsResult | null {
  const result = runAbilityUsageAnalysis(series)
  
  const hasData = result.team1.byMap.length > 0 || result.team2.byMap.length > 0
  if (!hasData) {
    return null
  }
  
  return {
    name: 'abilityUsageAnalysis',
    description: 'Analyzes common ability usage positions at round start',
    data: {
      teams: [result.team1, result.team2],
    },
    generatedAt: new Date().toISOString(),
  }
}
