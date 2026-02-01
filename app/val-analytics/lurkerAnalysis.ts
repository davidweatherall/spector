/**
 * Lurker Analysis
 * 
 * Detects lurker positions by looking at attacker positions 10 seconds after freeze time ends.
 * If 4 players are close together (within ~600 units) in the same superRegion, 
 * and 1 player is in a different superRegion, that player is considered a lurker.
 */

import { ValorantStreamlinedSeries, ValorantRound } from '../utils/valorantSeriesConverter'
import { getClosestCalloutData } from '../utils/valorantMapData'
import { ValorantAnalyticsResult } from './types'

// ============================================================================
// TYPES
// ============================================================================

const LURK_CHECK_START_MS = 5000 // Start checking 5 seconds after freeze time ends
const LURK_CHECK_END_MS = 30000 // Stop checking 30 seconds after freeze time ends
const PACK_RADIUS = 600 // Units to consider players as "together"

export interface LurkerInstance {
  lurkerId: string
  lurkerName: string
  lurkerSuperRegion: string
  lurkerCallout: string
  packSuperRegion: string // Where the main group is pushing
  x: number
  y: number
}

export interface PlayerLurkerStats {
  playerId: string
  playerName: string
  totalAttackRounds: number
  lurkCount: number
  lurkPercentage: number
  // Breakdown by push site: "When team pushes A, lurks at Mid 30%"
  byPushSite: {
    pushSite: string
    lurkLocations: {
      superRegion: string
      count: number
      percentage: number
    }[]
  }[]
}

export interface MapLurkerAnalysis {
  mapId: string
  mapName: string
  totalAttackRounds: number
  players: PlayerLurkerStats[]
}

export interface TeamLurkerAnalysis {
  teamId: string
  teamName: string
  byMap: MapLurkerAnalysis[]
}

export interface LurkerAnalysisResult {
  team1: TeamLurkerAnalysis
  team2: TeamLurkerAnalysis
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

interface PlayerPosition {
  playerId: string
  playerName: string
  x: number
  y: number
  superRegion: string
  callout: string
}

/**
 * Get all valid attacker position snapshots between 5-30 seconds after freeze time ends
 * Returns array of position arrays, one for each valid snapshot in the time window
 */
function getAttackerPositionSnapshots(
  round: ValorantRound,
  teamId: string,
  players: { id: string; name: string; teamId: string }[],
  mapId: string
): PlayerPosition[][] {
  // Check if team is on attack
  const teamSide = round.teamSides.find(ts => ts.teamId === teamId)
  if (!teamSide || teamSide.side !== 'attacker') {
    return []
  }

  const snapshots = round.coordinateTracking || []
  if (snapshots.length === 0) {
    return []
  }

  if (!round.freezetimeEndedAt) {
    return []
  }

  const freezeEndTime = new Date(round.freezetimeEndedAt).getTime()
  const windowStart = freezeEndTime + LURK_CHECK_START_MS
  const windowEnd = freezeEndTime + LURK_CHECK_END_MS

  // Get team players
  const teamPlayers = players.filter(p => p.teamId === teamId)
  const kills = round.kills || []

  const validSnapshots: PlayerPosition[][] = []

  // Check each snapshot in the time window
  for (const snapshot of snapshots) {
    if (snapshot.time < windowStart || snapshot.time > windowEnd) {
      continue
    }

    // Check which players are alive at this time
    const deadPlayerIds = new Set<string>()
    for (const kill of kills) {
      const killTime = new Date(kill.occurredAt).getTime()
      if (killTime <= snapshot.time) {
        deadPlayerIds.add(kill.victimId)
      }
    }

    // Get alive team players
    const aliveTeamPlayers = teamPlayers.filter(p => !deadPlayerIds.has(p.id))
    
    // Need at least 4 alive (3 for pack + 1 potential lurker)
    if (aliveTeamPlayers.length < 4) {
      continue
    }

    // Get positions for all alive team players
    const positions: PlayerPosition[] = []
    let hasAllCoords = true
    
    for (const player of aliveTeamPlayers) {
      const coord = snapshot.playerCoordinates.find(c => c.playerId === player.id)
      if (!coord) {
        hasAllCoords = false
        break
      }

      const calloutData = getClosestCalloutData(mapId, coord.x, coord.y)
      positions.push({
        playerId: player.id,
        playerName: player.name,
        x: coord.x,
        y: coord.y,
        superRegion: calloutData?.superRegionName || 'Unknown',
        callout: calloutData ? `${calloutData.superRegionName}: ${calloutData.regionName}` : 'Unknown',
      })
    }

    if (hasAllCoords && positions.length >= 4) {
      validSnapshots.push(positions)
    }
  }

  return validSnapshots
}

const MIN_PACK_SIZE = 3 // Minimum players needed together to form a "pack"

/**
 * Check if a group of players are all close together (within PACK_RADIUS)
 */
function arePlayersClose(players: PlayerPosition[]): boolean {
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      if (distance(players[i].x, players[i].y, players[j].x, players[j].y) > PACK_RADIUS) {
        return false
      }
    }
  }
  return true
}

