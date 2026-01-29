import { StreamlinedSeries, StreamlinedGame, StreamlinedTeam, GameEvent, KillATierMonsterEvent, CoordinateSnapshot } from '../utils/seriesConverter'
import { getRoleFromPlayerName } from '../utils/getRoleFromPlayerName'
import { AnalyticsResult } from './types'

interface PlayerGoldData {
  playerName: string
  teamName: string
  role: 'mid' | 'bot'
  champName: string
  holdingGoldWhenDrakeDies: number
}

interface DrakeGoldData {
  gameId: string
  drakeNumber: number // 1st drake, 2nd drake, etc.
  drakeType: string
  drakeTime: number
  killerTeamName: string
  
  // Team names
  blueTeamName: string
  redTeamName: string
  
  // Gold holding data for mid and ADC from both teams
  players: PlayerGoldData[]
}

interface DrakeGoldHoldingResult {
  totalDrakes: number
  drakeDetails: DrakeGoldData[]
}

/**
 * Get team name by team ID
 */
function getTeamName(teams: StreamlinedTeam[], teamId: string): string {
  const team = teams.find(t => t.id === teamId)
  return team?.name || 'Unknown'
}

/**
 * Find all drake kills in a game
 */
function findDrakeKills(events: GameEvent[]): KillATierMonsterEvent[] {
  return events.filter(
    (e): e is KillATierMonsterEvent => 
      e.type === 'kill-atier-monster' && e.monsterName.includes('Drake')
  )
}

/**
 * Find the most recent coordinate snapshot before a given time
 */
function findCoordinatesAtTime(
  coordinateTracking: CoordinateSnapshot[],
  time: number
): CoordinateSnapshot | null {
  let lastSnapshot: CoordinateSnapshot | null = null
  
  for (const snapshot of coordinateTracking) {
    if (snapshot.time <= time) {
      lastSnapshot = snapshot
    } else {
      break
    }
  }
  
  return lastSnapshot
}

/**
 * Analyze a single game for drake gold holding
 */
function analyzeGame(game: StreamlinedGame, teams: StreamlinedTeam[]): DrakeGoldData[] {
  const results: DrakeGoldData[] = []
  
  // Need events and coordinates for analysis
  if (!game.events?.length || !game.coordinateTracking?.length) return results
  
  // Get team info
  const blueSidePlayers = game.players.filter(p => p.teamId === game.blueSideTeamId)
  const redSidePlayers = game.players.filter(p => p.teamId !== game.blueSideTeamId)
  
  const blueTeamName = getTeamName(teams, game.blueSideTeamId)
  const redTeamId = redSidePlayers[0]?.teamId || ''
  const redTeamName = getTeamName(teams, redTeamId)
  
  // Find mid and ADC players for both teams
  const blueMid = blueSidePlayers.find(p => getRoleFromPlayerName(p.name) === 'mid')
  const blueAdc = blueSidePlayers.find(p => getRoleFromPlayerName(p.name) === 'bot')
  const redMid = redSidePlayers.find(p => getRoleFromPlayerName(p.name) === 'mid')
  const redAdc = redSidePlayers.find(p => getRoleFromPlayerName(p.name) === 'bot')
  
  // Find all drake kills
  const drakeKills = findDrakeKills(game.events)
  
  let drakeNumber = 0
  for (const drake of drakeKills) {
    drakeNumber++
    
    // Find which team killed the drake
    const drakeKiller = game.players.find(p => p.id === drake.playerId)
    const killerTeamName = drakeKiller ? getTeamName(teams, drakeKiller.teamId) : 'Unknown'
    
    // Get coordinates at drake time to find gold values
    const coordSnapshot = findCoordinatesAtTime(game.coordinateTracking, drake.time)
    
    const players: PlayerGoldData[] = []
    
    // Get gold for each mid/ADC
    if (blueMid && coordSnapshot) {
      const playerCoord = coordSnapshot.playerCoordinates.find(p => p.playerId === blueMid.id)
      players.push({
        playerName: blueMid.name,
        teamName: blueTeamName,
        role: 'mid',
        champName: blueMid.champName,
        holdingGoldWhenDrakeDies: playerCoord?.gold || 0,
      })
    }
    
    if (blueAdc && coordSnapshot) {
      const playerCoord = coordSnapshot.playerCoordinates.find(p => p.playerId === blueAdc.id)
      players.push({
        playerName: blueAdc.name,
        teamName: blueTeamName,
        role: 'bot',
        champName: blueAdc.champName,
        holdingGoldWhenDrakeDies: playerCoord?.gold || 0,
      })
    }
    
    if (redMid && coordSnapshot) {
      const playerCoord = coordSnapshot.playerCoordinates.find(p => p.playerId === redMid.id)
      players.push({
        playerName: redMid.name,
        teamName: redTeamName,
        role: 'mid',
        champName: redMid.champName,
        holdingGoldWhenDrakeDies: playerCoord?.gold || 0,
      })
    }
    
    if (redAdc && coordSnapshot) {
      const playerCoord = coordSnapshot.playerCoordinates.find(p => p.playerId === redAdc.id)
      players.push({
        playerName: redAdc.name,
        teamName: redTeamName,
        role: 'bot',
        champName: redAdc.champName,
        holdingGoldWhenDrakeDies: playerCoord?.gold || 0,
      })
    }
    
    results.push({
      gameId: game.id,
      drakeNumber,
      drakeType: drake.monsterName,
      drakeTime: drake.time,
      killerTeamName,
      blueTeamName,
      redTeamName,
      players,
    })
  }
  
  return results
}

/**
 * Drake Gold Holding Analytics
 * 
 * Tracks how much gold mid laners and ADCs are holding when drakes die.
 * Helps analyze if players are shopping efficiently before objectives.
 */
export function drakeGoldHolding(series: StreamlinedSeries): AnalyticsResult | null {
  const drakeDetails: DrakeGoldData[] = []
  
  for (const game of series.games) {
    const data = analyzeGame(game, series.teams)
    drakeDetails.push(...data)
  }
  
  if (drakeDetails.length === 0) {
    return null
  }
  
  const result: DrakeGoldHoldingResult = {
    totalDrakes: drakeDetails.length,
    drakeDetails,
  }
  
  return {
    name: 'drakeGoldHolding',
    description: 'Gold held by mid laners and ADCs when drakes are killed',
    data: result,
    generatedAt: new Date().toISOString(),
  }
}
