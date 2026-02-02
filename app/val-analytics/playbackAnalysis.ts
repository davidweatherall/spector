import { ValorantStreamlinedSeries } from '../utils/valorantSeriesConverter'
import { ValorantAnalyticsResult } from './types'

/**
 * Player data for playback
 */
export interface PlaybackPlayer {
  playerId: string
  playerName: string
  teamId: string
  teamName: string
  agentId: string
  side: 'attacker' | 'defender'
}

/**
 * Complete round data with both teams for playback
 */
export interface PlaybackRoundData {
  roundId: string
  gameNumber: number
  roundNumber: number
  mapId: string
  ourSide: 'attacker' | 'defender' // Which side our scouted team is on
  isWin: boolean // Did our team win
  players: PlaybackPlayer[] // All 10 players
  coordinateTracking: {
    time: number
    playerCoordinates: { playerId: string; x: number; y: number }[]
  }[]
  kills: {
    killerId: string
    victimId: string
    occurredAt: string
  }[]
  freezetimeEndedAt: string | null
  roundStartTime: number // First coordinate timestamp
  roundEndTime: number // Last coordinate timestamp
  bombPlantTime: number | null // Timestamp when bomb was planted (null if not planted)
}

/**
 * Team playback analysis data
 */
export interface TeamPlaybackAnalysis {
  teamId: string
  teamName: string
  byMap: {
    mapId: string
    attacker: PlaybackRoundData[] // Rounds where our team is attacker
    defender: PlaybackRoundData[] // Rounds where our team is defender
  }[]
}

/**
 * Playback analysis output - raw round data for synchronized playback
 */
export interface PlaybackAnalysisData {
  teams: TeamPlaybackAnalysis[]
}

/**
 * Analyze a team's playback data with full round info (both teams)
 */
function analyzeTeamPlayback(
  teamId: string,
  teamName: string,
  series: ValorantStreamlinedSeries
): TeamPlaybackAnalysis {
  const byMap: { [mapId: string]: { attacker: PlaybackRoundData[]; defender: PlaybackRoundData[] } } = {}
  
  for (const game of series.games) {
    const mapId = game.mapId
    
    if (!byMap[mapId]) {
      byMap[mapId] = { attacker: [], defender: [] }
    }
    
    // Get both teams info
    const teams = series.teams
    
    // Find team's side for each round
    for (const round of game.rounds) {
      // Skip rounds without coordinate tracking
      if (!round.coordinateTracking || round.coordinateTracking.length === 0) {
        continue
      }
      
      // Determine which side our team is on this round
      const ourTeamSide = round.teamSides?.find(ts => ts.teamId === teamId)
      if (!ourTeamSide) continue
      
      const ourSide = ourTeamSide.side as 'attacker' | 'defender'
      
      // Get ALL players for this round with their side info
      const allPlayers: PlaybackPlayer[] = game.players.map(p => {
        const playerTeam = teams.find(t => t.id === p.teamId)
        const playerSide = round.teamSides?.find(ts => ts.teamId === p.teamId)
        return {
          playerId: p.id,
          playerName: p.name,
          teamId: p.teamId,
          teamName: playerTeam?.name || 'Unknown',
          agentId: p.characterId || '',
          side: (playerSide?.side as 'attacker' | 'defender') || 'attacker',
        }
      })
      
      // Keep ALL coordinate tracking (both teams)
      const coordinateTracking = round.coordinateTracking.map(snapshot => ({
        time: snapshot.time,
        playerCoordinates: snapshot.playerCoordinates,
      })).filter(snapshot => snapshot.playerCoordinates.length > 0)
      
      if (coordinateTracking.length === 0) continue
      
      // Get round time bounds
      const roundStartTime = coordinateTracking[0].time
      const roundEndTime = coordinateTracking[coordinateTracking.length - 1].time
      
      // Keep ALL kills (for showing deaths on both teams)
      const allKills = round.kills.map(k => ({
        killerId: k.killerId,
        victimId: k.victimId,
        occurredAt: k.occurredAt,
      }))
      
      // Determine if our team won this round
      const isWin = round.winnerTeamId === teamId
      
      const roundData: PlaybackRoundData = {
        roundId: `${series.seriesId}-${game.gameNumber}-${round.roundNumber}`,
        gameNumber: game.gameNumber,
        roundNumber: round.roundNumber,
        mapId,
        ourSide,
        isWin,
        players: allPlayers,
        coordinateTracking,
        kills: allKills,
        freezetimeEndedAt: round.freezetimeEndedAt || null,
        roundStartTime,
        roundEndTime,
        bombPlantTime: round.bombPlant?.occurredAt ? new Date(round.bombPlant.occurredAt).getTime() : null,
      }
      
      byMap[mapId][ourSide].push(roundData)
    }
  }
  
  return {
    teamId,
    teamName,
    byMap: Object.entries(byMap).map(([mapId, sides]) => ({
      mapId,
      attacker: sides.attacker, // All rounds from this series
      defender: sides.defender, // All rounds from this series
    })),
  }
}

/**
 * Analyze series to extract playback data for both teams
 * Gets the most recent 20 rounds per map per side (attacker/defender)
 */
export function analyzePlayback(series: ValorantStreamlinedSeries): ValorantAnalyticsResult | null {
  if (series.teams.length < 2 || series.games.length === 0) {
    return null
  }
  
  const team1 = analyzeTeamPlayback(series.teams[0].id, series.teams[0].name, series)
  const team2 = analyzeTeamPlayback(series.teams[1].id, series.teams[1].name, series)
  
  // Check if we have any data
  const hasData = team1.byMap.some(m => m.attacker.length > 0 || m.defender.length > 0) ||
                  team2.byMap.some(m => m.attacker.length > 0 || m.defender.length > 0)
  
  if (!hasData) {
    return null
  }
  
  return {
    name: 'playback',
    description: 'Raw round data for synchronized playback',
    data: {
      teams: [team1, team2],
    },
    generatedAt: new Date().toISOString(),
  }
}