/**
 * Detect lurkers in the given positions
 * Returns array of lurker instances (can be 0, 1, or 2 lurkers)
 * Requires at least 3 players together in the same region to form a "pack"
 */
function detectLurkers(positions: PlayerPosition[]): LurkerInstance[] {
  if (positions.length < MIN_PACK_SIZE) return []

  // Try to find a pack of 3+ players that are:
  // 1. All in the same superRegion
  // 2. All close together (within PACK_RADIUS)
  
  // Generate all combinations of 3+ players
  const lurkers: LurkerInstance[] = []
  
  // Start with largest possible pack and work down
  for (let packSize = positions.length; packSize >= MIN_PACK_SIZE; packSize--) {
    // Generate all combinations of packSize players
    const combinations = getCombinations(positions, packSize)
    
    for (const potentialPack of combinations) {
      // Check if all pack members are in the same superRegion
      const packRegion = potentialPack[0].superRegion
      const allSameRegion = potentialPack.every(p => p.superRegion === packRegion)
      if (!allSameRegion) continue
      
      // Check if all pack members are close together
      if (!arePlayersClose(potentialPack)) continue
      
      // Found a valid pack! Everyone else is a lurker
      const packPlayerIds = new Set(potentialPack.map(p => p.playerId))
      const foundLurkers = positions.filter(p => !packPlayerIds.has(p.playerId))
      
      // Only count as lurkers if they're in a DIFFERENT region than the pack
      for (const lurker of foundLurkers) {
        if (lurker.superRegion !== packRegion) {
          lurkers.push({
            lurkerId: lurker.playerId,
            lurkerName: lurker.playerName,
            lurkerSuperRegion: lurker.superRegion,
            lurkerCallout: lurker.callout,
            packSuperRegion: packRegion,
            x: lurker.x,
            y: lurker.y,
          })
        }
      }
      
      // If we found lurkers with this pack, return them
      if (lurkers.length > 0) {
        return lurkers
      }
    }
  }

  return []
}

/**
 * Generate all combinations of k elements from an array
 */
function getCombinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]]
  if (arr.length < k) return []
  
  const [first, ...rest] = arr
  const withFirst = getCombinations(rest, k - 1).map(combo => [first, ...combo])
  const withoutFirst = getCombinations(rest, k)
  
  return [...withFirst, ...withoutFirst]
}

// ============================================================================
// MAIN ANALYSIS
// ============================================================================

