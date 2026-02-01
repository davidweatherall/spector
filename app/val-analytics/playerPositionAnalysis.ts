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

const CLUSTER_RADIUS = 300 // Units to consider positions as "same spot"

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
 * Simple clustering: add position to nearest cluster if within radius,
 * otherwise create new cluster
 */
function clusterPositions(positions: RawPosition[], radius: number): Cluster[] {
  const clusters: Cluster[] = []
  
  for (const pos of positions) {
    let foundCluster = false
    
    for (const cluster of clusters) {
      if (distance(pos.x, pos.y, cluster.centroidX, cluster.centroidY) <= radius) {
        cluster.positions.push(pos)
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
        positions: [pos],
        centroidX: pos.x,
        centroidY: pos.y,
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
  
  // Build output with clustering
  const byMap: MapPlayerPositions[] = []
  
  for (const [mapId, playerData] of Object.entries(positionsByMapPlayer)) {
    const players: PlayerPositionData[] = []
    
    for (const [playerId, data] of Object.entries(playerData)) {
      if (data.positions.length < 2) continue // Need at least 2 positions
      
      const clusters = clusterPositions(data.positions, CLUSTER_RADIUS)
      
      // Convert clusters to output format
      const positionClusters: PositionCluster[] = clusters
        .filter(c => c.positions.length >= 2) // Only clusters with 2+ occurrences
        .map(c => {
          const callout = getClosestCalloutData(mapId, c.centroidX, c.centroidY)
          return {
            centroidX: c.centroidX,
            centroidY: c.centroidY,
            callout: callout ? `${callout.superRegionName}: ${callout.regionName}` : 'Unknown',
            superRegion: callout?.superRegionName || 'Unknown',
            count: c.positions.length,
            percentage: (c.positions.length / data.positions.length) * 100,
            positions: c.positions.map(p => ({ x: p.x, y: p.y })), // Store individual positions
          }
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 5) // Top 5 spots per player
      
      if (positionClusters.length > 0) {
        players.push({
          playerId,
          playerName: data.playerName,
          totalRounds: data.positions.length,
          clusters: positionClusters,
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
