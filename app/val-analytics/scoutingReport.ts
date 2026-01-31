import { ValorantAnalyticsOutput } from './types'

/**
 * Map frequency statistics
 */
interface MapFrequency {
  mapId: string
  mapName: string
  count: number
  available: number
  percentage: number
}

/**
 * Agent frequency statistics
 */
interface AgentFrequency {
  agentId: string
  agentName: string
  count: number
  totalGames: number
  percentage: number
}

/**
 * Map-specific agent picks
 */
interface MapAgentStats {
  mapId: string
  mapName: string
  gamesPlayed: number
  agentPicks: AgentFrequency[]
}

/**
 * Aggregated Valorant scouting report data across multiple series
 */
export interface ValorantScoutingReport {
  teamId: string
  teamName: string
  seriesAnalyzed: number
  mapsPlayed: number
  generatedAt: string
  
  // Map Veto Analysis
  mapVetoStats: {
    // Ban phase 1 - maps banned first
    banPhase1: {
      ban1: MapFrequency[] // First ban patterns
      ban2: MapFrequency[] // Second ban patterns
      allBans: MapFrequency[] // All phase 1 bans combined
    }
    
    // Map picks - which maps they pick when open
    mapPicks: {
      pick1: MapFrequency[] // First pick patterns
      pick2: MapFrequency[] // Second pick patterns
      allPicks: MapFrequency[] // All picks combined
    }
    
    // Ban phase 2 (if exists in some series)
    banPhase2: {
      allBans: MapFrequency[]
    } | null
    
    // Decider maps (auto-selected)
    deciderMaps: MapFrequency[]
  } | null
  
  // Agent Pick Analysis
  agentStats: {
    // Overall agent picks across all maps
    overallPicks: AgentFrequency[]
    
    // Agent picks broken down by map
    picksByMap: MapAgentStats[]
    
    // Per-player agent preferences
    playerPreferences: {
      playerId: string
      playerName: string
      totalMapsPlayed: number
      agentPicks: AgentFrequency[]
    }[]
  } | null
  
  // Series breakdown for detailed view
  seriesBreakdown: {
    seriesId: string
    opponent: string
    date: string
    mapsPlayed: number
    mapVeto: {
      sequenceNumber: number
      action: 'ban' | 'pick' | 'decider'
      mapId: string
      teamId: string | null
      teamName: string | null
      isOurTeam: boolean
    }[]
    games: {
      gameNumber: number
      mapId: string
      winnerTeamId: string | null
      isWin: boolean
      ourAgents: { playerId: string; playerName: string; agentId: string; agentName: string }[]
    }[]
  }[]
}

/**
 * Format map name for display
 */
function formatMapName(mapId: string): string {
  return mapId.charAt(0).toUpperCase() + mapId.slice(1)
}

/**
 * Helper to calculate average
 */
function average(nums: number[]): number {
  if (nums.length === 0) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

/**
 * Helper to collect analytics data of a specific type from multiple series
 */
function collectAnalyticsData(
  results: { analytics: ValorantAnalyticsOutput }[],
  analyticsName: string
): any[] {
  const collected: any[] = []
  
  for (const result of results) {
    const analytics = result.analytics.results.find(r => r.name === analyticsName)
    if (analytics?.data) {
      collected.push(analytics.data)
    }
  }
  
  return collected
}

/**
 * Calculate map frequencies from arrays of map IDs
 */
function calculateMapFrequencies(mapIds: string[], totalOpportunities: number): MapFrequency[] {
  const counts: { [key: string]: number } = {}
  
  for (const mapId of mapIds) {
    counts[mapId] = (counts[mapId] || 0) + 1
  }
  
  return Object.entries(counts)
    .map(([mapId, count]) => ({
      mapId,
      mapName: formatMapName(mapId),
      count,
      available: totalOpportunities,
      percentage: totalOpportunities > 0 ? (count / totalOpportunities) * 100 : 0,
    }))
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 10)
}

/**
 * Calculate agent frequencies
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
        agentName: pick.agentName,
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
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 15)
}

/**
 * Aggregate analytics from multiple series into a Valorant scouting report
 */
