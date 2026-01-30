import { StreamlinedSeries, StreamlinedGame, StreamlinedTeam, CoordinateSnapshot } from '../utils/seriesConverter'
import { AnalyticsResult } from './types'

const FIFTEEN_MINUTES_IN_SECONDS = 15 * 60

interface TeamGoldAt15 {
  teamId: string
  teamName: string
  totalWorthAt15: number
}

interface GameComebackData {
  gameId: string
  blueTeamId: string
  blueTeamName: string
  redTeamId: string
  redTeamName: string
  winnerTeamId: string
  winnerTeamName: string
  
  // Gold state at 15 minutes
  blueTeamWorthAt15: number
  redTeamWorthAt15: number
  goldDifferenceAt15: number // positive = blue ahead, negative = red ahead
  
  // Which team was ahead at 15
  teamAheadAt15Id: string
  teamAheadAt15: string
  teamBehindAt15Id: string
  teamBehindAt15: string
  leadAmount: number // absolute value of gold lead
  
  // Outcome
  comebackOccurred: boolean // Did the behind team win?
  leadHeld: boolean // Did the ahead team win?
  
  // Descriptive outcome
  outcome: 'comeback' | 'lead_held' | 'even_at_15'
}

interface ComebackStatsResult {
  totalGames: number
  totalComebacks: number
  totalLeadsHeld: number
  totalEvenAt15: number
  comebackRate: number // % of games where behind team won
  leadHoldRate: number // % of games where ahead team won
  avgComebackDeficit: number // avg gold deficit when comeback occurred
  avgLeadWhenHeld: number // avg gold lead when lead was held
  games: GameComebackData[]
}

/**
 * Get team name by team ID
 */
function getTeamName(teams: StreamlinedTeam[], teamId: string): string {
  const team = teams.find(t => t.id === teamId)
  return team?.name || 'Unknown'
}

/**
 * Get total team worth at a specific time
 */
function getTeamWorthAtTime(
  game: StreamlinedGame,
  teamId: string,
  targetTime: number
): number {
  // Find the coordinate snapshot closest to (but not after) the target time
  let bestSnapshot: CoordinateSnapshot | null = null
  
  for (const snapshot of game.coordinateTracking) {
    if (snapshot.time <= targetTime) {
      bestSnapshot = snapshot
    } else {
      break
    }
  }
  
  if (!bestSnapshot) return 0
  
  // Get all players on this team
  const teamPlayers = game.players.filter(p => p.teamId === teamId)
  const teamPlayerIds = new Set(teamPlayers.map(p => p.id))
  
  // Sum up worth for all team members
  let totalWorth = 0
  for (const playerCoord of bestSnapshot.playerCoordinates) {
    if (teamPlayerIds.has(playerCoord.playerId)) {
      totalWorth += playerCoord.worth || 0
    }
  }
  
  return totalWorth
}

/**
 * Analyze a single game for comeback stats
 */
