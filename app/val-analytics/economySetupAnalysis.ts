/**
 * Economy-Based Setup Analysis
 * 
 * Analyzes defensive and offensive setups based on economy status (buy vs eco).
 * 
 * Definitions:
 * - Excludes: Round 1 and Round 13 (first round of each half)
 * - Buy: Won previous round OR purchased vandal/phantom/operator
 * - Eco: Lost previous round AND no vandal/phantom/operator purchased
 */

import { ValorantStreamlinedSeries, ValorantRound, ValorantGame } from '../utils/valorantSeriesConverter'
import { getClosestCalloutData } from '../utils/valorantMapData'
import { ValorantAnalyticsResult } from './types'

// ============================================================================
// TYPES
// ============================================================================

export interface EconomyFormation {
  formationKey: string
  superRegions: { [superRegionName: string]: number }
  count: number
  percentage: number
}

export interface MapEconomySetups {
  mapId: string
  mapName: string
  totalRounds: number
  formations: EconomyFormation[]
}

export interface EconomySetupData {
  buy: {
    totalRounds: number
    byMap: MapEconomySetups[]
  }
  eco: {
    totalRounds: number
    byMap: MapEconomySetups[]
  }
}

export interface TeamEconomyAnalysis {
  teamId: string
  teamName: string
  defensive: EconomySetupData
  offensive: EconomySetupData
}

export interface EconomySetupAnalysisResult {
  team1: TeamEconomyAnalysis
  team2: TeamEconomyAnalysis
}

// ============================================================================
// HELPERS
// ============================================================================

const BUY_WEAPONS = ['vandal', 'phantom', 'operator']

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
 * Determine if a round is a buy round for a team
 */
function isBuyRound(
  round: ValorantRound,
  previousRound: ValorantRound | null,
  teamId: string,
  game: ValorantGame
): boolean {
  // Check if team won previous round
  if (previousRound && previousRound.winnerTeamId === teamId) {
    return true
  }
  
  // Check if any team member purchased vandal, phantom, or operator
  const teamPlayerIds = new Set(
    game.players.filter(p => p.teamId === teamId).map(p => p.id)
  )
  
  for (const purchase of round.purchases || []) {
    if (teamPlayerIds.has(purchase.playerId) || 
        game.players.some(p => p.teamId === teamId && p.name === purchase.playerName)) {
      const items = purchase.items.map(i => i.toLowerCase())
      for (const weapon of BUY_WEAPONS) {
        if (items.some(item => item.includes(weapon))) {
          return true
        }
      }
    }
  }
  
  return false
}

/**
 * Check if round should be excluded (round 1 or round 13)
 */
function isExcludedRound(roundNumber: number): boolean {
  return roundNumber === 1 || roundNumber === 13
}

/**
 * Get player positions for a round
 */
function getPositions(
  round: ValorantRound,
  teamId: string,
  mapId: string,
  players: { id: string; teamId: string }[],
  side: 'attacker' | 'defender',
  useFirstKill: boolean // true for offensive (at first kill), false for defensive (at freeze end)
): { [superRegionName: string]: number } | null {
  // Check team's side
  const teamSide = round.teamSides.find(ts => ts.teamId === teamId)
  if (!teamSide || teamSide.side !== side) {
    return null
  }
  
  const snapshots = round.coordinateTracking || []
  if (snapshots.length === 0) {
    return null
  }
  
  let snapshot = snapshots[0]
  
  if (useFirstKill) {
    // For offensive: use snapshot at first kill
    const kills = round.kills || []
    if (kills.length === 0) {
      return null
    }
    
    const firstKillTime = new Date(kills[0].occurredAt).getTime()
    let bestDiff = Math.abs(snapshots[0].time - firstKillTime)
    
    for (const s of snapshots) {
      const diff = Math.abs(s.time - firstKillTime)
      if (diff < bestDiff || (s.time <= firstKillTime && snapshot.time > firstKillTime)) {
        bestDiff = diff
        snapshot = s
      }
    }
  } else {
    // For defensive: use snapshot after freeze time ends
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
  }
  
  const teamPlayerIds = new Set(
    players.filter(p => p.teamId === teamId).map(p => p.id)
  )
  
  const superRegionCounts: { [name: string]: number } = {}
  
  for (const coord of snapshot.playerCoordinates) {
    if (!teamPlayerIds.has(coord.playerId)) continue
    
    const callout = getClosestCalloutData(mapId, coord.x, coord.y)
    if (callout) {
      const region = callout.superRegionName
      superRegionCounts[region] = (superRegionCounts[region] || 0) + 1
    }
  }
  
  const totalPlayers = Object.values(superRegionCounts).reduce((a, b) => a + b, 0)
  if (totalPlayers < 3) {
    return null
  }
  
  return superRegionCounts
}

// ============================================================================
// MAIN ANALYSIS
// ============================================================================

