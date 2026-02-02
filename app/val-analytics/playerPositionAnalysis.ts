/**
 * Player Position Analysis
 * 
 * Analyzes common defending spots per player by clustering their positions
 * at freeze time end. Positions within ~300 units are grouped together.
 */

import { ValorantStreamlinedSeries, ValorantRound } from '../utils/valorantSeriesConverter'
import { getClosestCalloutData, ValorantMapCallout } from '../utils/valorantMapData'
import { ValorantAnalyticsResult } from './types'

// ============================================================================
// TYPES
// ============================================================================

const CLUSTER_RADIUS = 250 // Units to consider positions as "same spot"

export interface PositionCluster {
  centroidX: number
  centroidY: number
  callout: string // Closest callout name
  superRegion: string
  count: number
  percentage: number
  positions: { x: number; y: number }[] // Individual positions in this cluster
}

export interface PlayerPositionData {
  playerId: string
  playerName: string
  totalRounds: number
  clusters: PositionCluster[]
}

export interface MapPlayerPositions {
  mapId: string
  mapName: string
  players: PlayerPositionData[]
}

export interface TeamPlayerPositionAnalysis {
  teamId: string
  teamName: string
  byMap: MapPlayerPositions[]
}

export interface PlayerPositionAnalysisResult {
  team1: TeamPlayerPositionAnalysis
  team2: TeamPlayerPositionAnalysis
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

interface RawPosition {
  x: number
  y: number
}

interface Cluster {
  positions: RawPosition[]
  centroidX: number
  centroidY: number
}

/**
 * DBSCAN-style clustering: group positions by density
 * Fixes centroid drift issue by not updating centroid during assignment
 */
function clusterPositions(positions: RawPosition[], radius: number): Cluster[] {
  if (positions.length === 0) return []
  
  const visited = new Set<number>()
  const clusters: Cluster[] = []
  
  for (let i = 0; i < positions.length; i++) {
    if (visited.has(i)) continue
    
    // Start a new cluster with this position
    const clusterPositions: RawPosition[] = []
    const queue = [i]
    
    while (queue.length > 0) {
      const idx = queue.shift()!
      if (visited.has(idx)) continue
      visited.add(idx)
      
      const pos = positions[idx]
      clusterPositions.push(pos)
      
      // Find all unvisited neighbors within radius
      for (let j = 0; j < positions.length; j++) {
        if (!visited.has(j) && distance(pos.x, pos.y, positions[j].x, positions[j].y) <= radius) {
          queue.push(j)
        }
      }
    }
    
    if (clusterPositions.length > 0) {
      // Calculate centroid after all positions are assigned
      const centroidX = clusterPositions.reduce((sum, p) => sum + p.x, 0) / clusterPositions.length
      const centroidY = clusterPositions.reduce((sum, p) => sum + p.y, 0) / clusterPositions.length
      
      clusters.push({
        positions: clusterPositions,
        centroidX,
        centroidY,
      })
    }
  }
  
  return clusters
}

/**
 * Get player position at freeze time end for a defensive round
 */
function getDefensivePosition(
  round: ValorantRound,
  playerId: string,
  teamId: string
): RawPosition | null {
  // Check if team is on defense
  const teamSide = round.teamSides.find(ts => ts.teamId === teamId)
  if (!teamSide || teamSide.side !== 'defender') {
    return null
  }
  
  const snapshots = round.coordinateTracking || []
  if (snapshots.length === 0) {
    return null
  }
  
  // Find snapshot after freeze time ends
  let snapshot = snapshots[0]
  
  if (round.freezetimeEndedAt && snapshots.length > 1) {
    const freezeEndTime = new Date(round.freezetimeEndedAt).getTime()
    const afterFreezeSnapshots = snapshots.filter(s => s.time >= freezeEndTime)
    
    if (afterFreezeSnapshots.length > 0) {
      snapshot = afterFreezeSnapshots[0]
    } else {
      snapshot = snapshots[snapshots.length - 1]
    }
  } else if (snapshots.length > 1) {
    snapshot = snapshots[1]
  }
  
  // Find this player's coordinates
  const coord = snapshot.playerCoordinates.find(c => c.playerId === playerId)
  if (!coord) {
    return null
  }
  
  return { x: coord.x, y: coord.y }
}

// ============================================================================
// MAIN ANALYSIS
// ============================================================================

export function analyzePlayerPositions(
  series: ValorantStreamlinedSeries,
  teamId: string
): TeamPlayerPositionAnalysis {
  const team = series.teams.find(t => t.id === teamId)
  const teamName = team?.name || 'Unknown Team'
  
  // Track positions: map -> player -> positions[]
  const positionsByMapPlayer: {
    [mapId: string]: {
      [playerId: string]: {
        playerName: string
        positions: RawPosition[]
      }
    }
  } = {}
  
  for (const game of series.games) {
    const mapId = game.mapId
    if (!positionsByMapPlayer[mapId]) {
      positionsByMapPlayer[mapId] = {}
    }
    
    // Get team players for this game
    const teamPlayers = game.players.filter(p => p.teamId === teamId)
    
    for (const round of game.rounds) {
      for (const player of teamPlayers) {
        const pos = getDefensivePosition(round, player.id, teamId)
        if (pos) {
          if (!positionsByMapPlayer[mapId][player.id]) {
            positionsByMapPlayer[mapId][player.id] = {
              playerName: player.name,
              positions: [],
            }
          }
          positionsByMapPlayer[mapId][player.id].positions.push(pos)
        }
      }
    }
  }
  
  // Build output - pass raw positions, clustering happens in aggregation
  const byMap: MapPlayerPositions[] = []
  
  for (const [mapId, playerData] of Object.entries(positionsByMapPlayer)) {
    const players: PlayerPositionData[] = []
    
    for (const [playerId, data] of Object.entries(playerData)) {
      if (data.positions.length < 1) continue // Need at least 1 position
      
      // Pass all raw positions as a single "cluster" - real clustering happens in aggregation
      // This ensures positions from multiple series can be clustered together
      const rawCluster: PositionCluster = {
        centroidX: 0, // Will be recalculated in aggregation
        centroidY: 0,
        callout: 'Raw',
        superRegion: 'Raw',
        count: data.positions.length,
        percentage: 100,
        positions: data.positions.map(p => ({ x: p.x, y: p.y })),
      }
      
      players.push({
        playerId,
        playerName: data.playerName,
        totalRounds: data.positions.length,
        clusters: [rawCluster], // Single cluster with all raw positions
      })
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
  
  // Sort maps by number of players with data
  byMap.sort((a, b) => b.players.length - a.players.length)
  
  return {
    teamId,
    teamName,
    byMap,
  }
}

export function runPlayerPositionAnalysis(
  series: ValorantStreamlinedSeries
): PlayerPositionAnalysisResult {
  const [team1, team2] = series.teams
  
  return {
    team1: analyzePlayerPositions(series, team1?.id || ''),
    team2: analyzePlayerPositions(series, team2?.id || ''),
  }
}

/**
 * Analytics function for the analytics runner
 */
export function playerPositionAnalysis(series: ValorantStreamlinedSeries): ValorantAnalyticsResult | null {
  const result = runPlayerPositionAnalysis(series)
  
  const hasData = result.team1.byMap.length > 0 || result.team2.byMap.length > 0
  if (!hasData) {
    return null
  }
  
  return {
    name: 'playerPositionAnalysis',
    description: 'Analyzes common defending positions per player',
    data: {
      teams: [result.team1, result.team2],
    },
    generatedAt: new Date().toISOString(),
  }
}
