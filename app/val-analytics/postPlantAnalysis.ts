/**
 * Post-Plant Position Analysis
 * 
 * Analyzes where attackers typically hold after planting the bomb.
 * Tracks player positions 10 seconds after the bomb plant event.
 * Data is split by plant site (A/B/C).
 */

import { ValorantStreamlinedSeries, ValorantRound } from '../utils/valorantSeriesConverter'
import { getClosestCalloutData } from '../utils/valorantMapData'
import { ValorantAnalyticsResult } from './types'

// ============================================================================
// TYPES
// ============================================================================

const CLUSTER_RADIUS = 300 // Units to consider positions as "same spot"
const POST_PLANT_DELAY_MS = 10000 // Track position 10 seconds after plant
const VALID_PLANT_SITES = ['A', 'B', 'C'] // Only track plants at these sites

export interface PostPlantCluster {
  centroidX: number
  centroidY: number
  callout: string
  superRegion: string
  count: number
  percentage: number
  positions: { x: number; y: number }[]
}

export interface PlayerPostPlantData {
  playerId: string
  playerName: string
  totalPlants: number // Number of plants at this site where player was alive
  clusters: PostPlantCluster[]
}

export interface SitePostPlantData {
  site: string // A, B, or C
  totalPlants: number // Total plants at this site
  players: PlayerPostPlantData[]
}

export interface MapPostPlantPositions {
  mapId: string
  mapName: string
  totalPlantsOnMap: number
  bySite: SitePostPlantData[]
}

export interface TeamPostPlantAnalysis {
  teamId: string
  teamName: string
  byMap: MapPostPlantPositions[]
}

