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
 * Agent frequency statistics with win tracking
 */
interface AgentFrequency {
  agentId: string
  agentName: string
  count: number
  totalGames: number
  percentage: number
  wins: number
  winPercentage: number
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
 * Defensive formation frequency
 */
interface DefensiveFormationFrequency {
  formationKey: string
  superRegions: { [superRegionName: string]: number }
  count: number
  percentage: number
}

/**
 * Map-specific defensive setups
 */
interface MapDefensiveStats {
  mapId: string
  mapName: string
  totalRounds: number
  formations: DefensiveFormationFrequency[]
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
      wins: number
      winPercentage: number
      agentPicks: AgentFrequency[]
    }[]
  } | null
  
  // Defensive Setup Analysis
  defensiveSetups: {
    totalDefensiveRounds: number
    byMap: MapDefensiveStats[]
  } | null
  
  // Offensive Setup Analysis
  offensiveSetups: {
    totalOffensiveRounds: number
    byMap: MapDefensiveStats[] // Same structure as defensive
  } | null
  
  // Economy-Based Setups
  economySetups: {
    defensive: {
      buy: { totalRounds: number; byMap: MapDefensiveStats[] }
      eco: { totalRounds: number; byMap: MapDefensiveStats[] }
    }
    offensive: {
      buy: { totalRounds: number; byMap: MapDefensiveStats[] }
      eco: { totalRounds: number; byMap: MapDefensiveStats[] }
    }
  } | null
  
  // Player Position Analysis
  playerPositions: {
    byMap: {
      mapId: string
      mapName: string
      players: {
        playerId: string
        playerName: string
        totalRounds: number
        clusters: {
          centroidX: number
          centroidY: number
          callout: string
          superRegion: string
          count: number
          percentage: number
          positions: { x: number; y: number }[]
        }[]
      }[]
    }[]
  } | null
  
  // Lurker Analysis
  lurkerStats: {
    byMap: {
      mapId: string
      mapName: string
      totalAttackRounds: number
      players: {
        playerId: string
        playerName: string
        totalAttackRounds: number
        lurkCount: number
        lurkPercentage: number
        byPushSite: {
          pushSite: string
          lurkLocations: {
            superRegion: string
            count: number
            percentage: number
          }[]
        }[]
      }[]
    }[]
  } | null
  
  // Ability Usage Analysis
  abilityUsage: {
    defensive: {
      mapId: string
      mapName: string
      players: {
        playerId: string
        playerName: string
        totalRounds: number
        clusters: {
          centroidX: number
          centroidY: number
          callout: string
          superRegion: string
          abilityId: string
          agentName: string
          count: number
          percentage: number
          positions: { x: number; y: number }[]
        }[]
      }[]
    }[]
    offensive: {
      mapId: string
      mapName: string
      players: {
        playerId: string
        playerName: string
        totalRounds: number
        clusters: {
          centroidX: number
          centroidY: number
          callout: string
          superRegion: string
          abilityId: string
          agentName: string
          count: number
          percentage: number
          positions: { x: number; y: number }[]
        }[]
      }[]
    }[]
  } | null
  
  // Post-Plant Position Analysis (split by plant site A/B/C)
  postPlant: {
    byMap: {
      mapId: string
      mapName: string
      totalPlantsOnMap: number
      bySite: {
        site: string
        totalPlants: number
        players: {
          playerId: string
          playerName: string
          totalPlants: number
          clusters: {
            centroidX: number
            centroidY: number
            callout: string
            superRegion: string
            count: number
            percentage: number
            positions: { x: number; y: number }[]
          }[]
        }[]
      }[]
    }[]
  } | null
  
  // Post-Plant Ability Usage Analysis
  postPlantAbility: {
    byMap: {
      mapId: string
      mapName: string
      totalPlants: number
      players: {
        playerId: string
        playerName: string
        totalPlants: number
        clusters: {
          centroidX: number
          centroidY: number
          callout: string
          superRegion: string
          abilityId: string
          agentName: string
          count: number
          percentage: number
          positions: { x: number; y: number }[]
        }[]
      }[]
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
      ourAgents: {
        playerId: string
        playerName: string
        agentId: string
        agentName: string
        kills: number
        deaths: number
        attackerKills: number
        attackerDeaths: number
        defenderKills: number
        defenderDeaths: number
      }[]
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
 * Calculate "pick when available %" - percentage of times a map was picked when not banned
 */
function calculatePickWhenAvailableFrequencies(
  availability: { [mapId: string]: { available: number; picked: number } }
): MapFrequency[] {
  return Object.entries(availability)
    .filter(([_, stats]) => stats.available > 0) // Only include maps that were available at least once
    .map(([mapId, stats]) => ({
      mapId,
      mapName: formatMapName(mapId),
      count: stats.picked,
      available: stats.available,
      percentage: stats.available > 0 ? (stats.picked / stats.available) * 100 : 0,
    }))
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 10)
}

/**
 * Calculate "first ban when available %" - percentage of times a map was first-banned when not already banned by opponent
 */
function calculateFirstBanWhenAvailableFrequencies(
  availability: { [mapId: string]: { available: number; banned: number } }
): MapFrequency[] {
  return Object.entries(availability)
    .filter(([_, stats]) => stats.available > 0) // Only include maps that were available at least once
    .map(([mapId, stats]) => ({
      mapId,
      mapName: formatMapName(mapId),
      count: stats.banned,
      available: stats.available,
      percentage: stats.available > 0 ? (stats.banned / stats.available) * 100 : 0,
    }))
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 10)
}

