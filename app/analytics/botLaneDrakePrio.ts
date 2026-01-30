import { StreamlinedSeries, StreamlinedGame, StreamlinedTeam, GamePlayer, GameEvent, LevelUpEvent, DraftingAction } from '../utils/seriesConverter'
import { getRoleFromPlayerName } from '../utils/getRoleFromPlayerName'
import { AnalyticsResult } from './types'

interface LevelUpInfo {
  playerId: string
  level: number
  time: number
}

interface DrakeData {
  gameId: string
  drakeType: string
  drakeTime: number
  killerTeamId: string
  killerTeamName: string
  
  // Team IDs and names
  blueTeamId: string
  blueTeamName: string
  redTeamId: string
  redTeamName: string
  
  // Bot lane prio info
  blueBotPlayer: string
  redBotPlayer: string
  blueBotLevelAtDrake: number
  redBotLevelAtDrake: number
  blueBotLastLevelUpTime: number // When they reached their current level
  redBotLastLevelUpTime: number
  
  teamWithPrio: 'blue' | 'red' | 'even'
  prioTeamGotDrake: boolean
  
  // Counter pick info - which team picked their role AFTER the opponent
  hadBotCounterPick: string | null // Team name that counter picked bot, null if same pick order
  hadSupportCounterPick: string | null // Team name that counter picked support, null if same pick order
}

interface BotLaneDrakePrioResult {
  totalDrakes: number
  drakesWhenHadPrio: number
  drakesWhenNoPrio: number
  drakesWhenEven: number
  prioWinRate: number // % of drakes taken when team had prio
  drakeDetails: DrakeData[]
}

/**
 * Find all level up events for a player, sorted by time
 */
function getPlayerLevelUps(events: GameEvent[], playerId: string): LevelUpInfo[] {
  return events
    .filter((e): e is LevelUpEvent => e.type === 'level-up' && e.playerId === playerId)
    .map(e => ({
      playerId: e.playerId,
      level: e.newLevel,
      time: e.time,
    }))
    .sort((a, b) => a.time - b.time)
}

/**
 * Get the player's level at a specific time
 */
function getLevelAtTime(levelUps: LevelUpInfo[], time: number): { level: number; levelUpTime: number } {
  let currentLevel = 1
  let lastLevelUpTime = 0
  
  for (const lu of levelUps) {
    if (lu.time <= time) {
      currentLevel = lu.level
      lastLevelUpTime = lu.time
    } else {
      break
    }
  }
  
  return { level: currentLevel, levelUpTime: lastLevelUpTime }
}

/**
 * Find the first drake kill in a game
 */
function findFirstDrake(events: GameEvent[]): { time: number; monsterName: string; playerId: string } | null {
  for (const event of events) {
    if (event.type === 'kill-atier-monster' && event.monsterName.includes('Drake')) {
      return {
        time: event.time,
        monsterName: event.monsterName,
        playerId: event.playerId,
      }
    }
  }
  return null
}

/**
 * Determine which team has bot lane prio at drake time
 * 
 * Logic:
 * - If one bot has higher level, they have prio
 * - If same level, whoever leveled up to that level first has prio
 */
function determinePrio(
  blueBotLevel: number,
  blueBotLevelUpTime: number,
  redBotLevel: number,
  redBotLevelUpTime: number
): 'blue' | 'red' | 'even' {
  // Higher level = prio
  if (blueBotLevel > redBotLevel) return 'blue'
  if (redBotLevel > blueBotLevel) return 'red'
  
  // Same level - whoever reached it first has prio
  if (blueBotLevelUpTime < redBotLevelUpTime) return 'blue'
  if (redBotLevelUpTime < blueBotLevelUpTime) return 'red'
  
  return 'even'
}

/**
 * Get team name by team ID
 */
