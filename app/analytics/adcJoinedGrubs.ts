import { StreamlinedSeries, StreamlinedGame, StreamlinedTeam, GamePlayer, GameEvent, KillATierMonsterEvent, CoordinateSnapshot } from '../utils/seriesConverter'
import { getRoleFromPlayerName } from '../utils/getRoleFromPlayerName'
import { AnalyticsResult } from './types'

// Grub pit area bounds
const GRUB_AREA = {
  minX: 3500,
  maxX: 5500,
  minY: 8800,
  maxY: 10800,
}

interface AdcGrubData {
  gameId: string
  grubTime: number
  killerTeamId: string
  killerTeamName: string
  
  // Team IDs and names
  blueTeamId: string
  blueTeamName: string
  redTeamId: string
  redTeamName: string
  
  // ADC position data for the team that killed the grub
  adcPlayerName: string
  adcTeamId: string
  adcTeamName: string
  adcX: number | null
  adcY: number | null
  adcJoinedForGrubs: boolean
}

interface AdcJoinedGrubsResult {
  totalFirstGrubs: number // One per game
  grubsWithAdcPresent: number
  grubsWithoutAdcPresent: number
  adcPresentRate: number // Percentage
  grubDetails: AdcGrubData[]
}

/**
 * Get team name by team ID
 */
function getTeamName(teams: StreamlinedTeam[], teamId: string): string {
  const team = teams.find(t => t.id === teamId)
  return team?.name || 'Unknown'
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
 * Find the most recent coordinate snapshot before a given time
 */
function findCoordinatesBeforeTime(
  coordinateTracking: CoordinateSnapshot[],
  beforeTime: number
): CoordinateSnapshot | null {
  let lastSnapshot: CoordinateSnapshot | null = null
  
  for (const snapshot of coordinateTracking) {
    if (snapshot.time <= beforeTime) {
      lastSnapshot = snapshot
    } else {
      break
    }
  }
  
  return lastSnapshot
}

/**
 * Check if coordinates are within the grub area
 */
function isInGrubArea(x: number, y: number): boolean {
  return (
    x >= GRUB_AREA.minX &&
    x <= GRUB_AREA.maxX &&
    y >= GRUB_AREA.minY &&
    y <= GRUB_AREA.maxY
  )
}

/**
 * Analyze a single game for ADC grub participation
 */
function analyzeGame(game: StreamlinedGame, teams: StreamlinedTeam[]): AdcGrubData | null {
  // Need events and coordinates for analysis
  if (!game.events?.length || !game.coordinateTracking?.length) return null
  
  // Find first grub kill
  const firstGrub = findFirstGrubKill(game.events)
  if (!firstGrub) return null
  
  // Find which team killed the grub
  const grubKiller = game.players.find(p => p.id === firstGrub.playerId)
  if (!grubKiller) return null
  
  const killerTeamId = grubKiller.teamId
  const killerTeamName = getTeamName(teams, killerTeamId)
  
  // Get team names
  const blueSidePlayers = game.players.filter(p => p.teamId === game.blueSideTeamId)
  const redSidePlayers = game.players.filter(p => p.teamId !== game.blueSideTeamId)
  
  const blueTeamName = getTeamName(teams, game.blueSideTeamId)
  const redTeamId = redSidePlayers[0]?.teamId || ''
  const redTeamName = getTeamName(teams, redTeamId)
  
  // Find the ADC of the team that killed the grub
  const killerTeamPlayers = killerTeamId === game.blueSideTeamId ? blueSidePlayers : redSidePlayers
  const adcPlayer = killerTeamPlayers.find(p => getRoleFromPlayerName(p.name) === 'bot')
  
  if (!adcPlayer) return null
  
  // Find coordinates at grub time
  const coordSnapshot = findCoordinatesBeforeTime(game.coordinateTracking, firstGrub.time)
  
  let adcX: number | null = null
  let adcY: number | null = null
  let adcJoinedForGrubs = false
  
  if (coordSnapshot) {
    const adcCoords = coordSnapshot.playerCoordinates.find(p => p.playerId === adcPlayer.id)
    if (adcCoords) {
      adcX = adcCoords.x
      adcY = adcCoords.y
      adcJoinedForGrubs = isInGrubArea(adcCoords.x, adcCoords.y)
    }
  }
  
  return {
    gameId: game.id,
    grubTime: firstGrub.time,
    killerTeamId,
    killerTeamName,
    blueTeamId: game.blueSideTeamId,
    blueTeamName,
    redTeamId,
    redTeamName,
    adcPlayerName: adcPlayer.name,
    adcTeamId: killerTeamId,
    adcTeamName: killerTeamName,
    adcX,
    adcY,
    adcJoinedForGrubs,
  }
}

/**
 * ADC Joined for Grubs Analytics
 * 
 * Tracks whether the ADC of the team that secured the first grub
 * was in the grub area (x: 3500-5500, y: 8800-10800) at the time of the kill.
 */
export function adcJoinedGrubs(series: StreamlinedSeries): AnalyticsResult | null {
  const grubDetails: AdcGrubData[] = []
  
  for (const game of series.games) {
    const data = analyzeGame(game, series.teams)
    if (data) {
      grubDetails.push(data)
    }
  }
  
  if (grubDetails.length === 0) {
    return null
  }
  
  // Calculate stats
  const grubsWithAdcPresent = grubDetails.filter(d => d.adcJoinedForGrubs).length
  const grubsWithoutAdcPresent = grubDetails.filter(d => !d.adcJoinedForGrubs).length
  const adcPresentRate = (grubsWithAdcPresent / grubDetails.length) * 100
  
  const result: AdcJoinedGrubsResult = {
    totalFirstGrubs: grubDetails.length,
    grubsWithAdcPresent,
    grubsWithoutAdcPresent,
    adcPresentRate,
    grubDetails,
  }
  
  return {
    name: 'adcJoinedGrubs',
    description: 'Whether the ADC was in the grub area (x: 3500-5500, y: 8800-10800) when team secured first grub',
    data: result,
    generatedAt: new Date().toISOString(),
  }
}
