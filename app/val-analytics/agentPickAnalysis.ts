import { ValorantStreamlinedSeries, ValorantGame, GamePlayer } from '../utils/valorantSeriesConverter'
import { ValorantAnalyticsResult } from './types'

/**
 * Agent pick frequency
 */
interface AgentFrequency {
  agentId: string
  agentName: string
  count: number
  totalGames: number
  percentage: number
}

/**
 * Agent pick data for a specific map
 */
interface MapAgentPicks {
  mapId: string
  mapName: string
  gamesPlayed: number
  agentPicks: AgentFrequency[]
}

/**
 * Per-team agent pick analysis
 */
interface TeamAgentAnalysis {
  teamId: string
  teamName: string
  totalMapsPlayed: number
  
  // Overall agent picks across all maps
  overallAgentPicks: AgentFrequency[]
  
  // Agent picks broken down by map
  agentPicksByMap: MapAgentPicks[]
  
  // Per-player agent preferences (which agents each player plays)
  playerAgentPreferences: {
    playerId: string
    playerName: string
    agentPicks: AgentFrequency[]
  }[]
}

/**
 * Overall agent pick analysis result
 */
interface AgentPickAnalysisData {
  totalGames: number
  teams: TeamAgentAnalysis[]
}

/**
 * Format map name for display
 */
function formatMapName(mapId: string): string {
  return mapId.charAt(0).toUpperCase() + mapId.slice(1)
}

/**
 * Format agent name for display
 */
function formatAgentName(agentId: string): string {
  // Handle common agent IDs (they might come as lowercase)
  return agentId.charAt(0).toUpperCase() + agentId.slice(1)
}

/**
 * Calculate agent frequencies from picks
 */
function calculateAgentFrequencies(
  picks: { agentId: string; agentName: string }[],
  totalGames: number
): AgentFrequency[] {
  const counts: { [key: string]: { agentId: string; agentName: string; count: number } } = {}
  
  for (const pick of picks) {
    if (!counts[pick.agentId]) {
      counts[pick.agentId] = {
        agentId: pick.agentId,
        agentName: pick.agentName || formatAgentName(pick.agentId),
        count: 0,
      }
    }
    counts[pick.agentId].count++
  }
  
  return Object.values(counts)
    .map(({ agentId, agentName, count }) => ({
      agentId,
      agentName,
      count,
      totalGames,
      percentage: totalGames > 0 ? (count / totalGames) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count)
}

/**
 * Analyze agent picks for a single team
 */
function analyzeTeamAgentPicks(
  teamId: string,
  teamName: string,
  games: ValorantGame[]
): TeamAgentAnalysis {
  // Collect all agent picks by this team across all games
  const allPicks: { agentId: string; agentName: string }[] = []
  const picksByMap: { [mapId: string]: { agentId: string; agentName: string }[] } = {}
  const picksByPlayer: { [playerId: string]: { playerName: string; picks: { agentId: string; agentName: string }[] } } = {}
  const gamesByMap: { [mapId: string]: number } = {}
  
  for (const game of games) {
    const mapId = game.mapId
    
    // Track games per map
    gamesByMap[mapId] = (gamesByMap[mapId] || 0) + 1
    
    // Initialize map picks array if needed
    if (!picksByMap[mapId]) {
      picksByMap[mapId] = []
    }
    
    // Get players from this team in this game
    const teamPlayers = game.players.filter(p => p.teamId === teamId)
    
    for (const player of teamPlayers) {
      const pickData = {
        agentId: player.characterId,
        agentName: player.characterName,
      }
      
      // Add to overall picks
      allPicks.push(pickData)
      
      // Add to map-specific picks
      picksByMap[mapId].push(pickData)
      
      // Add to player-specific picks
      if (!picksByPlayer[player.id]) {
        picksByPlayer[player.id] = {
          playerName: player.name,
          picks: [],
        }
      }
      picksByPlayer[player.id].picks.push(pickData)
    }
  }
  
  const totalMapsPlayed = games.length
  
  // Calculate overall frequencies
  const overallAgentPicks = calculateAgentFrequencies(allPicks, totalMapsPlayed)
  
  // Calculate per-map frequencies
  const agentPicksByMap: MapAgentPicks[] = Object.entries(picksByMap)
    .map(([mapId, picks]) => ({
      mapId,
      mapName: formatMapName(mapId),
      gamesPlayed: gamesByMap[mapId],
      agentPicks: calculateAgentFrequencies(picks, gamesByMap[mapId]),
    }))
    .sort((a, b) => b.gamesPlayed - a.gamesPlayed)
  
  // Calculate per-player agent preferences
  const playerAgentPreferences = Object.entries(picksByPlayer)
    .map(([playerId, data]) => ({
      playerId,
      playerName: data.playerName,
      agentPicks: calculateAgentFrequencies(data.picks, data.picks.length),
    }))
    .sort((a, b) => a.playerName.localeCompare(b.playerName))
  
  return {
    teamId,
    teamName,
    totalMapsPlayed,
    overallAgentPicks,
    agentPicksByMap,
    playerAgentPreferences,
  }
}

/**
 * Agent Pick Analysis
 * 
 * Analyzes team agent pick patterns in Valorant:
 * - Overall agent pick rates per team (e.g., "C9 picks Omen 90% of the time")
 * - Per-map agent pick rates (e.g., "C9 picks Omen 80% on Haven")
 * - Per-player agent preferences
 * 
 * In Valorant, all players pick agents simultaneously before each map,
 * so we analyze which agents each team tends to pick overall and on specific maps.
 */
export function agentPickAnalysis(series: ValorantStreamlinedSeries): ValorantAnalyticsResult | null {
  if (series.teams.length < 2 || series.games.length === 0) {
    return null
  }
  
  const teamAnalyses: TeamAgentAnalysis[] = []
  
  for (const team of series.teams) {
    const analysis = analyzeTeamAgentPicks(team.id, team.name, series.games)
    teamAnalyses.push(analysis)
  }
  
  const result: AgentPickAnalysisData = {
    totalGames: series.games.length,
    teams: teamAnalyses,
  }
  
  return {
    name: 'agentPickAnalysis',
    description: 'Analysis of agent pick patterns per team, overall and by map',
    data: result,
    generatedAt: new Date().toISOString(),
  }
}