function getTeamName(teams: StreamlinedTeam[], teamId: string): string {
  const team = teams.find(t => t.id === teamId)
  return team?.name || 'Unknown'
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
 * Determine which team had the counter pick for a role
 * Returns the team name that picked AFTER, or null if same pick order / unable to determine
 */
function getCounterPickTeam(
  bluePlayer: GamePlayer | undefined,
  redPlayer: GamePlayer | undefined,
  draftActions: DraftingAction[] | undefined,
  blueTeamName: string,
  redTeamName: string
): string | null {
  if (!bluePlayer || !redPlayer || !draftActions?.length) return null
  
  const bluePickOrder = getPickOrder(bluePlayer.champName, draftActions)
  const redPickOrder = getPickOrder(redPlayer.champName, draftActions)
  
  // Can't determine if either pick order is unknown
  if (bluePickOrder === 999 || redPickOrder === 999) return null
  
  // Same pick order means no counter pick advantage
  if (bluePickOrder === redPickOrder) return null
  
  // Whoever picked LATER had the counter pick
  if (bluePickOrder > redPickOrder) return blueTeamName
  if (redPickOrder > bluePickOrder) return redTeamName
  
  return null
}

/**
 * Analyze a single game for bot lane drake prio
 */
function analyzeGame(game: StreamlinedGame, teams: StreamlinedTeam[]): DrakeData | null {
  // Need events for analysis
  if (!game.events?.length) return null
  
  // Find first drake
  const firstDrake = findFirstDrake(game.events)
  if (!firstDrake) return null
  
  // Find bot lane players
  const blueSidePlayers = game.players.filter(p => p.teamId === game.blueSideTeamId)
  const redSidePlayers = game.players.filter(p => p.teamId !== game.blueSideTeamId)
  
  const blueBotPlayer = blueSidePlayers.find(p => getRoleFromPlayerName(p.name) === 'bot')
  const redBotPlayer = redSidePlayers.find(p => getRoleFromPlayerName(p.name) === 'bot')
  
  if (!blueBotPlayer || !redBotPlayer) return null
  
  // Find support players
  const blueSupportPlayer = blueSidePlayers.find(p => getRoleFromPlayerName(p.name) === 'support')
  const redSupportPlayer = redSidePlayers.find(p => getRoleFromPlayerName(p.name) === 'support')
  
  // Get team names
  const blueTeamName = getTeamName(teams, game.blueSideTeamId)
  const redTeamId = redSidePlayers[0]?.teamId || ''
  const redTeamName = getTeamName(teams, redTeamId)
  
  // Get level up history for both bot laners
  const blueBotLevelUps = getPlayerLevelUps(game.events, blueBotPlayer.id)
  const redBotLevelUps = getPlayerLevelUps(game.events, redBotPlayer.id)
  
  // Get their levels at drake time
  const blueBotAtDrake = getLevelAtTime(blueBotLevelUps, firstDrake.time)
  const redBotAtDrake = getLevelAtTime(redBotLevelUps, firstDrake.time)
  
  // Determine prio
  const teamWithPrio = determinePrio(
    blueBotAtDrake.level,
    blueBotAtDrake.levelUpTime,
    redBotAtDrake.level,
    redBotAtDrake.levelUpTime
  )
  
  // Find which team killed the drake
  const drakeKiller = game.players.find(p => p.id === firstDrake.playerId)
  if (!drakeKiller) return null
  
  const killerTeamId = drakeKiller.teamId
  const killerIsBlue = killerTeamId === game.blueSideTeamId
  
  // Did the team with prio get the drake?
  let prioTeamGotDrake = false
  if (teamWithPrio === 'blue' && killerIsBlue) prioTeamGotDrake = true
  if (teamWithPrio === 'red' && !killerIsBlue) prioTeamGotDrake = true
  
  // Determine counter picks for bot lane
  const hadBotCounterPick = getCounterPickTeam(
    blueBotPlayer,
    redBotPlayer,
    game.draftingActions,
    blueTeamName,
    redTeamName
  )
  
  const hadSupportCounterPick = getCounterPickTeam(
    blueSupportPlayer,
    redSupportPlayer,
    game.draftingActions,
    blueTeamName,
    redTeamName
  )
  
  return {
    gameId: game.id,
    drakeType: firstDrake.monsterName,
    drakeTime: firstDrake.time,
    killerTeamId,
    killerTeamName: getTeamName(teams, killerTeamId),
    blueTeamId: game.blueSideTeamId,
    blueTeamName,
    redTeamId,
    redTeamName,
    blueBotPlayer: blueBotPlayer.name,
    redBotPlayer: redBotPlayer.name,
    blueBotLevelAtDrake: blueBotAtDrake.level,
    redBotLevelAtDrake: redBotAtDrake.level,
    blueBotLastLevelUpTime: blueBotAtDrake.levelUpTime,
    redBotLastLevelUpTime: redBotAtDrake.levelUpTime,
    teamWithPrio,
    prioTeamGotDrake,
    hadBotCounterPick,
    hadSupportCounterPick,
  }
}

/**
 * Bot Lane Drake Prio Analytics
 * 
 * Tracks correlation between bot lane priority (based on levels) 
 * and first drake control.
 */
export function botLaneDrakePrio(series: StreamlinedSeries): AnalyticsResult | null {
  const drakeDetails: DrakeData[] = []
  
  for (const game of series.games) {
    const data = analyzeGame(game, series.teams)
    if (data) {
      drakeDetails.push(data)
    }
  }
  
  if (drakeDetails.length === 0) {
    return null
  }
  
  // Calculate stats
  const drakesWhenHadPrio = drakeDetails.filter(d => d.prioTeamGotDrake && d.teamWithPrio !== 'even').length
  const drakesWhenNoPrio = drakeDetails.filter(d => !d.prioTeamGotDrake && d.teamWithPrio !== 'even').length
  const drakesWhenEven = drakeDetails.filter(d => d.teamWithPrio === 'even').length
  
  const gamesWithClearPrio = drakesWhenHadPrio + drakesWhenNoPrio
  const prioWinRate = gamesWithClearPrio > 0 
    ? (drakesWhenHadPrio / gamesWithClearPrio) * 100 
    : 0
  
  const result: BotLaneDrakePrioResult = {
    totalDrakes: drakeDetails.length,
    drakesWhenHadPrio,
    drakesWhenNoPrio,
    drakesWhenEven,
    prioWinRate,
    drakeDetails,
  }
  
  return {
    name: 'botLaneDrakePrio',
    description: 'Correlation between bot lane priority (based on level advantage) and first drake control',
    data: result,
    generatedAt: new Date().toISOString(),
  }
}