export function analyzeLurkers(
  series: ValorantStreamlinedSeries,
  teamId: string
): TeamLurkerAnalysis {
  const team = series.teams.find(t => t.id === teamId)
  const teamName = team?.name || 'Unknown Team'

  // Track lurk instances: map -> pushSite -> player -> lurkLocations
  const lurkerData: {
    [mapId: string]: {
      totalAttackRounds: number
      players: {
        [playerId: string]: {
          playerName: string
          totalAttackRounds: number
          lurkInstances: LurkerInstance[]
        }
      }
    }
  } = {}

  for (const game of series.games) {
    const mapId = game.mapId
    if (!lurkerData[mapId]) {
      lurkerData[mapId] = {
        totalAttackRounds: 0,
        players: {},
      }
    }

    // Initialize players for this map
    const teamPlayers = game.players.filter(p => p.teamId === teamId)
    for (const player of teamPlayers) {
      if (!lurkerData[mapId].players[player.id]) {
        lurkerData[mapId].players[player.id] = {
          playerName: player.name,
          totalAttackRounds: 0,
          lurkInstances: [],
        }
      }
    }

    for (const round of game.rounds) {
      // Get all valid position snapshots in the 5-30 second window
      const positionSnapshots = getAttackerPositionSnapshots(round, teamId, game.players, mapId)
      if (positionSnapshots.length === 0) continue

      // Count this as an attack round for all players (only once per round)
      lurkerData[mapId].totalAttackRounds++
      for (const player of teamPlayers) {
        if (lurkerData[mapId].players[player.id]) {
          lurkerData[mapId].players[player.id].totalAttackRounds++
        }
      }

      // Try to detect lurkers at any snapshot in the window
      // Only count lurk instances once per round (first detection)
      for (const positions of positionSnapshots) {
        const lurkerInstances = detectLurkers(positions)
        if (lurkerInstances.length > 0) {
          for (const lurkerInstance of lurkerInstances) {
            const playerData = lurkerData[mapId].players[lurkerInstance.lurkerId]
            if (playerData) {
              playerData.lurkInstances.push(lurkerInstance)
            }
          }
          break // Only count lurkers once per round
        }
      }
    }
  }

  // Build output
  const byMap: MapLurkerAnalysis[] = []

  for (const [mapId, mapData] of Object.entries(lurkerData)) {
    if (mapData.totalAttackRounds === 0) continue

    const players: PlayerLurkerStats[] = []

    for (const [playerId, playerData] of Object.entries(mapData.players)) {
      if (playerData.totalAttackRounds === 0) continue

      const lurkCount = playerData.lurkInstances.length
      const lurkPercentage = (lurkCount / playerData.totalAttackRounds) * 100

      // Group by push site
      const byPushSite: { [pushSite: string]: { [lurkRegion: string]: number } } = {}
      for (const instance of playerData.lurkInstances) {
        if (!byPushSite[instance.packSuperRegion]) {
          byPushSite[instance.packSuperRegion] = {}
        }
        if (!byPushSite[instance.packSuperRegion][instance.lurkerSuperRegion]) {
          byPushSite[instance.packSuperRegion][instance.lurkerSuperRegion] = 0
        }
        byPushSite[instance.packSuperRegion][instance.lurkerSuperRegion]++
      }

      // Convert to output format
      const pushSiteStats = Object.entries(byPushSite).map(([pushSite, lurkLocations]) => {
        const totalForPush = Object.values(lurkLocations).reduce((a, b) => a + b, 0)
        return {
          pushSite,
          lurkLocations: Object.entries(lurkLocations)
            .map(([superRegion, count]) => ({
              superRegion,
              count,
              percentage: (count / totalForPush) * 100,
            }))
            .sort((a, b) => b.count - a.count),
        }
      }).sort((a, b) => {
        const totalA = a.lurkLocations.reduce((sum, l) => sum + l.count, 0)
        const totalB = b.lurkLocations.reduce((sum, l) => sum + l.count, 0)
        return totalB - totalA
      })

      players.push({
        playerId,
        playerName: playerData.playerName,
        totalAttackRounds: playerData.totalAttackRounds,
        lurkCount,
        lurkPercentage,
        byPushSite: pushSiteStats,
      })
    }

    // Sort by lurk percentage descending
    players.sort((a, b) => b.lurkPercentage - a.lurkPercentage)

    // Only include if there's meaningful lurk data
    if (players.some(p => p.lurkCount > 0)) {
      byMap.push({
        mapId,
        mapName: formatMapName(mapId),
        totalAttackRounds: mapData.totalAttackRounds,
        players,
      })
    }
  }

  // Sort maps by total attack rounds
  byMap.sort((a, b) => b.totalAttackRounds - a.totalAttackRounds)

  return {
    teamId,
    teamName,
    byMap,
  }
}

export function runLurkerAnalysis(
  series: ValorantStreamlinedSeries
): LurkerAnalysisResult {
  const [team1, team2] = series.teams

  return {
    team1: analyzeLurkers(series, team1?.id || ''),
    team2: analyzeLurkers(series, team2?.id || ''),
  }
}

/**
 * Analytics function for the analytics runner
 */
export function lurkerAnalysis(series: ValorantStreamlinedSeries): ValorantAnalyticsResult | null {
  const result = runLurkerAnalysis(series)

  const hasData = result.team1.byMap.length > 0 || result.team2.byMap.length > 0
  if (!hasData) {
    return null
  }

  return {
    name: 'lurkerAnalysis',
    description: 'Analyzes lurker positions during attack rounds',
    data: {
      teams: [result.team1, result.team2],
    },
    generatedAt: new Date().toISOString(),
  }
}
