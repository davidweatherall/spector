import { StreamlinedSeries, StreamlinedGame, StreamlinedTeam, DraftingAction } from '../utils/seriesConverter'
import { AnalyticsResult } from './types'

interface GameDraftData {
  gameId: string
  gameNumber: number
  
  // Team info
  blueTeamId: string
  blueTeamName: string
  redTeamId: string
  redTeamName: string
  
  // First pick/ban team (team that did the first action)
  firstPickTeamId: string
  firstPickTeamName: string
  
  // Drafting actions in order
  draftingActions: {
    teamId: string
    teamName: string
    champName: string
    action: 'ban' | 'pick'
    isOurTeam?: boolean // Added when aggregating for scouting report
  }[]
  
  // Separated for easy display
  blueBans: string[]
  bluePicks: string[]
  redBans: string[]
  redPicks: string[]
}

interface DraftAnalysisResult {
  totalGames: number
  games: GameDraftData[]
}

/**
 * Get team name by team ID
 */
function getTeamName(teams: StreamlinedTeam[], teamId: string): string {
  const team = teams.find(t => t.id === teamId)
  return team?.name || 'Unknown'
}

/**
 * Analyze drafting for a single game
 */
function analyzeGame(
  game: StreamlinedGame, 
  teams: StreamlinedTeam[],
  gameNumber: number
): GameDraftData | null {
  if (!game.draftingActions || game.draftingActions.length === 0) {
    return null
  }
  
  // Get team info
  const blueSidePlayers = game.players.filter(p => p.teamId === game.blueSideTeamId)
  const redSidePlayers = game.players.filter(p => p.teamId !== game.blueSideTeamId)
  
  const blueTeamId = game.blueSideTeamId
  const redTeamId = redSidePlayers[0]?.teamId || ''
  
  const blueTeamName = getTeamName(teams, blueTeamId)
  const redTeamName = getTeamName(teams, redTeamId)
  
  // First action determines first pick team
  const firstAction = game.draftingActions[0]
  const firstPickTeamId = firstAction.teamId
  const firstPickTeamName = getTeamName(teams, firstPickTeamId)
  
  // Convert drafting actions with team names
  const draftingActions = game.draftingActions.map(action => ({
    teamId: action.teamId,
    teamName: getTeamName(teams, action.teamId),
    champName: action.champName,
    action: action.action,
  }))
  
  // Separate bans and picks by team
  const blueBans: string[] = []
  const bluePicks: string[] = []
  const redBans: string[] = []
  const redPicks: string[] = []
  
  for (const action of game.draftingActions) {
    const isBlue = action.teamId === blueTeamId
    if (action.action === 'ban') {
      if (isBlue) blueBans.push(action.champName)
      else redBans.push(action.champName)
    } else {
      if (isBlue) bluePicks.push(action.champName)
      else redPicks.push(action.champName)
    }
  }
  
  return {
    gameId: game.id,
    gameNumber,
    blueTeamId,
    blueTeamName,
    redTeamId,
    redTeamName,
    firstPickTeamId,
    firstPickTeamName,
    draftingActions,
    blueBans,
    bluePicks,
    redBans,
    redPicks,
  }
}

/**
 * Draft Analysis
 * 
 * Tracks drafting information for each game including pick order,
 * bans, picks, and which team had first pick.
 */
export function draftAnalysis(series: StreamlinedSeries): AnalyticsResult | null {
  const games: GameDraftData[] = []
  
  let gameNumber = 0
  for (const game of series.games) {
    gameNumber++
    const data = analyzeGame(game, series.teams, gameNumber)
    if (data) {
      games.push(data)
    }
  }
  
  if (games.length === 0) {
    return null
  }
  
  const result: DraftAnalysisResult = {
    totalGames: games.length,
    games,
  }
  
  return {
    name: 'draftAnalysis',
    description: 'Analyzes the draft phase including bans and picks for all games in the series',
    data: result,
    generatedAt: new Date().toISOString(),
  }
}
