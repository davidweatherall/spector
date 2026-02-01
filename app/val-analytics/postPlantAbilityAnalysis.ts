/**
 * Post-Plant Ability Usage Analysis
 * 
 * Tracks ability usage around bomb plant time (5 seconds before to 15 seconds after).
 * Only for the attacking team on rounds where the bomb was planted.
 */

import { ValorantStreamlinedSeries, ValorantRound } from '../utils/valorantSeriesConverter'
import { getClosestCalloutData } from '../utils/valorantMapData'
import { ValorantAnalyticsResult } from './types'

// ============================================================================
// TYPES
// ============================================================================

const PLANT_ABILITY_BEFORE_MS = 5000 // Track abilities 5 seconds before plant
const PLANT_ABILITY_AFTER_MS = 15000 // Track abilities 15 seconds after plant
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

export interface PostPlantAbilityCluster {
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

export interface PlayerPostPlantAbilityData {
  playerId: string
  playerName: string
  totalPlants: number // Number of rounds with plants this player was in
  clusters: PostPlantAbilityCluster[]
}

export interface MapPostPlantAbilityPositions {
  mapId: string
  mapName: string
  totalPlants: number
  players: PlayerPostPlantAbilityData[]
}

export interface TeamPostPlantAbilityAnalysis {
  teamId: string
  teamName: string
  byMap: MapPostPlantAbilityPositions[]
}

export interface PostPlantAbilityAnalysisResult {
  team1: TeamPostPlantAbilityAnalysis
  team2: TeamPostPlantAbilityAnalysis
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
      if (cluster.abilityId === pos.abilityId && 
          cluster.agentName === pos.agentName &&
          distance(pos.x, pos.y, cluster.centroidX, cluster.centroidY) <= radius) {
        cluster.positions.push({ x: pos.x, y: pos.y })
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
 * Check if a round has a bomb plant
 */
function hasPlant(round: ValorantRound): boolean {
  return !!round.bombPlant
}

/**
 * Get ability usages around plant time (5 seconds before to 15 seconds after)
 * Only tracks the first usage of each ability type per round
 */
function getPostPlantAbilityUsages(
  round: ValorantRound,
  playerId: string,
  agentName: string
): AbilityPosition[] {
  const abilityUsages = round.abilityUsages || []
  if (abilityUsages.length === 0) return []
  
  // Check if bomb was planted
  if (!round.bombPlant || !round.bombPlant.occurredAt) {
    return []
  }
  
  const plantTime = new Date(round.bombPlant.occurredAt).getTime()
  const windowStart = plantTime - PLANT_ABILITY_BEFORE_MS
  const windowEnd = plantTime + PLANT_ABILITY_AFTER_MS
  
  const relevantAbilities: AbilityPosition[] = []
  const seenAbilities = new Set<string>()
  
  for (const usage of abilityUsages) {
    if (usage.playerId !== playerId) continue
    
    const usageTime = new Date(usage.occurredAt).getTime()
    
    // Include abilities used within the plant window
    if (usageTime >= windowStart && usageTime <= windowEnd) {
      if (seenAbilities.has(usage.abilityId)) continue
      
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

export function analyzePostPlantAbility(
  series: ValorantStreamlinedSeries,
  teamId: string
): TeamPostPlantAbilityAnalysis {
  const team = series.teams.find(t => t.id === teamId)
  const teamName = team?.name || 'Unknown Team'
  
  // Track: map -> { totalPlants, players -> { playerName, totalPlants, abilities[] } }
  const abilityByMap: {
    [mapId: string]: {
      totalPlants: number
      players: {
        [playerId: string]: {
          playerName: string
          totalPlants: number
          abilities: AbilityPosition[]
        }
      }
    }
  } = {}
  
  for (const game of series.games) {
    const mapId = game.mapId
    if (!abilityByMap[mapId]) {
      abilityByMap[mapId] = {
        totalPlants: 0,
        players: {},
      }
    }
    
    const teamPlayers = game.players.filter(p => p.teamId === teamId)
    
    for (const round of game.rounds) {
      // Only attack rounds with plants
      const teamSide = round.teamSides.find(ts => ts.teamId === teamId)
      if (!teamSide || teamSide.side !== 'attacker') continue
      if (!hasPlant(round)) continue
      
      // Count this plant for the map
      abilityByMap[mapId].totalPlants++
      
      for (const player of teamPlayers) {
        const agentName = player.characterId || 'Unknown'
        
        if (!abilityByMap[mapId].players[player.id]) {
          abilityByMap[mapId].players[player.id] = {
            playerName: player.name,
            totalPlants: 0,
            abilities: [],
          }
        }
        
        abilityByMap[mapId].players[player.id].totalPlants++
        const abilities = getPostPlantAbilityUsages(round, player.id, agentName)
        abilityByMap[mapId].players[player.id].abilities.push(...abilities)
      }
    }
  }
  
  // Build output with clustering
  const byMap: MapPostPlantAbilityPositions[] = []
  
  for (const [mapId, mapData] of Object.entries(abilityByMap)) {
    if (mapData.totalPlants === 0) continue
    
    const players: PlayerPostPlantAbilityData[] = []
    
    for (const [playerId, data] of Object.entries(mapData.players)) {
      // No minimum - track all abilities
      if (data.abilities.length === 0) continue
      
      const clusters = clusterAbilityPositions(data.abilities, CLUSTER_RADIUS)
      
      const abilityClusters: PostPlantAbilityCluster[] = clusters
        .filter(c => c.positions.length >= 2) // Only show if same ability used 2+ times in same spot
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
            percentage: (c.positions.length / data.totalPlants) * 100,
            positions: c.positions,
          }
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
      
      if (abilityClusters.length > 0) {
        players.push({
          playerId,
          playerName: data.playerName,
          totalPlants: data.totalPlants,
          clusters: abilityClusters,
        })
      }
    }
    
    players.sort((a, b) => a.playerName.localeCompare(b.playerName))
    
    if (players.length > 0) {
      byMap.push({
        mapId,
        mapName: formatMapName(mapId),
        totalPlants: mapData.totalPlants,
        players,
      })
    }
  }
  
  byMap.sort((a, b) => a.mapName.localeCompare(b.mapName))
  
  return {
    teamId,
    teamName,
    byMap,
  }
}

export function runPostPlantAbilityAnalysis(
  series: ValorantStreamlinedSeries
): PostPlantAbilityAnalysisResult {
  const [team1, team2] = series.teams
  
  return {
    team1: analyzePostPlantAbility(series, team1?.id || ''),
    team2: analyzePostPlantAbility(series, team2?.id || ''),
  }
}

/**
 * Analytics function for the analytics runner
 */
export function postPlantAbilityAnalysis(series: ValorantStreamlinedSeries): ValorantAnalyticsResult | null {
  const result = runPostPlantAbilityAnalysis(series)
  
  const hasData = result.team1.byMap.length > 0 || result.team2.byMap.length > 0
  if (!hasData) {
    return null
  }
  
  return {
    name: 'postPlantAbilityAnalysis',
    description: 'Analyzes ability usage around bomb plant time',
    data: {
      teams: [result.team1, result.team2],
    },
    generatedAt: new Date().toISOString(),
  }
}
