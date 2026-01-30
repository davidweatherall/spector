import { StreamlinedSeries, StreamlinedGame, StreamlinedTeam, GamePlayer, DraftingAction } from '../utils/seriesConverter'
import { getRoleFromPlayerName, PlayerRole } from '../utils/getRoleFromPlayerName'
import { AnalyticsResult } from './types'

const FIFTEEN_MINUTES_IN_SECONDS = 15 * 60

interface CounterPickData {
  playerName: string
  teamId: string
  teamName: string
  champName: string
  role: PlayerRole
  wasCounterPick: boolean // They picked AFTER enemy picked their lane opponent
  worthAt15: number // Total gold earned by 15 mins
  enemyWorthAt15: number
  worthDiff: number // positive = ahead, negative = behind
  gameId: string
}

interface CounterPickGoldDiffResult {
  topLane: {
    counterPickGames: CounterPickData[]
    counterPickedGames: CounterPickData[] // When enemy counter picked them
    avgWorthDiffWhenCounterPicking: number
    avgWorthDiffWhenCounterPicked: number
  }
  midLane: {
    counterPickGames: CounterPickData[]
    counterPickedGames: CounterPickData[]
    avgWorthDiffWhenCounterPicking: number
    avgWorthDiffWhenCounterPicked: number
  }
}

/**
 * Find when a champion was picked in the draft
 * Returns the pick order index (lower = picked earlier)
 */
function getPickOrder(champName: string, draftActions: DraftingAction[]): number {
  const picks = draftActions.filter(a => a.action === 'pick')
  const index = picks.findIndex(a => a.champName === champName)
  return index === -1 ? 999 : index
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
 * Find the lane opponent for a player
 */
function findLaneOpponent(
  player: GamePlayer,
  allPlayers: GamePlayer[],
  role: PlayerRole
): GamePlayer | null {
  const opponents = allPlayers.filter(p => 
    p.teamId !== player.teamId && 
    getRoleFromPlayerName(p.name) === role
  )
  return opponents[0] || null
}

/**
 * Get team name by team ID
 */
function getTeamName(teams: StreamlinedTeam[], teamId: string): string {
  const team = teams.find(t => t.id === teamId)
  return team?.name || 'Unknown'
}

/**
 * Analyze a single game for counter pick gold diff
 */
function analyzeGame(game: StreamlinedGame, teams: StreamlinedTeam[]): CounterPickData[] {
  const results: CounterPickData[] = []
  
  // Only analyze games with coordinate tracking and draft data
  if (!game.coordinateTracking?.length || !game.draftingActions?.length) {
    return results
  }
  
  // Check if game is at least 15 minutes long
  if (game.gameLength < FIFTEEN_MINUTES_IN_SECONDS) {
    return results
  }
  
  // Analyze each player for counter pick scenarios
  for (const player of game.players) {
    const role = getRoleFromPlayerName(player.name)
    if (!role || (role !== 'top' && role !== 'mid')) continue
    
    const opponent = findLaneOpponent(player, game.players, role)
    if (!opponent) continue
    
    const playerPickOrder = getPickOrder(player.champName, game.draftingActions)
    const opponentPickOrder = getPickOrder(opponent.champName, game.draftingActions)
    
    // Skip if we can't determine pick order
    if (playerPickOrder === 999 || opponentPickOrder === 999) continue
    
    const wasCounterPick = playerPickOrder > opponentPickOrder
    
    const worthAt15 = getWorthAtTime(game, player.id, FIFTEEN_MINUTES_IN_SECONDS)
    const enemyWorthAt15 = getWorthAtTime(game, opponent.id, FIFTEEN_MINUTES_IN_SECONDS)
    const worthDiff = worthAt15 - enemyWorthAt15
    
    results.push({
      playerName: player.name,
      teamId: player.teamId,
      teamName: getTeamName(teams, player.teamId),
      champName: player.champName,
      role,
      wasCounterPick,
      worthAt15,
      enemyWorthAt15,
      worthDiff,
      gameId: game.id,
    })
  }
  
  return results
}

/**
 * Calculate average from an array of numbers
 */
function average(nums: number[]): number {
  if (nums.length === 0) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

/**
 * Counter Pick Gold Diff Analytics
 * 
 * Analyzes gold difference at 15 minutes for top and mid laners
 * based on whether they counter picked or were counter picked.
 */
export function counterPickGoldDiff(series: StreamlinedSeries): AnalyticsResult | null {
  const allData: CounterPickData[] = []
  
  for (const game of series.games) {
    const gameData = analyzeGame(game, series.teams)
    allData.push(...gameData)
  }
  
  if (allData.length === 0) {
    return null
  }
  
  // Separate by role and counter pick status
  const topCounterPick = allData.filter(d => d.role === 'top' && d.wasCounterPick)
  const topCounterPicked = allData.filter(d => d.role === 'top' && !d.wasCounterPick)
  const midCounterPick = allData.filter(d => d.role === 'mid' && d.wasCounterPick)
  const midCounterPicked = allData.filter(d => d.role === 'mid' && !d.wasCounterPick)
  
  const result: CounterPickGoldDiffResult = {
    topLane: {
      counterPickGames: topCounterPick,
      counterPickedGames: topCounterPicked,
      avgWorthDiffWhenCounterPicking: average(topCounterPick.map(d => d.worthDiff)),
      avgWorthDiffWhenCounterPicked: average(topCounterPicked.map(d => d.worthDiff)),
    },
    midLane: {
      counterPickGames: midCounterPick,
      counterPickedGames: midCounterPicked,
      avgWorthDiffWhenCounterPicking: average(midCounterPick.map(d => d.worthDiff)),
      avgWorthDiffWhenCounterPicked: average(midCounterPicked.map(d => d.worthDiff)),
    },
  }
  
  return {
    name: 'counterPickGoldDiff',
    description: 'Total gold earned (worth) difference at 15 minutes for top/mid laners based on counter pick status',
    data: result,
    generatedAt: new Date().toISOString(),
  }
}