export interface PostPlantAnalysisResult {
  team1: TeamPostPlantAnalysis
  team2: TeamPostPlantAnalysis
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
 * Check if player died before the target time
 */
function playerDiedBefore(round: ValorantRound, playerId: string, targetTime: number): boolean {
  const kills = round.kills || []
  for (const kill of kills) {
    if (kill.victimId === playerId) {
      const killTime = new Date(kill.occurredAt).getTime()
      if (killTime < targetTime) {
        return true
      }
    }
  }
  return false
}

/**
 * Get the plant site (A, B, or C) from the bomb plant position
 * Returns null if not a valid site
 */
function getPlantSite(round: ValorantRound, mapId: string): string | null {
  if (!round.bombPlant || !round.bombPlant.position) {
    return null
  }
  
  const callout = getClosestCalloutData(mapId, round.bombPlant.position.x, round.bombPlant.position.y)
  if (!callout) {
    return null
  }
  
  // Check if superRegionName is A, B, or C
  const superRegion = callout.superRegionName
  if (VALID_PLANT_SITES.includes(superRegion)) {
    return superRegion
  }
  
  return null
}

/**
 * Get player position 10 seconds after bomb plant
 * Returns null if player died before this point
 */
function getPostPlantPosition(
  round: ValorantRound,
  playerId: string,
  teamId: string
): RawPosition | null {
  // Check if team is on attack
  const teamSide = round.teamSides.find(ts => ts.teamId === teamId)
  if (!teamSide || teamSide.side !== 'attacker') {
    return null
  }
  
  // Check if bomb was planted
  if (!round.bombPlant || !round.bombPlant.occurredAt) {
    return null
  }
  
  const plantTime = new Date(round.bombPlant.occurredAt).getTime()
  const targetTime = plantTime + POST_PLANT_DELAY_MS
  
  // Check if player died before the target time - don't count them
  if (playerDiedBefore(round, playerId, targetTime)) {
    return null
  }
  
  const snapshots = round.coordinateTracking || []
  if (snapshots.length === 0) {
    return null
  }
  
  // Find snapshot closest to 10 seconds after plant
  let bestSnapshot = null
  let bestTimeDiff = Infinity
  
  for (const snapshot of snapshots) {
    const snapshotTime = snapshot.time
    // Only consider snapshots after the plant
    if (snapshotTime >= plantTime) {
      const timeDiff = Math.abs(snapshotTime - targetTime)
      if (timeDiff < bestTimeDiff) {
        bestTimeDiff = timeDiff
        bestSnapshot = snapshot
      }
    }
  }
  
  if (!bestSnapshot) {
    return null
  }
  
  // Find this player's coordinates
  const coord = bestSnapshot.playerCoordinates.find(c => c.playerId === playerId)
  if (!coord) {
    return null
  }
  
  // Check if player is still alive (has valid coordinates)
  if (coord.x === 0 && coord.y === 0) {
    return null
  }
  
  return { x: coord.x, y: coord.y }
}

/**
 * Check if a round has a bomb plant
 */
function hasPlant(round: ValorantRound): boolean {
  return !!round.bombPlant
}

// ============================================================================
// MAIN ANALYSIS
// ============================================================================

export function analyzePostPlantPositions(
  series: ValorantStreamlinedSeries,
  teamId: string
): TeamPostPlantAnalysis {
  const team = series.teams.find(t => t.id === teamId)
  const teamName = team?.name || 'Unknown Team'
  
  // Track positions: map -> site -> { totalPlants, players -> positions[] }
  const positionsByMapSite: {
    [mapId: string]: {
      totalPlants: number
      bySite: {
        [site: string]: {
          totalPlants: number
          players: {
            [playerId: string]: {
              playerName: string
              positions: RawPosition[]
            }
          }
        }
      }
    }
  } = {}
  
  for (const game of series.games) {
    const mapId = game.mapId
    if (!positionsByMapSite[mapId]) {
      positionsByMapSite[mapId] = {
        totalPlants: 0,
        bySite: {},
      }
    }
    
    // Get team players for this game
    const teamPlayers = game.players.filter(p => p.teamId === teamId)
    
    for (const round of game.rounds) {
      // Only count rounds where bomb was planted and team was attacking
      const teamSide = round.teamSides.find(ts => ts.teamId === teamId)
      if (!teamSide || teamSide.side !== 'attacker') continue
      if (!hasPlant(round)) continue
      
      // Get plant site - skip if not A, B, or C
      const plantSite = getPlantSite(round, mapId)
      if (!plantSite) continue
      
      positionsByMapSite[mapId].totalPlants++
      
      // Initialize site if needed
      if (!positionsByMapSite[mapId].bySite[plantSite]) {
        positionsByMapSite[mapId].bySite[plantSite] = {
          totalPlants: 0,
          players: {},
        }
      }
      
      positionsByMapSite[mapId].bySite[plantSite].totalPlants++
      
      for (const player of teamPlayers) {
        const pos = getPostPlantPosition(round, player.id, teamId)
        if (pos) {
          if (!positionsByMapSite[mapId].bySite[plantSite].players[player.id]) {
            positionsByMapSite[mapId].bySite[plantSite].players[player.id] = {
              playerName: player.name,
              positions: [],
            }
          }
          positionsByMapSite[mapId].bySite[plantSite].players[player.id].positions.push(pos)
        }
      }
    }
  }
  
  // Build output with clustering
  const byMap: MapPostPlantPositions[] = []
  
  for (const [mapId, mapData] of Object.entries(positionsByMapSite)) {
    if (mapData.totalPlants === 0) continue
    
    const bySite: SitePostPlantData[] = []
    
    for (const [site, siteData] of Object.entries(mapData.bySite)) {
      if (siteData.totalPlants === 0) continue
      
      const players: PlayerPostPlantData[] = []
      
      for (const [playerId, data] of Object.entries(siteData.players)) {
        if (data.positions.length < 1) continue
        
        const clusters = clusterPositions(data.positions, CLUSTER_RADIUS)
        
        // Convert clusters to output format
        const postPlantClusters: PostPlantCluster[] = clusters
          .filter(c => c.positions.length >= 1)
          .map(c => {
            const callout = getClosestCalloutData(mapId, c.centroidX, c.centroidY)
            return {
              centroidX: c.centroidX,
              centroidY: c.centroidY,
              callout: callout ? `${callout.superRegionName}: ${callout.regionName}` : 'Unknown',
              superRegion: callout?.superRegionName || 'Unknown',
              count: c.positions.length,
              percentage: (c.positions.length / data.positions.length) * 100,
              positions: c.positions.map(p => ({ x: p.x, y: p.y })),
            }
          })
          .sort((a, b) => b.count - a.count)
          .slice(0, 5) // Top 5 spots per player
        
        if (postPlantClusters.length > 0) {
          players.push({
            playerId,
            playerName: data.playerName,
            totalPlants: data.positions.length,
            clusters: postPlantClusters,
          })
        }
      }
      
      // Sort players by name
      players.sort((a, b) => a.playerName.localeCompare(b.playerName))
      
      if (players.length > 0) {
        bySite.push({
          site,
          totalPlants: siteData.totalPlants,
          players,
        })
      }
    }
    
    // Sort sites alphabetically (A, B, C)
    bySite.sort((a, b) => a.site.localeCompare(b.site))
    
    if (bySite.length > 0) {
      byMap.push({
        mapId,
        mapName: formatMapName(mapId),
        totalPlantsOnMap: mapData.totalPlants,
        bySite,
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

export function runPostPlantAnalysis(
  series: ValorantStreamlinedSeries
): PostPlantAnalysisResult {
  const [team1, team2] = series.teams
  
  return {
    team1: analyzePostPlantPositions(series, team1?.id || ''),
    team2: analyzePostPlantPositions(series, team2?.id || ''),
  }
}

/**
 * Analytics function for the analytics runner
 */
export function postPlantAnalysis(series: ValorantStreamlinedSeries): ValorantAnalyticsResult | null {
  const result = runPostPlantAnalysis(series)
  
  const hasData = result.team1.byMap.length > 0 || result.team2.byMap.length > 0
  if (!hasData) {
    return null
  }
  
  return {
    name: 'postPlantAnalysis',
    description: 'Analyzes post-plant positioning for attackers',
    data: {
      teams: [result.team1, result.team2],
    },
    generatedAt: new Date().toISOString(),
  }
}