export function aggregateValorantScoutingReport(
  teamId: string,
  teamName: string,
  analyticsResults: { seriesId: string; analytics: ValorantAnalyticsOutput; opponent: string; date: string }[]
): ValorantScoutingReport {
  // Count total maps played
  let totalMapsPlayed = 0
  
  // Series breakdown
  const seriesBreakdown: ValorantScoutingReport['seriesBreakdown'] = []
  
  // Collect map veto data
  const allBanPhase1_Ban1: string[] = []
  const allBanPhase1_Ban2: string[] = []
  const allBanPhase1_All: string[] = []
  const allPicks_Pick1: string[] = []
  const allPicks_Pick2: string[] = []
  const allPicks_All: string[] = []
  const allBanPhase2: string[] = []
  const allDeciders: string[] = []
  let seriesWithBanPhase2 = 0
  
  // Collect agent pick data
  const allAgentPicks: { agentId: string; agentName: string }[] = []
  const agentPicksByMap: { [mapId: string]: { agentId: string; agentName: string }[] } = {}
  const gamesByMap: { [mapId: string]: number } = {}
  const playerPicks: { [playerId: string]: { playerName: string; picks: { agentId: string; agentName: string }[]; games: number } } = {}
  
  // Process each series' analytics
  for (const result of analyticsResults) {
    // Get map veto data
    const mapVetoData = collectAnalyticsData([result], 'mapVetoAnalysis')
    
    for (const data of mapVetoData) {
      const ourTeamData = data.teams?.find((t: any) => t.teamId === teamId)
      
      if (ourTeamData) {
        // Ban phase 1
        const sequences = ourTeamData.vetoSequences || []
        for (const seq of sequences) {
          if (seq.banPhase1Actions?.[0]) {
            allBanPhase1_Ban1.push(seq.banPhase1Actions[0].mapId)
          }
          if (seq.banPhase1Actions?.[1]) {
            allBanPhase1_Ban2.push(seq.banPhase1Actions[1].mapId)
          }
          for (const action of seq.banPhase1Actions || []) {
            allBanPhase1_All.push(action.mapId)
          }
          
          // Picks
          if (seq.pickActions?.[0]) {
            allPicks_Pick1.push(seq.pickActions[0].mapId)
          }
          if (seq.pickActions?.[1]) {
            allPicks_Pick2.push(seq.pickActions[1].mapId)
          }
          for (const action of seq.pickActions || []) {
            allPicks_All.push(action.mapId)
          }
          
          // Ban phase 2
          if (seq.banPhase2Actions?.length > 0) {
            seriesWithBanPhase2++
            for (const action of seq.banPhase2Actions) {
              allBanPhase2.push(action.mapId)
            }
          }
          
          // Decider
          if (seq.deciderMap) {
            allDeciders.push(seq.deciderMap)
          }
        }
      }
    }
    
    // Get agent pick data
    const agentData = collectAnalyticsData([result], 'agentPickAnalysis')
    
    for (const data of agentData) {
      const ourTeamData = data.teams?.find((t: any) => t.teamId === teamId)
      
      if (ourTeamData) {
        totalMapsPlayed += ourTeamData.totalMapsPlayed || 0
        
        // Collect overall picks
        for (const mapPicks of ourTeamData.agentPicksByMap || []) {
          const mapId = mapPicks.mapId
          if (!agentPicksByMap[mapId]) {
            agentPicksByMap[mapId] = []
            gamesByMap[mapId] = 0
          }
          gamesByMap[mapId] += mapPicks.gamesPlayed
          
          // Re-calculate from frequencies
          for (const freq of mapPicks.agentPicks || []) {
            for (let i = 0; i < freq.count; i++) {
              agentPicksByMap[mapId].push({
                agentId: freq.agentId,
                agentName: freq.agentName,
              })
              allAgentPicks.push({
                agentId: freq.agentId,
                agentName: freq.agentName,
              })
            }
          }
        }
        
        // Collect player preferences
        for (const player of ourTeamData.playerAgentPreferences || []) {
          if (!playerPicks[player.playerId]) {
            playerPicks[player.playerId] = {
              playerName: player.playerName,
              picks: [],
              games: 0,
            }
          }
          
          for (const freq of player.agentPicks || []) {
            for (let i = 0; i < freq.count; i++) {
              playerPicks[player.playerId].picks.push({
                agentId: freq.agentId,
                agentName: freq.agentName,
              })
            }
          }
          playerPicks[player.playerId].games += player.agentPicks?.reduce((sum: number, f: any) => sum + f.count, 0) || 0
        }
      }
    }
    
    // Build series breakdown (need to get raw series data)
    // For now, we'll extract what we can from analytics
    const seriesInfo: ValorantScoutingReport['seriesBreakdown'][0] = {
      seriesId: result.seriesId,
      opponent: result.opponent,
      date: result.date,
      mapsPlayed: 0,
      mapVeto: [],
      games: [],
    }
    
    // Get map veto for breakdown
    for (const data of mapVetoData) {
      const ourTeamData = data.teams?.find((t: any) => t.teamId === teamId)
      const enemyTeamData = data.teams?.find((t: any) => t.teamId !== teamId)
      
      if (ourTeamData?.vetoSequences?.[0]) {
        const seq = ourTeamData.vetoSequences[0]
        
        // Combine all actions and sort by sequence
        const allActions: any[] = [
          ...(seq.banPhase1Actions || []).map((a: any) => ({ ...a, isOurTeam: true })),
          ...(seq.pickActions || []).map((a: any) => ({ ...a, isOurTeam: true })),
          ...(seq.banPhase2Actions || []).map((a: any) => ({ ...a, isOurTeam: true })),
        ]
        
        // Get enemy actions too
        if (enemyTeamData?.vetoSequences?.[0]) {
          const enemySeq = enemyTeamData.vetoSequences[0]
          allActions.push(
            ...(enemySeq.banPhase1Actions || []).map((a: any) => ({ ...a, isOurTeam: false })),
            ...(enemySeq.pickActions || []).map((a: any) => ({ ...a, isOurTeam: false })),
            ...(enemySeq.banPhase2Actions || []).map((a: any) => ({ ...a, isOurTeam: false })),
          )
        }
        
        // Add decider if exists
        if (seq.deciderMap) {
          allActions.push({
            sequenceNumber: 999,
            action: 'decider',
            mapId: seq.deciderMap,
            teamId: null,
            teamName: null,
            isOurTeam: false,
          })
        }
        
        // Sort by sequence number
        allActions.sort((a, b) => (a.sequenceNumber || 0) - (b.sequenceNumber || 0))
        
        seriesInfo.mapVeto = allActions.map((a, idx) => ({
          sequenceNumber: idx + 1,
          action: a.action,
          mapId: a.mapId,
          teamId: a.teamId,
          teamName: a.teamName,
          isOurTeam: a.isOurTeam,
        }))
      }
    }
    
    // Get game data for breakdown
    for (const data of agentData) {
      const ourTeamData = data.teams?.find((t: any) => t.teamId === teamId)
      
      if (ourTeamData) {
        seriesInfo.mapsPlayed = ourTeamData.totalMapsPlayed || 0
        
        // Reconstruct games from map data
        for (const mapPicks of ourTeamData.agentPicksByMap || []) {
          // This is an approximation since we don't have full game data in analytics
          seriesInfo.games.push({
            gameNumber: seriesInfo.games.length + 1,
            mapId: mapPicks.mapId,
            winnerTeamId: null, // Not available in analytics
            isWin: false, // Not available
            ourAgents: (mapPicks.agentPicks || []).map((p: any) => ({
              playerId: '',
              playerName: '',
              agentId: p.agentId,
              agentName: p.agentName,
            })),
          })
        }
      }
    }
    
    seriesBreakdown.push(seriesInfo)
  }
  
  const totalSeries = analyticsResults.length
  
  // Build the scouting report
  const report: ValorantScoutingReport = {
    teamId,
    teamName,
    seriesAnalyzed: totalSeries,
    mapsPlayed: totalMapsPlayed,
    generatedAt: new Date().toISOString(),
    
    // Map Veto Stats
    mapVetoStats: totalSeries > 0 ? {
      banPhase1: {
        ban1: calculateMapFrequencies(allBanPhase1_Ban1, totalSeries),
        ban2: calculateMapFrequencies(allBanPhase1_Ban2, totalSeries),
        allBans: calculateMapFrequencies(allBanPhase1_All, totalSeries),
      },
      mapPicks: {
        pick1: calculateMapFrequencies(allPicks_Pick1, totalSeries),
        pick2: calculateMapFrequencies(allPicks_Pick2, totalSeries),
        allPicks: calculateMapFrequencies(allPicks_All, totalSeries),
      },
      banPhase2: seriesWithBanPhase2 > 0 ? {
        allBans: calculateMapFrequencies(allBanPhase2, seriesWithBanPhase2),
      } : null,
      deciderMaps: calculateMapFrequencies(allDeciders, allDeciders.length),
    } : null,
    
    // Agent Stats
    agentStats: totalMapsPlayed > 0 ? {
      overallPicks: calculateAgentFrequencies(allAgentPicks, totalMapsPlayed),
      picksByMap: Object.entries(agentPicksByMap)
        .map(([mapId, picks]) => ({
          mapId,
          mapName: formatMapName(mapId),
          gamesPlayed: gamesByMap[mapId] || 0,
          agentPicks: calculateAgentFrequencies(picks, gamesByMap[mapId] || 1),
        }))
        .sort((a, b) => b.gamesPlayed - a.gamesPlayed),
      playerPreferences: Object.entries(playerPicks)
        .map(([playerId, data]) => ({
          playerId,
          playerName: data.playerName,
          totalMapsPlayed: data.games,
          agentPicks: calculateAgentFrequencies(data.picks, data.games),
        }))
        .sort((a, b) => a.playerName.localeCompare(b.playerName)),
    } : null,
    
    seriesBreakdown,
  }
  
  return report
}
