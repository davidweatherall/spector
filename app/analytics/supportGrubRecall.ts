import { StreamlinedSeries, StreamlinedGame, StreamlinedTeam, GameEvent, KillATierMonsterEvent } from '../utils/seriesConverter'
import { getRoleFromPlayerName } from '../utils/getRoleFromPlayerName'
import { AnalyticsResult } from './types'

// Recall channel time (seconds)
const RECALL_CHANNEL_TIME = 8

interface GrubRecallData {
  gameId: string
  grubTime: number
  killerTeamName: string
  
  // Team names
  blueTeamName: string
  redTeamName: string
  
  // Support recall times (purchase time - 8 seconds for recall channel)
  blueSupportRecallTime: number | null
  redSupportRecallTime: number | null
}

interface SupportGrubRecallResult {
  totalGames: number
  grubDetails: GrubRecallData[]
}

/**
 * Get team name by team ID
 */
function getTeamName(teams: StreamlinedTeam[], teamId: string): string {
  const team = teams.find(t => t.id === teamId)
  return team?.name || 'Unknown'
}

/**
 * Find the support's most recent purchase before a given time
 */
function findLastPurchaseTimeBefore(
  events: GameEvent[],
  supportPlayerId: string,
  beforeTime: number
): number | null {
  let lastPurchaseTime: number | null = null
  
  for (const event of events) {
    if (event.type === 'purchase-item' && event.playerId === supportPlayerId && event.time < beforeTime) {
      if (lastPurchaseTime === null || event.time > lastPurchaseTime) {
        lastPurchaseTime = event.time
      }
    }
  }
  
  return lastPurchaseTime
}

/**
 * Find the first grub kill in a game
 */
function findFirstGrubKill(events: GameEvent[]): KillATierMonsterEvent | null {
  for (const event of events) {
    if (event.type === 'kill-atier-monster' && event.monsterName.startsWith('voidGrub')) {
      return event
    }
  }
  return null
}

/**
 * Analyze a single game for support grub recall timing
 */
function analyzeGame(game: StreamlinedGame, teams: StreamlinedTeam[]): GrubRecallData | null {
  // Need events for analysis
  if (!game.events?.length) return null
  
  // Find first grub kill only
  const firstGrub = findFirstGrubKill(game.events)
  if (!firstGrub) return null
  
  // Find support players
  const blueSidePlayers = game.players.filter(p => p.teamId === game.blueSideTeamId)
  const redSidePlayers = game.players.filter(p => p.teamId !== game.blueSideTeamId)
  
  const blueSupportPlayer = blueSidePlayers.find(p => getRoleFromPlayerName(p.name) === 'support')
  const redSupportPlayer = redSidePlayers.find(p => getRoleFromPlayerName(p.name) === 'support')
  
  // Get team names
  const blueTeamName = getTeamName(teams, game.blueSideTeamId)
  const redTeamId = redSidePlayers[0]?.teamId || ''
  const redTeamName = getTeamName(teams, redTeamId)
  
  // Find which team killed the grub
  const grubKiller = game.players.find(p => p.id === firstGrub.playerId)
  const killerTeamName = grubKiller ? getTeamName(teams, grubKiller.teamId) : 'Unknown'
  
  // Get support recall times (purchase time - 8 seconds for recall channel)
  let blueSupportRecallTime: number | null = null
  if (blueSupportPlayer) {
    const purchaseTime = findLastPurchaseTimeBefore(game.events, blueSupportPlayer.id, firstGrub.time)
    if (purchaseTime !== null) {
      blueSupportRecallTime = purchaseTime - RECALL_CHANNEL_TIME
    }
  }
  
  let redSupportRecallTime: number | null = null
  if (redSupportPlayer) {
    const purchaseTime = findLastPurchaseTimeBefore(game.events, redSupportPlayer.id, firstGrub.time)
    if (purchaseTime !== null) {
      redSupportRecallTime = purchaseTime - RECALL_CHANNEL_TIME
    }
  }
  
  return {
    gameId: game.id,
    grubTime: firstGrub.time,
    killerTeamName,
    blueTeamName,
    redTeamName,
    blueSupportRecallTime,
    redSupportRecallTime,
  }
}

/**
 * Support Grub Recall Analytics
 * 
 * Tracks support recall timing before first grub kill.
 * Recall time = purchase event time - 8 seconds (for recall channel).
 */
export function supportGrubRecall(series: StreamlinedSeries): AnalyticsResult | null {
  const grubDetails: GrubRecallData[] = []
  
  for (const game of series.games) {
    const data = analyzeGame(game, series.teams)
    if (data) {
      grubDetails.push(data)
    }
  }
  
  if (grubDetails.length === 0) {
    return null
  }
  
  const result: SupportGrubRecallResult = {
    totalGames: grubDetails.length,
    grubDetails,
  }
  
  return {
    name: 'supportGrubRecall',
    description: 'Support recall timing before first grub (purchase time - 8s for recall channel)',
    data: result,
    generatedAt: new Date().toISOString(),
  }
}