/**
 * Calculate agent frequencies (with win tracking)
 */
function calculateAgentFrequencies(
  picks: { agentId: string; agentName: string; isWin?: boolean }[],
  totalGames: number
): AgentFrequency[] {
  const counts: { [key: string]: { agentId: string; agentName: string; count: number; wins: number } } = {}
  
  for (const pick of picks) {
    if (!counts[pick.agentId]) {
      counts[pick.agentId] = {
        agentId: pick.agentId,
        agentName: pick.agentName,
        count: 0,
        wins: 0,
      }
    }
    counts[pick.agentId].count++
    if (pick.isWin) {
      counts[pick.agentId].wins++
    }
  }
  
  return Object.values(counts)
    .map(({ agentId, agentName, count, wins }) => ({
      agentId,
      agentName,
      count,
      totalGames,
      percentage: totalGames > 0 ? (count / totalGames) * 100 : 0,
      wins,
      winPercentage: count > 0 ? (wins / count) * 100 : 0,
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
  
  // Track map availability for "pick when available %" calculation
  // For each map: { available: number (times not banned before our pick), picked: number }
  const mapPickAvailability: { [mapId: string]: { available: number; picked: number } } = {}
  
  // Track map availability for "first ban when available %" calculation
  // For each map: { available: number (times not banned by opponent before our first ban), banned: number }
  const mapFirstBanAvailability: { [mapId: string]: { available: number; banned: number } } = {}
  
  // Collect agent pick data (with win tracking per agent)
  const allAgentPicks: { agentId: string; agentName: string; isWin: boolean }[] = []
  const agentPicksByMap: { [mapId: string]: { agentId: string; agentName: string; isWin: boolean }[] } = {}
  const gamesByMap: { [mapId: string]: number } = {}
  const playerPicks: { [playerId: string]: { playerName: string; picks: { agentId: string; agentName: string; isWin: boolean }[]; games: number; wins: number } } = {}
  
  // Collect defensive setup data
  // For each map, track formation counts: { formationKey: { superRegions: {...}, count: number } }
  const defensiveFormationsByMap: { [mapId: string]: { [formationKey: string]: { superRegions: { [name: string]: number }; count: number } } } = {}
  const defensiveRoundsByMap: { [mapId: string]: number } = {}
  let totalDefensiveRounds = 0
  
  // Collect offensive setup data
  const offensiveFormationsByMap: { [mapId: string]: { [formationKey: string]: { superRegions: { [name: string]: number }; count: number } } } = {}
  const offensiveRoundsByMap: { [mapId: string]: number } = {}
  let totalOffensiveRounds = 0
  
  // Collect economy-based setup data
  type EconomyMapData = { [mapId: string]: { [formationKey: string]: { superRegions: { [name: string]: number }; count: number } } }
  const economyData = {
    defensive: { buy: {} as EconomyMapData, eco: {} as EconomyMapData },
    offensive: { buy: {} as EconomyMapData, eco: {} as EconomyMapData },
  }
  const economyRounds = {
    defensive: { buy: {} as { [mapId: string]: number }, eco: {} as { [mapId: string]: number } },
    offensive: { buy: {} as { [mapId: string]: number }, eco: {} as { [mapId: string]: number } },
  }
  let totalEconomyRounds = {
    defensive: { buy: 0, eco: 0 },
    offensive: { buy: 0, eco: 0 },
  }
  
  // Collect player position data
  // map -> player -> clusters[]
  type PlayerCluster = { centroidX: number; centroidY: number; callout: string; superRegion: string; count: number; positions: { x: number; y: number }[] }
  const playerPositionsByMap: {
    [mapId: string]: {
      [playerId: string]: {
        playerName: string
        totalRounds: number
        clusters: PlayerCluster[]
      }
    }
  } = {}
  
  // Collect lurker data
  // map -> player -> { totalAttackRounds, lurkCount, byPushSite }
  type LurkLocationData = { superRegion: string; count: number }
  type PushSiteData = { [lurkRegion: string]: number }
  const lurkerStatsByMap: {
    [mapId: string]: {
      totalAttackRounds: number
      players: {
        [playerId: string]: {
          playerName: string
          totalAttackRounds: number
          lurkCount: number
          byPushSite: { [pushSite: string]: PushSiteData }
        }
      }
    }
  } = {}
  
  // Collect ability usage data (defensive and offensive separately)
  // map -> player -> clusters[]
  type AbilityClusterData = { centroidX: number; centroidY: number; callout: string; superRegion: string; abilityId: string; agentName: string; count: number; positions: { x: number; y: number }[] }
  type AbilityMapData = {
    [mapId: string]: {
      [playerId: string]: {
        playerName: string
        totalRounds: number
        clusters: AbilityClusterData[]
      }
    }
  }
  const defensiveAbilityByMap: AbilityMapData = {}
  const offensiveAbilityByMap: AbilityMapData = {}
  
  // Collect post-plant ability data
  type PostPlantAbilityClusterData = { centroidX: number; centroidY: number; callout: string; superRegion: string; abilityId: string; agentName: string; count: number; positions: { x: number; y: number }[] }
  const postPlantAbilityByMap: {
    [mapId: string]: {
      totalPlants: number
      players: {
        [playerId: string]: {
          playerName: string
          totalPlants: number
          clusters: PostPlantAbilityClusterData[]
        }
      }
    }
  } = {}
  
  // Collect post-plant data (by site)
  // map -> site -> player -> clusters[]
  type PostPlantClusterData = { centroidX: number; centroidY: number; callout: string; superRegion: string; count: number; positions: { x: number; y: number }[] }
  const postPlantByMap: {
    [mapId: string]: {
      totalPlants: number
      bySite: {
        [site: string]: {
          totalPlants: number
          players: {
            [playerId: string]: {
              playerName: string
              totalPlants: number
              clusters: PostPlantClusterData[]
            }
          }
        }
      }
    }
  } = {}
  
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
          
          // Track first ban availability for "first ban when available %" calculation
          // Get opponent bans that occurred before our first ban
          const opponentBansBeforeOurs = new Set(seq.opponentBansBeforeOurFirstBan || [])
          const ourFirstBan = seq.banPhase1Actions?.[0]?.mapId
          
          // Get all maps we've seen in veto to track availability
          const allMapsForBanAvailability = new Set<string>()
          for (const action of seq.banPhase1Actions || []) {
            allMapsForBanAvailability.add(action.mapId)
          }
          for (const action of seq.pickActions || []) {
            allMapsForBanAvailability.add(action.mapId)
          }
          for (const action of seq.banPhase2Actions || []) {
            allMapsForBanAvailability.add(action.mapId)
          }
          if (seq.deciderMap) {
            allMapsForBanAvailability.add(seq.deciderMap)
          }
          for (const mapId of opponentBansBeforeOurs) {
            allMapsForBanAvailability.add(mapId)
          }
          
          // For each known map, track if it was available for our first ban
          for (const mapId of Array.from(allMapsForBanAvailability)) {
            if (!mapFirstBanAvailability[mapId]) {
              mapFirstBanAvailability[mapId] = { available: 0, banned: 0 }
            }
            
            // Map is available if opponent didn't ban it before our first ban
            if (!opponentBansBeforeOurs.has(mapId)) {
              mapFirstBanAvailability[mapId].available++
              
              // Check if we banned it as our first ban
              if (ourFirstBan === mapId) {
                mapFirstBanAvailability[mapId].banned++
              }
            }
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
          
          // Track map availability for "pick when available %" calculation
          // Get all maps that were banned before our pick (by both teams)
          const bannedMaps = new Set(seq.allBansBeforeOurPick || [])
          const ourPicks = (seq.pickActions || []).map((a: any) => a.mapId)
          
          // Standard Valorant map pool (we'll use the maps we've seen)
          const allMapsInVeto = new Set<string>()
          for (const action of seq.banPhase1Actions || []) {
            allMapsInVeto.add(action.mapId)
          }
          for (const action of seq.pickActions || []) {
            allMapsInVeto.add(action.mapId)
          }
          for (const action of seq.banPhase2Actions || []) {
            allMapsInVeto.add(action.mapId)
          }
          if (seq.deciderMap) {
            allMapsInVeto.add(seq.deciderMap)
          }
          // Also add banned maps from allBansBeforeOurPick
          for (const mapId of bannedMaps) {
            allMapsInVeto.add(mapId)
          }
          
          // For each map we know about, track if it was available and if we picked it
          for (const mapId of allMapsInVeto) {
            if (!mapPickAvailability[mapId]) {
              mapPickAvailability[mapId] = { available: 0, picked: 0 }
            }
            
            // Map is available if it wasn't banned before our pick
            if (!bannedMaps.has(mapId)) {
              mapPickAvailability[mapId].available++
              
              // Check if we picked it
              if (ourPicks.includes(mapId)) {
                mapPickAvailability[mapId].picked++
              }
            }
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
              wins: 0,
            }
          }
          
          for (const freq of player.agentPicks || []) {
            // Push win games first, then losses
            const wins = freq.wins || 0
            const losses = freq.count - wins
            for (let i = 0; i < wins; i++) {
              playerPicks[player.playerId].picks.push({
                agentId: freq.agentId,
                agentName: freq.agentName,
                isWin: true,
              })
            }
            for (let i = 0; i < losses; i++) {
              playerPicks[player.playerId].picks.push({
                agentId: freq.agentId,
                agentName: freq.agentName,
                isWin: false,
              })
            }
          }
          playerPicks[player.playerId].games += player.gamesPlayed || 0
          playerPicks[player.playerId].wins += player.wins || 0
        }
      }
    }
    
    // Get defensive setup data
    const defensiveData = collectAnalyticsData([result], 'defensiveSetupAnalysis')
    
    for (const data of defensiveData) {
      const ourTeamData = data.teams?.find((t: any) => t.teamId === teamId)
      
      if (ourTeamData) {
        totalDefensiveRounds += ourTeamData.totalDefensiveRounds || 0
        
        // Aggregate formations by map
        for (const mapData of ourTeamData.byMap || []) {
          const mapId = mapData.mapId
          
          if (!defensiveFormationsByMap[mapId]) {
            defensiveFormationsByMap[mapId] = {}
            defensiveRoundsByMap[mapId] = 0
          }
          defensiveRoundsByMap[mapId] += mapData.totalRounds || 0
          
          for (const formation of mapData.formations || []) {
            const key = formation.formationKey
            if (!defensiveFormationsByMap[mapId][key]) {
              defensiveFormationsByMap[mapId][key] = {
                superRegions: formation.superRegions,
                count: 0,
              }
            }
            defensiveFormationsByMap[mapId][key].count += formation.count || 0
          }
        }
      }
    }
    
    // Get offensive setup data
    const offensiveData = collectAnalyticsData([result], 'offensiveSetupAnalysis')
    
    for (const data of offensiveData) {
      const ourTeamData = data.teams?.find((t: any) => t.teamId === teamId)
      
      if (ourTeamData) {
        totalOffensiveRounds += ourTeamData.totalOffensiveRounds || 0
        
        for (const mapData of ourTeamData.byMap || []) {
          const mapId = mapData.mapId
          
          if (!offensiveFormationsByMap[mapId]) {
            offensiveFormationsByMap[mapId] = {}
            offensiveRoundsByMap[mapId] = 0
          }
          offensiveRoundsByMap[mapId] += mapData.totalRounds || 0
          
          for (const formation of mapData.formations || []) {
            const key = formation.formationKey
            if (!offensiveFormationsByMap[mapId][key]) {
              offensiveFormationsByMap[mapId][key] = {
                superRegions: formation.superRegions,
                count: 0,
              }
            }
            offensiveFormationsByMap[mapId][key].count += formation.count || 0
          }
        }
      }
    }
    
    // Get economy setup data
    const economyAnalyticsData = collectAnalyticsData([result], 'economySetupAnalysis')
    
    for (const data of economyAnalyticsData) {
      const ourTeamData = data.teams?.find((t: any) => t.teamId === teamId)
      
      if (ourTeamData) {
        // Process defensive buy/eco
        for (const economyType of ['buy', 'eco'] as const) {
          const sideData = ourTeamData.defensive?.[economyType]
          if (sideData) {
            totalEconomyRounds.defensive[economyType] += sideData.totalRounds || 0
            
            for (const mapData of sideData.byMap || []) {
              const mapId = mapData.mapId
              
              if (!economyData.defensive[economyType][mapId]) {
                economyData.defensive[economyType][mapId] = {}
                economyRounds.defensive[economyType][mapId] = 0
              }
              economyRounds.defensive[economyType][mapId] += mapData.totalRounds || 0
              
              for (const formation of mapData.formations || []) {
                const key = formation.formationKey
                if (!economyData.defensive[economyType][mapId][key]) {
                  economyData.defensive[economyType][mapId][key] = {
                    superRegions: formation.superRegions,
                    count: 0,
                  }
                }
                economyData.defensive[economyType][mapId][key].count += formation.count || 0
              }
            }
          }
        }
        
        // Process offensive buy/eco
        for (const economyType of ['buy', 'eco'] as const) {
          const sideData = ourTeamData.offensive?.[economyType]
          if (sideData) {
            totalEconomyRounds.offensive[economyType] += sideData.totalRounds || 0
            
            for (const mapData of sideData.byMap || []) {
              const mapId = mapData.mapId
              
              if (!economyData.offensive[economyType][mapId]) {
                economyData.offensive[economyType][mapId] = {}
                economyRounds.offensive[economyType][mapId] = 0
              }
              economyRounds.offensive[economyType][mapId] += mapData.totalRounds || 0
              
              for (const formation of mapData.formations || []) {
                const key = formation.formationKey
                if (!economyData.offensive[economyType][mapId][key]) {
                  economyData.offensive[economyType][mapId][key] = {
                    superRegions: formation.superRegions,
                    count: 0,
                  }
                }
                economyData.offensive[economyType][mapId][key].count += formation.count || 0
              }
            }
          }
        }
      }
    }
    
    // Get player position data
    const playerPosData = collectAnalyticsData([result], 'playerPositionAnalysis')
    
    for (const data of playerPosData) {
      const ourTeamData = data.teams?.find((t: any) => t.teamId === teamId)
      
      if (ourTeamData) {
        for (const mapData of ourTeamData.byMap || []) {
          const mapId = mapData.mapId
          
          if (!playerPositionsByMap[mapId]) {
            playerPositionsByMap[mapId] = {}
          }
          
          for (const player of mapData.players || []) {
            if (!playerPositionsByMap[mapId][player.playerId]) {
              playerPositionsByMap[mapId][player.playerId] = {
                playerName: player.playerName,
                totalRounds: 0,
                clusters: [],
              }
            }
            
            playerPositionsByMap[mapId][player.playerId].totalRounds += player.totalRounds || 0
            
            // Merge clusters
            for (const cluster of player.clusters || []) {
              const existing = playerPositionsByMap[mapId][player.playerId].clusters.find(
                c => c.callout === cluster.callout
              )
              if (existing) {
                existing.count += cluster.count
                // Merge positions
                existing.positions = [...existing.positions, ...(cluster.positions || [])]
                // Recalculate centroid from all positions
                if (existing.positions.length > 0) {
                  existing.centroidX = existing.positions.reduce((sum, p) => sum + p.x, 0) / existing.positions.length
                  existing.centroidY = existing.positions.reduce((sum, p) => sum + p.y, 0) / existing.positions.length
                }
              } else {
                playerPositionsByMap[mapId][player.playerId].clusters.push({
                  centroidX: cluster.centroidX || 0,
                  centroidY: cluster.centroidY || 0,
                  callout: cluster.callout,
                  superRegion: cluster.superRegion,
                  count: cluster.count,
                  positions: cluster.positions || [],
                })
              }
            }
          }
        }
      }
    }
    
    // Get lurker analysis data
    const lurkerData = collectAnalyticsData([result], 'lurkerAnalysis')
    
    for (const data of lurkerData) {
      const ourTeamData = data.teams?.find((t: any) => t.teamId === teamId)
      
      if (ourTeamData) {
        for (const mapData of ourTeamData.byMap || []) {
          const mapId = mapData.mapId
          
          if (!lurkerStatsByMap[mapId]) {
            lurkerStatsByMap[mapId] = {
              totalAttackRounds: 0,
              players: {},
            }
          }
          
          lurkerStatsByMap[mapId].totalAttackRounds += mapData.totalAttackRounds || 0
          
          for (const player of mapData.players || []) {
            if (!lurkerStatsByMap[mapId].players[player.playerId]) {
              lurkerStatsByMap[mapId].players[player.playerId] = {
                playerName: player.playerName,
                totalAttackRounds: 0,
                lurkCount: 0,
                byPushSite: {},
              }
            }
            
            const playerData = lurkerStatsByMap[mapId].players[player.playerId]
            playerData.totalAttackRounds += player.totalAttackRounds || 0
            playerData.lurkCount += player.lurkCount || 0
            
// Merge byPushSite data
            for (const pushSiteData of player.byPushSite || []) {
              if (!playerData.byPushSite[pushSiteData.pushSite]) {
                playerData.byPushSite[pushSiteData.pushSite] = {}
              }
              
              for (const lurkLoc of pushSiteData.lurkLocations || []) {
                if (!playerData.byPushSite[pushSiteData.pushSite][lurkLoc.superRegion]) {
                  playerData.byPushSite[pushSiteData.pushSite][lurkLoc.superRegion] = 0
                }
                playerData.byPushSite[pushSiteData.pushSite][lurkLoc.superRegion] += lurkLoc.count
              }
            }
          }
        }
      }
    }
    
    // Get ability usage data
    const abilityData = collectAnalyticsData([result], 'abilityUsageAnalysis')
    
    const mergeAbilityClusters = (targetMap: AbilityMapData, mapDataList: any[]) => {
      for (const mapData of mapDataList || []) {
        const mapId = mapData.mapId
        
        if (!targetMap[mapId]) {
          targetMap[mapId] = {}
        }
        
        for (const player of mapData.players || []) {
          if (!targetMap[mapId][player.playerId]) {
            targetMap[mapId][player.playerId] = {
              playerName: player.playerName,
              totalRounds: 0,
              clusters: [],
            }
          }
          
          targetMap[mapId][player.playerId].totalRounds += player.totalRounds || 0
          
          for (const cluster of player.clusters || []) {
            const existing = targetMap[mapId][player.playerId].clusters.find(
              c => c.callout === cluster.callout && c.abilityId === cluster.abilityId && c.agentName === cluster.agentName
            )
            if (existing) {
              existing.count += cluster.count
              existing.positions = [...existing.positions, ...(cluster.positions || [])]
              if (existing.positions.length > 0) {
                existing.centroidX = existing.positions.reduce((sum, p) => sum + p.x, 0) / existing.positions.length
                existing.centroidY = existing.positions.reduce((sum, p) => sum + p.y, 0) / existing.positions.length
              }
            } else {
              targetMap[mapId][player.playerId].clusters.push({
                centroidX: cluster.centroidX || 0,
                centroidY: cluster.centroidY || 0,
                callout: cluster.callout,
                superRegion: cluster.superRegion,
                abilityId: cluster.abilityId,
                agentName: cluster.agentName || 'Unknown',
                count: cluster.count,
                positions: cluster.positions || [],
              })
            }
          }
        }
      }
    }
    
    for (const data of abilityData) {
      const ourTeamData = data.teams?.find((t: any) => t.teamId === teamId)
      
      if (ourTeamData) {
        mergeAbilityClusters(defensiveAbilityByMap, ourTeamData.defensive || [])
        mergeAbilityClusters(offensiveAbilityByMap, ourTeamData.offensive || [])
      }
    }
    
    // Get post-plant ability data
    const postPlantAbilityData = collectAnalyticsData([result], 'postPlantAbilityAnalysis')
    
    for (const data of postPlantAbilityData) {
      const ourTeamData = data.teams?.find((t: any) => t.teamId === teamId)
      
      if (ourTeamData) {
        for (const mapData of ourTeamData.byMap || []) {
          const mapId = mapData.mapId
          
          if (!postPlantAbilityByMap[mapId]) {
            postPlantAbilityByMap[mapId] = {
              totalPlants: 0,
              players: {},
            }
          }
          
          postPlantAbilityByMap[mapId].totalPlants += mapData.totalPlants || 0
          
          for (const player of mapData.players || []) {
            if (!postPlantAbilityByMap[mapId].players[player.playerId]) {
              postPlantAbilityByMap[mapId].players[player.playerId] = {
                playerName: player.playerName,
                totalPlants: 0,
                clusters: [],
              }
            }
            
            postPlantAbilityByMap[mapId].players[player.playerId].totalPlants += player.totalPlants || 0
            
            for (const cluster of player.clusters || []) {
              const existing = postPlantAbilityByMap[mapId].players[player.playerId].clusters.find(
                c => c.callout === cluster.callout && c.abilityId === cluster.abilityId && c.agentName === cluster.agentName
              )
              if (existing) {
                existing.count += cluster.count
                existing.positions = [...existing.positions, ...(cluster.positions || [])]
                if (existing.positions.length > 0) {
                  existing.centroidX = existing.positions.reduce((sum, p) => sum + p.x, 0) / existing.positions.length
                  existing.centroidY = existing.positions.reduce((sum, p) => sum + p.y, 0) / existing.positions.length
                }
              } else {
                postPlantAbilityByMap[mapId].players[player.playerId].clusters.push({
                  centroidX: cluster.centroidX || 0,
                  centroidY: cluster.centroidY || 0,
                  callout: cluster.callout,
                  superRegion: cluster.superRegion,
                  abilityId: cluster.abilityId,
                  agentName: cluster.agentName || 'Unknown',
                  count: cluster.count,
                  positions: cluster.positions || [],
                })
              }
            }
          }
        }
      }
    }
    
    // Get post-plant data (by site)
    const postPlantData = collectAnalyticsData([result], 'postPlantAnalysis')
    
    for (const data of postPlantData) {
      const ourTeamData = data.teams?.find((t: any) => t.teamId === teamId)
      
      if (ourTeamData) {
        for (const mapData of ourTeamData.byMap || []) {
          const mapId = mapData.mapId
          
          if (!postPlantByMap[mapId]) {
            postPlantByMap[mapId] = {
              totalPlants: 0,
              bySite: {},
            }
          }
          
          postPlantByMap[mapId].totalPlants += mapData.totalPlantsOnMap || 0
          
          for (const siteData of mapData.bySite || []) {
            const site = siteData.site
            
            if (!postPlantByMap[mapId].bySite[site]) {
              postPlantByMap[mapId].bySite[site] = {
                totalPlants: 0,
                players: {},
              }
            }
            
            postPlantByMap[mapId].bySite[site].totalPlants += siteData.totalPlants || 0
            
            for (const player of siteData.players || []) {
              if (!postPlantByMap[mapId].bySite[site].players[player.playerId]) {
                postPlantByMap[mapId].bySite[site].players[player.playerId] = {
                  playerName: player.playerName,
                  totalPlants: 0,
                  clusters: [],
                }
              }
              
              postPlantByMap[mapId].bySite[site].players[player.playerId].totalPlants += player.totalPlants || 0
              
              // Merge clusters
              for (const cluster of player.clusters || []) {
                const existing = postPlantByMap[mapId].bySite[site].players[player.playerId].clusters.find(
                  c => c.callout === cluster.callout
                )
                if (existing) {
                  existing.count += cluster.count
                  existing.positions = [...existing.positions, ...(cluster.positions || [])]
                  if (existing.positions.length > 0) {
                    existing.centroidX = existing.positions.reduce((sum, p) => sum + p.x, 0) / existing.positions.length
                    existing.centroidY = existing.positions.reduce((sum, p) => sum + p.y, 0) / existing.positions.length
                  }
                } else {
                  postPlantByMap[mapId].bySite[site].players[player.playerId].clusters.push({
                    centroidX: cluster.centroidX || 0,
                    centroidY: cluster.centroidY || 0,
                    callout: cluster.callout,
                    superRegion: cluster.superRegion,
                    count: cluster.count,
                    positions: cluster.positions || [],
                  })
                }
              }
            }
          }
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
        
        // Use detailed game data from analytics
        for (const gameDetail of ourTeamData.gameDetails || []) {
          seriesInfo.games.push({
            gameNumber: gameDetail.gameNumber,
            mapId: gameDetail.mapId,
            winnerTeamId: gameDetail.winnerTeamId,
            isWin: gameDetail.isWin,
            ourAgents: (gameDetail.playerStats || []).map((p: any) => ({
              playerId: p.playerId,
              playerName: p.playerName,
              agentId: p.agentId,
              agentName: p.agentName,
              kills: p.kills || 0,
              deaths: p.deaths || 0,
              attackerKills: p.attackerKills || 0,
              attackerDeaths: p.attackerDeaths || 0,
              defenderKills: p.defenderKills || 0,
              defenderDeaths: p.defenderDeaths || 0,
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
        ban1: calculateFirstBanWhenAvailableFrequencies(mapFirstBanAvailability),
        ban2: calculateMapFrequencies(allBanPhase1_Ban2, totalSeries),
        allBans: calculateMapFrequencies(allBanPhase1_All, totalSeries),
      },
      mapPicks: {
        pick1: calculateMapFrequencies(allPicks_Pick1, totalSeries),
        pick2: calculateMapFrequencies(allPicks_Pick2, totalSeries),
        allPicks: calculatePickWhenAvailableFrequencies(mapPickAvailability),
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
          wins: data.wins,
          winPercentage: data.games > 0 ? (data.wins / data.games) * 100 : 0,
          agentPicks: calculateAgentFrequencies(data.picks, data.games),
        }))
        .sort((a, b) => a.playerName.localeCompare(b.playerName)),
    } : null,
    
    // Defensive Setups
    defensiveSetups: totalDefensiveRounds > 0 ? {
      totalDefensiveRounds,
      byMap: Object.entries(defensiveFormationsByMap)
        .map(([mapId, formations]) => ({
          mapId,
          mapName: formatMapName(mapId),
          totalRounds: defensiveRoundsByMap[mapId] || 0,
          formations: Object.entries(formations)
            .map(([formationKey, data]) => ({
              formationKey,
              superRegions: data.superRegions,
              count: data.count,
              percentage: defensiveRoundsByMap[mapId] > 0 
                ? (data.count / defensiveRoundsByMap[mapId]) * 100 
                : 0,
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10), // Top 10 formations per map
        }))
        .sort((a, b) => b.totalRounds - a.totalRounds),
    } : null,
    
    // Offensive Setups
    offensiveSetups: totalOffensiveRounds > 0 ? {
      totalOffensiveRounds,
      byMap: Object.entries(offensiveFormationsByMap)
        .map(([mapId, formations]) => ({
          mapId,
          mapName: formatMapName(mapId),
          totalRounds: offensiveRoundsByMap[mapId] || 0,
          formations: Object.entries(formations)
            .map(([formationKey, data]) => ({
              formationKey,
              superRegions: data.superRegions,
              count: data.count,
              percentage: offensiveRoundsByMap[mapId] > 0 
                ? (data.count / offensiveRoundsByMap[mapId]) * 100 
                : 0,
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10), // Top 10 formations per map
        }))
        .sort((a, b) => b.totalRounds - a.totalRounds),
    } : null,
    
    // Economy-Based Setups
    economySetups: (totalEconomyRounds.defensive.buy > 0 || totalEconomyRounds.defensive.eco > 0 ||
                   totalEconomyRounds.offensive.buy > 0 || totalEconomyRounds.offensive.eco > 0) ? {
      defensive: {
        buy: {
          totalRounds: totalEconomyRounds.defensive.buy,
          byMap: Object.entries(economyData.defensive.buy)
            .map(([mapId, formations]) => ({
              mapId,
              mapName: formatMapName(mapId),
              totalRounds: economyRounds.defensive.buy[mapId] || 0,
              formations: Object.entries(formations)
                .map(([formationKey, data]) => ({
                  formationKey,
                  superRegions: data.superRegions,
                  count: data.count,
                  percentage: economyRounds.defensive.buy[mapId] > 0
                    ? (data.count / economyRounds.defensive.buy[mapId]) * 100
                    : 0,
                }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 10),
            }))
            .sort((a, b) => b.totalRounds - a.totalRounds),
        },
        eco: {
          totalRounds: totalEconomyRounds.defensive.eco,
          byMap: Object.entries(economyData.defensive.eco)
            .map(([mapId, formations]) => ({
              mapId,
              mapName: formatMapName(mapId),
              totalRounds: economyRounds.defensive.eco[mapId] || 0,
              formations: Object.entries(formations)
                .map(([formationKey, data]) => ({
                  formationKey,
                  superRegions: data.superRegions,
                  count: data.count,
                  percentage: economyRounds.defensive.eco[mapId] > 0
                    ? (data.count / economyRounds.defensive.eco[mapId]) * 100
                    : 0,
                }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 10),
            }))
            .sort((a, b) => b.totalRounds - a.totalRounds),
        },
      },
      offensive: {
        buy: {
          totalRounds: totalEconomyRounds.offensive.buy,
          byMap: Object.entries(economyData.offensive.buy)
            .map(([mapId, formations]) => ({
              mapId,
              mapName: formatMapName(mapId),
              totalRounds: economyRounds.offensive.buy[mapId] || 0,
              formations: Object.entries(formations)
                .map(([formationKey, data]) => ({
                  formationKey,
                  superRegions: data.superRegions,
                  count: data.count,
                  percentage: economyRounds.offensive.buy[mapId] > 0
                    ? (data.count / economyRounds.offensive.buy[mapId]) * 100
                    : 0,
                }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 10),
            }))
            .sort((a, b) => b.totalRounds - a.totalRounds),
        },
        eco: {
          totalRounds: totalEconomyRounds.offensive.eco,
          byMap: Object.entries(economyData.offensive.eco)
            .map(([mapId, formations]) => ({
              mapId,
              mapName: formatMapName(mapId),
              totalRounds: economyRounds.offensive.eco[mapId] || 0,
              formations: Object.entries(formations)
                .map(([formationKey, data]) => ({
                  formationKey,
                  superRegions: data.superRegions,
                  count: data.count,
                  percentage: economyRounds.offensive.eco[mapId] > 0
                    ? (data.count / economyRounds.offensive.eco[mapId]) * 100
                    : 0,
                }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 10),
            }))
            .sort((a, b) => b.totalRounds - a.totalRounds),
        },
      },
    } : null,
    
    // Player Positions
    playerPositions: Object.keys(playerPositionsByMap).length > 0 ? {
      byMap: Object.entries(playerPositionsByMap)
        .map(([mapId, players]) => ({
          mapId,
          mapName: formatMapName(mapId),
          players: Object.entries(players)
            .map(([playerId, data]) => ({
              playerId,
              playerName: data.playerName,
              totalRounds: data.totalRounds,
              clusters: data.clusters
                .map(c => ({
                  ...c,
                  percentage: data.totalRounds > 0 ? (c.count / data.totalRounds) * 100 : 0,
                }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5),
            }))
            .filter(p => p.clusters.length > 0)
            .sort((a, b) => a.playerName.localeCompare(b.playerName)),
        }))
        .filter(m => m.players.length > 0)
        .sort((a, b) => a.mapName.localeCompare(b.mapName)),
    } : null,
    
    // Lurker Stats
    lurkerStats: Object.keys(lurkerStatsByMap).length > 0 ? {
      byMap: Object.entries(lurkerStatsByMap)
        .map(([mapId, mapData]) => ({
          mapId,
          mapName: formatMapName(mapId),
          totalAttackRounds: mapData.totalAttackRounds,
          players: Object.entries(mapData.players)
            .map(([playerId, playerData]) => ({
              playerId,
              playerName: playerData.playerName,
              totalAttackRounds: playerData.totalAttackRounds,
              lurkCount: playerData.lurkCount,
              lurkPercentage: playerData.totalAttackRounds > 0 
                ? (playerData.lurkCount / playerData.totalAttackRounds) * 100 
                : 0,
              byPushSite: Object.entries(playerData.byPushSite)
                .map(([pushSite, lurkRegions]) => {
                  const totalForPush = Object.values(lurkRegions).reduce((a, b) => a + b, 0)
                  return {
                    pushSite,
                    lurkLocations: Object.entries(lurkRegions)
                      .map(([superRegion, count]) => ({
                        superRegion,
                        count,
                        percentage: totalForPush > 0 ? (count / totalForPush) * 100 : 0,
                      }))
                      .sort((a, b) => b.count - a.count),
                  }
                })
                .filter(ps => ps.lurkLocations.length > 0)
                .sort((a, b) => {
                  const totalA = a.lurkLocations.reduce((sum, l) => sum + l.count, 0)
                  const totalB = b.lurkLocations.reduce((sum, l) => sum + l.count, 0)
                  return totalB - totalA
                }),
            }))
            .filter(p => p.lurkCount > 0)
            .sort((a, b) => b.lurkPercentage - a.lurkPercentage),
        }))
        .filter(m => m.players.length > 0)
        .sort((a, b) => a.mapName.localeCompare(b.mapName)),
    } : null,
    
    // Ability Usage
    abilityUsage: (Object.keys(defensiveAbilityByMap).length > 0 || Object.keys(offensiveAbilityByMap).length > 0) ? {
      defensive: Object.entries(defensiveAbilityByMap)
        .map(([mapId, players]) => ({
          mapId,
          mapName: formatMapName(mapId),
          players: Object.entries(players)
            .map(([playerId, data]) => ({
              playerId,
              playerName: data.playerName,
              totalRounds: data.totalRounds,
              clusters: data.clusters
                .map(c => ({
                  ...c,
                  percentage: data.totalRounds > 0 ? (c.count / data.totalRounds) * 100 : 0,
                }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 10),
            }))
            .filter(p => p.clusters.length > 0)
            .sort((a, b) => a.playerName.localeCompare(b.playerName)),
        }))
        .filter(m => m.players.length > 0)
        .sort((a, b) => a.mapName.localeCompare(b.mapName)),
      offensive: Object.entries(offensiveAbilityByMap)
        .map(([mapId, players]) => ({
          mapId,
          mapName: formatMapName(mapId),
          players: Object.entries(players)
            .map(([playerId, data]) => ({
              playerId,
              playerName: data.playerName,
              totalRounds: data.totalRounds,
              clusters: data.clusters
                .map(c => ({
                  ...c,
                  percentage: data.totalRounds > 0 ? (c.count / data.totalRounds) * 100 : 0,
                }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 10),
            }))
            .filter(p => p.clusters.length > 0)
            .sort((a, b) => a.playerName.localeCompare(b.playerName)),
        }))
        .filter(m => m.players.length > 0)
        .sort((a, b) => a.mapName.localeCompare(b.mapName)),
    } : null,
    
    // Post-Plant Positions (by site)
    postPlant: Object.keys(postPlantByMap).length > 0 ? {
      byMap: Object.entries(postPlantByMap)
        .map(([mapId, mapData]) => ({
          mapId,
          mapName: formatMapName(mapId),
          totalPlantsOnMap: mapData.totalPlants,
          bySite: Object.entries(mapData.bySite)
            .map(([site, siteData]) => ({
              site,
              totalPlants: siteData.totalPlants,
              players: Object.entries(siteData.players)
                .map(([playerId, data]) => ({
                  playerId,
                  playerName: data.playerName,
                  totalPlants: data.totalPlants,
                  clusters: data.clusters
                    .map(c => ({
                      ...c,
                      percentage: data.totalPlants > 0 ? (c.count / data.totalPlants) * 100 : 0,
                    }))
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 5),
                }))
                .filter(p => p.clusters.length > 0)
                .sort((a, b) => a.playerName.localeCompare(b.playerName)),
            }))
            .filter(s => s.players.length > 0)
            .sort((a, b) => a.site.localeCompare(b.site)),
        }))
        .filter(m => m.bySite.length > 0)
        .sort((a, b) => a.mapName.localeCompare(b.mapName)),
    } : null,
    
    // Post-Plant Ability Usage
    postPlantAbility: Object.keys(postPlantAbilityByMap).length > 0 ? {
      byMap: Object.entries(postPlantAbilityByMap)
        .map(([mapId, mapData]) => ({
          mapId,
          mapName: formatMapName(mapId),
          totalPlants: mapData.totalPlants,
          players: Object.entries(mapData.players)
            .map(([playerId, data]) => ({
              playerId,
              playerName: data.playerName,
              totalPlants: data.totalPlants,
              clusters: data.clusters
                .map(c => ({
                  ...c,
                  percentage: data.totalPlants > 0 ? (c.count / data.totalPlants) * 100 : 0,
                }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 10),
            }))
            .filter(p => p.clusters.length > 0)
            .sort((a, b) => a.playerName.localeCompare(b.playerName)),
        }))
        .filter(m => m.players.length > 0)
        .sort((a, b) => a.mapName.localeCompare(b.mapName)),
    } : null,
    
    seriesBreakdown,
  }
  
  return report
}
