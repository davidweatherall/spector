import { StreamlinedSeries } from '../utils/seriesConverter'
import { AnalyticsResult } from './types'
import { getRoleFromPlayerName } from '../utils/getRoleFromPlayerName'
import champClassData from '../../staticData/champClass.json'

interface ChampClassData {
  [champName: string]: {
    class: string[]
    hasHardCC: boolean
  }
}

const champClasses = champClassData as ChampClassData

interface ClassWinData {
  gameId: string
  role: 'top' | 'jungle' | 'support'
  teamId: string
  teamName: string
  playerName: string
  championName: string
  classes: string[]
  hasHardCC: boolean
  won: boolean
}

interface ClassWinRateResult {
  games: ClassWinData[]
}

/**
 * Analyze win rates based on champion class for top, jungle, and support
 */
export function analyzeClassWinRate(series: StreamlinedSeries): AnalyticsResult {
  const results: ClassWinData[] = []
  
  console.log(`[classWinRate] Analyzing series with ${series.games.length} games, teams: ${series.teams.map(t => t.name).join(', ')}`)
  
  for (const game of series.games) {
    // Use winnerTeamId from game directly
    const winnerTeamId = game.winnerTeamId
    if (!winnerTeamId) {
      console.log(`[classWinRate] Game ${game.id} has no winnerTeamId`)
      continue
    }
    
    // Get team info using blueSideTeamId from game
    const blueTeamId = game.blueSideTeamId
    const blueTeam = series.teams.find(t => t.id === blueTeamId)
    const redTeam = series.teams.find(t => t.id !== blueTeamId)
    
    if (!blueTeam || !redTeam) {
      console.log(`[classWinRate] Missing team info - blueSideTeamId: ${blueTeamId}, teams: ${series.teams.map(t => t.id).join(', ')}`)
      continue
    }
    
    // Analyze each player
    for (const player of game.players) {
      const role = getRoleFromPlayerName(player.name)
      
      // Only track top, jungle, and support
      if (role !== 'top' && role !== 'jungle' && role !== 'support') {
        continue
      }
      
      // Use champName (not championName) - that's the property name on GamePlayer
      const champData = champClasses[player.champName]
      if (!champData) {
        console.log(`[classWinRate] Champion ${player.champName} not found in champClass.json`)
        continue
      }
      
      // Determine team from player's teamId
      const team = player.teamId === blueTeam.id ? blueTeam : redTeam
      const won = team.id === winnerTeamId
      
      results.push({
        gameId: game.id,
        role: role as 'top' | 'jungle' | 'support',
        teamId: team.id,
        teamName: team.name,
        playerName: player.name,
        championName: player.champName,
        classes: champData.class,
        hasHardCC: champData.hasHardCC,
        won,
      })
    }
  }
  
  console.log(`[classWinRate] Collected ${results.length} results`)
  
  return {
    name: 'classWinRate',
    description: 'Analyzes win rates based on champion class for top, jungle, and support roles',
    data: { games: results } as ClassWinRateResult,
    generatedAt: new Date().toISOString(),
  }
}