function analyzeGame(game: StreamlinedGame, teams: StreamlinedTeam[]): GameComebackData | null {
  // Need coordinate tracking for worth data
  if (!game.coordinateTracking?.length) return null
  
  // Check if game is at least 15 minutes long
  if (game.gameLength < FIFTEEN_MINUTES_IN_SECONDS) return null
  
  // Need a winner
  if (!game.winnerTeamId) return null
  
  // Get team info
  const blueSidePlayers = game.players.filter(p => p.teamId === game.blueSideTeamId)
  const redSidePlayers = game.players.filter(p => p.teamId !== game.blueSideTeamId)
  
  const blueTeamId = game.blueSideTeamId
  const redTeamId = redSidePlayers[0]?.teamId || ''
  
  const blueTeamName = getTeamName(teams, blueTeamId)
  const redTeamName = getTeamName(teams, redTeamId)
  const winnerTeamName = getTeamName(teams, game.winnerTeamId)
  
  // Calculate team worth at 15 minutes
  const blueTeamWorthAt15 = getTeamWorthAtTime(game, blueTeamId, FIFTEEN_MINUTES_IN_SECONDS)
  const redTeamWorthAt15 = getTeamWorthAtTime(game, redTeamId, FIFTEEN_MINUTES_IN_SECONDS)
  const goldDifferenceAt15 = blueTeamWorthAt15 - redTeamWorthAt15
  
  // Determine who was ahead (consider < 500 gold diff as "even")
  const EVEN_THRESHOLD = 500
  let teamAheadAt15Id: string
  let teamAheadAt15: string
  let teamBehindAt15Id: string
  let teamBehindAt15: string
  let leadAmount: number
  let outcome: 'comeback' | 'lead_held' | 'even_at_15'
  
  if (Math.abs(goldDifferenceAt15) < EVEN_THRESHOLD) {
    // Game was essentially even at 15
    teamAheadAt15Id = ''
    teamAheadAt15 = 'Even'
    teamBehindAt15Id = ''
    teamBehindAt15 = 'Even'
    leadAmount = 0
    outcome = 'even_at_15'
  } else if (goldDifferenceAt15 > 0) {
    // Blue was ahead
    teamAheadAt15Id = blueTeamId
    teamAheadAt15 = blueTeamName
    teamBehindAt15Id = redTeamId
    teamBehindAt15 = redTeamName
    leadAmount = goldDifferenceAt15
    
    if (game.winnerTeamId === blueTeamId) {
      outcome = 'lead_held'
    } else {
      outcome = 'comeback'
    }
  } else {
    // Red was ahead
    teamAheadAt15Id = redTeamId
    teamAheadAt15 = redTeamName
    teamBehindAt15Id = blueTeamId
    teamBehindAt15 = blueTeamName
    leadAmount = Math.abs(goldDifferenceAt15)
    
    if (game.winnerTeamId === redTeamId) {
      outcome = 'lead_held'
    } else {
      outcome = 'comeback'
    }
  }
  
  const comebackOccurred = outcome === 'comeback'
  const leadHeld = outcome === 'lead_held'
  
  return {
    gameId: game.id,
    blueTeamId,
    blueTeamName,
    redTeamId,
    redTeamName,
    winnerTeamId: game.winnerTeamId,
    winnerTeamName,
    blueTeamWorthAt15,
    redTeamWorthAt15,
    goldDifferenceAt15,
    teamAheadAt15Id,
    teamAheadAt15,
    teamBehindAt15Id,
    teamBehindAt15,
    leadAmount,
    comebackOccurred,
    leadHeld,
    outcome,
  }
}

/**
 * Calculate average from an array of numbers
 */
function average(nums: number[]): number {
  if (nums.length === 0) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

/**
 * Comeback Stats Analytics
 * 
 * Tracks whether teams can come back from gold deficits at 15 minutes,
 * or if leading teams can hold their leads.
 */
export function comebackStats(series: StreamlinedSeries): AnalyticsResult | null {
  const games: GameComebackData[] = []
  
  for (const game of series.games) {
    const data = analyzeGame(game, series.teams)
    if (data) {
      games.push(data)
    }
  }
  
  if (games.length === 0) {
    return null
  }
  
  // Calculate aggregate stats
  const comebacks = games.filter(g => g.outcome === 'comeback')
  const leadsHeld = games.filter(g => g.outcome === 'lead_held')
  const evenGames = games.filter(g => g.outcome === 'even_at_15')
  
  const gamesWithClearLead = comebacks.length + leadsHeld.length
  
  const result: ComebackStatsResult = {
    totalGames: games.length,
    totalComebacks: comebacks.length,
    totalLeadsHeld: leadsHeld.length,
    totalEvenAt15: evenGames.length,
    comebackRate: gamesWithClearLead > 0 ? (comebacks.length / gamesWithClearLead) * 100 : 0,
    leadHoldRate: gamesWithClearLead > 0 ? (leadsHeld.length / gamesWithClearLead) * 100 : 0,
    avgComebackDeficit: average(comebacks.map(g => g.leadAmount)),
    avgLeadWhenHeld: average(leadsHeld.map(g => g.leadAmount)),
    games,
  }
  
  return {
    name: 'comebackStats',
    description: 'Tracks comebacks from gold deficits and ability to hold leads at 15 minutes',
    data: result,
    generatedAt: new Date().toISOString(),
  }
}