export function analyzeEconomySetups(
  series: ValorantStreamlinedSeries,
  teamId: string
): TeamEconomyAnalysis {
  const team = series.teams.find(t => t.id === teamId)
  const teamName = team?.name || 'Unknown Team'
  
  // Track formations by: map -> economy (buy/eco) -> side (def/off) -> formationKey
  const data: {
    [mapId: string]: {
      defensive: { buy: { [key: string]: { superRegions: { [n: string]: number }; count: number } }; eco: { [key: string]: { superRegions: { [n: string]: number }; count: number } } }
      offensive: { buy: { [key: string]: { superRegions: { [n: string]: number }; count: number } }; eco: { [key: string]: { superRegions: { [n: string]: number }; count: number } } }
    }
  } = {}
  
  const roundCounts: {
    [mapId: string]: {
      defensive: { buy: number; eco: number }
      offensive: { buy: number; eco: number }
    }
  } = {}
  
  for (const game of series.games) {
    const mapId = game.mapId
    if (!data[mapId]) {
      data[mapId] = {
        defensive: { buy: {}, eco: {} },
        offensive: { buy: {}, eco: {} },
      }
      roundCounts[mapId] = {
        defensive: { buy: 0, eco: 0 },
        offensive: { buy: 0, eco: 0 },
      }
    }
    
    const players = game.players.map(p => ({ id: p.id, teamId: p.teamId }))
    
    for (let i = 0; i < game.rounds.length; i++) {
      const round = game.rounds[i]
      const previousRound = i > 0 ? game.rounds[i - 1] : null
      
      // Skip excluded rounds
      if (isExcludedRound(round.roundNumber)) {
        continue
      }
      
      const isBuy = isBuyRound(round, previousRound, teamId, game)
      const economyType = isBuy ? 'buy' : 'eco'
      
      // Check defensive positions
      const defPositions = getPositions(round, teamId, mapId, players, 'defender', false)
      if (defPositions) {
        roundCounts[mapId].defensive[economyType]++
        const formationKey = createFormationKey(defPositions)
        if (!data[mapId].defensive[economyType][formationKey]) {
          data[mapId].defensive[economyType][formationKey] = {
            superRegions: defPositions,
            count: 0,
          }
        }
        data[mapId].defensive[economyType][formationKey].count++
      }
      
      // Check offensive positions
      const offPositions = getPositions(round, teamId, mapId, players, 'attacker', true)
      if (offPositions) {
        roundCounts[mapId].offensive[economyType]++
        const formationKey = createFormationKey(offPositions)
        if (!data[mapId].offensive[economyType][formationKey]) {
          data[mapId].offensive[economyType][formationKey] = {
            superRegions: offPositions,
            count: 0,
          }
        }
        data[mapId].offensive[economyType][formationKey].count++
      }
    }
  }
  
  // Build output
  const buildSetupData = (side: 'defensive' | 'offensive'): EconomySetupData => {
    const buyMaps: MapEconomySetups[] = []
    const ecoMaps: MapEconomySetups[] = []
    let totalBuyRounds = 0
    let totalEcoRounds = 0
    
    for (const [mapId, mapData] of Object.entries(data)) {
      const buyRounds = roundCounts[mapId][side].buy
      const ecoRounds = roundCounts[mapId][side].eco
      totalBuyRounds += buyRounds
      totalEcoRounds += ecoRounds
      
      // Buy formations
      const buyFormations = Object.entries(mapData[side].buy)
        .map(([formationKey, d]) => ({
          formationKey,
          superRegions: d.superRegions,
          count: d.count,
          percentage: buyRounds > 0 ? (d.count / buyRounds) * 100 : 0,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
      
      if (buyFormations.length > 0) {
        buyMaps.push({
          mapId,
          mapName: formatMapName(mapId),
          totalRounds: buyRounds,
          formations: buyFormations,
        })
      }
      
      // Eco formations
      const ecoFormations = Object.entries(mapData[side].eco)
        .map(([formationKey, d]) => ({
          formationKey,
          superRegions: d.superRegions,
          count: d.count,
          percentage: ecoRounds > 0 ? (d.count / ecoRounds) * 100 : 0,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
      
      if (ecoFormations.length > 0) {
        ecoMaps.push({
          mapId,
          mapName: formatMapName(mapId),
          totalRounds: ecoRounds,
          formations: ecoFormations,
        })
      }
    }
    
    buyMaps.sort((a, b) => b.totalRounds - a.totalRounds)
    ecoMaps.sort((a, b) => b.totalRounds - a.totalRounds)
    
    return {
      buy: { totalRounds: totalBuyRounds, byMap: buyMaps },
      eco: { totalRounds: totalEcoRounds, byMap: ecoMaps },
    }
  }
  
  return {
    teamId,
    teamName,
    defensive: buildSetupData('defensive'),
    offensive: buildSetupData('offensive'),
  }
}

export function runEconomySetupAnalysis(
  series: ValorantStreamlinedSeries
): EconomySetupAnalysisResult {
  const [team1, team2] = series.teams
  
  return {
    team1: analyzeEconomySetups(series, team1?.id || ''),
    team2: analyzeEconomySetups(series, team2?.id || ''),
  }
}

/**
 * Analytics function for the analytics runner
 */
export function economySetupAnalysis(series: ValorantStreamlinedSeries): ValorantAnalyticsResult | null {
  const result = runEconomySetupAnalysis(series)
  
  const hasData = 
    result.team1.defensive.buy.totalRounds > 0 ||
    result.team1.defensive.eco.totalRounds > 0 ||
    result.team1.offensive.buy.totalRounds > 0 ||
    result.team1.offensive.eco.totalRounds > 0 ||
    result.team2.defensive.buy.totalRounds > 0 ||
    result.team2.defensive.eco.totalRounds > 0 ||
    result.team2.offensive.buy.totalRounds > 0 ||
    result.team2.offensive.eco.totalRounds > 0
  
  if (!hasData) {
    return null
  }
  
  return {
    name: 'economySetupAnalysis',
    description: 'Analyzes setups based on economy status (buy vs eco)',
    data: {
      teams: [result.team1, result.team2],
    },
    generatedAt: new Date().toISOString(),
  }
}
