import { StreamlinedSeries, StreamlinedGame, StreamlinedTeam, GamePlayer, GameEvent, PurchaseItemEvent, KillEvent } from '../utils/seriesConverter'
import { getRoleFromPlayerName, PlayerRole } from '../utils/getRoleFromPlayerName'
import { AnalyticsResult } from './types'

const FIFTEEN_MINUTES_IN_SECONDS = 15 * 60
const MIN_TIME_FOR_RECALL = 180 // 3 minutes - purchases before this don't count
const MIN_TIME_BETWEEN_RECALLS = 180 // 3 minutes - must be this long since last counted recall
const DEATH_WINDOW = 30 // If killed within this time before purchase, it's a death not a recall

interface PlayerWorthData {
  playerId: string
  playerName: string
  teamId: string
  teamName: string
  role: PlayerRole | null
  champName: string
  worthAt15: number
  earlyRecallTimers: number[] // Times of early recalls (before 15 min)
}

interface GameWorthData {
  gameId: string
  blueTeamId: string
  blueTeamName: string
  redTeamId: string
  redTeamName: string
  players: PlayerWorthData[]
}

interface PlayerWorthAt15Result {
  totalGames: number
  games: GameWorthData[]
}

/**
 * Get team name by team ID
 */
function getTeamName(teams: StreamlinedTeam[], teamId: string): string {
  const team = teams.find(t => t.id === teamId)
  return team?.name || 'Unknown'
}

/**
 * Check if player died within a time window before a given time
 */
function playerDiedBefore(events: GameEvent[], playerId: string, beforeTime: number, windowSeconds: number): boolean {
  const windowStart = beforeTime - windowSeconds
  
  for (const event of events) {
    if (event.type === 'kill' && event.targetId === playerId) {
      if (event.time >= windowStart && event.time < beforeTime) {
        return true
      }
    }
  }
  
  return false
}

/**
 * Calculate early recall timers for a player
 * 
 * Rules:
 * - Only count purchase events after 180s
 * - Must be at least 180s after the last counted recall
 * - Don't count if player died within 30s before the purchase
 */
function getEarlyRecallTimers(events: GameEvent[], playerId: string): number[] {
  const recallTimers: number[] = []
  let lastRecallTime = 0
  
  // Get all purchase events for this player, sorted by time
  const purchaseEvents = events
    .filter((e): e is PurchaseItemEvent => e.type === 'purchase-item' && e.playerId === playerId)
    .sort((a, b) => a.time - b.time)
  
  for (const purchase of purchaseEvents) {
    // Must be after minimum time
    if (purchase.time < MIN_TIME_FOR_RECALL) continue
    
    // Must be at least MIN_TIME_BETWEEN_RECALLS since last counted recall
    if (purchase.time < lastRecallTime + MIN_TIME_BETWEEN_RECALLS) continue
    
    // Check if player died within DEATH_WINDOW before this purchase
    if (playerDiedBefore(events, playerId, purchase.time, DEATH_WINDOW)) continue
    
    // This is a valid recall
    recallTimers.push(purchase.time)
    lastRecallTime = purchase.time
  }
  
  return recallTimers
}

/**
 * Get the total gold earned (worth) for a player at a specific time (or closest before)
 */
function getWorthAtTime(
  game: StreamlinedGame,
  playerId: string,
  targetTime: number
): number {
  // Find the coordinate snapshot closest to (but not after) the target time
  let bestSnapshot = null
  
  for (const snapshot of game.coordinateTracking) {
    if (snapshot.time <= targetTime) {
      bestSnapshot = snapshot
    } else {
      break
    }
  }
  
  if (!bestSnapshot) return 0
  
  const playerCoord = bestSnapshot.playerCoordinates.find(p => p.playerId === playerId)
  return playerCoord?.worth || 0
}

/**
 * Analyze a single game for player worth at 15
 */
function analyzeGame(game: StreamlinedGame, teams: StreamlinedTeam[]): GameWorthData | null {
  // Need coordinate tracking for worth data
  if (!game.coordinateTracking?.length) return null
  
  // Check if game is at least 15 minutes long
  if (game.gameLength < FIFTEEN_MINUTES_IN_SECONDS) return null
  
  // Get team names
  const blueSidePlayers = game.players.filter(p => p.teamId === game.blueSideTeamId)
  const redSidePlayers = game.players.filter(p => p.teamId !== game.blueSideTeamId)
  
  const blueTeamName = getTeamName(teams, game.blueSideTeamId)
  const redTeamId = redSidePlayers[0]?.teamId || ''
  const redTeamName = getTeamName(teams, redTeamId)
  
  const players: PlayerWorthData[] = []
  
  for (const player of game.players) {
    const worthAt15 = getWorthAtTime(game, player.id, FIFTEEN_MINUTES_IN_SECONDS)
    const role = getRoleFromPlayerName(player.name)
    const earlyRecallTimers = getEarlyRecallTimers(game.events || [], player.id)
    
    players.push({
      playerId: player.id,
      playerName: player.name,
      teamId: player.teamId,
      teamName: getTeamName(teams, player.teamId),
      role,
      champName: player.champName,
      worthAt15,
      earlyRecallTimers,
    })
  }
  
  return {
    gameId: game.id,
    blueTeamId: game.blueSideTeamId,
    blueTeamName,
    redTeamId,
    redTeamName,
    players,
  }
}

/**
 * Player Worth at 15 Minutes Analytics
 * 
 * Tracks total gold earned (worth) at 15 minutes for every player in each game.
 */
export function playerWorthAt15(series: StreamlinedSeries): AnalyticsResult | null {
  const games: GameWorthData[] = []
  
  for (const game of series.games) {
    const data = analyzeGame(game, series.teams)
    if (data) {
      games.push(data)
    }
  }
  
  if (games.length === 0) {
    return null
  }
  
  const result: PlayerWorthAt15Result = {
    totalGames: games.length,
    games,
  }
  
  return {
    name: 'playerWorthAt15',
    description: 'Total gold earned (worth) at 15 minutes for every player',
    data: result,
    generatedAt: new Date().toISOString(),
  }
}
