import { ValorantStreamlinedSeries, MapVetoAction } from '../utils/valorantSeriesConverter'
import { ValorantAnalyticsResult } from './types'

/**
 * Map veto sequence for a team
 */
interface TeamMapVetoSequence {
  teamId: string
  teamName: string
  
  // Ban phase 1 (first bans, typically bans 1 and 2 from each team)
  banPhase1Actions: MapVetoAction[]
  
  // Pick phase (map picks)
  pickActions: MapVetoAction[]
  
  // Ban phase 2 (if exists - second round of bans)
  banPhase2Actions: MapVetoAction[]
  
  // Decider map (if auto-selected)
  deciderMap: string | null
  
  // All maps banned before our pick (both teams) - for availability calculation
  allBansBeforeOurPick: string[]
  
  // All maps banned by opponent before our first ban - for first ban availability
  opponentBansBeforeOurFirstBan: string[]
}

/**
 * Map frequency statistics
 */
interface MapFrequency {
  mapId: string
  mapName: string
  count: number
  percentage: number
}

/**
 * Per-team map veto analysis
 */
interface TeamMapVetoAnalysis {
  teamId: string
  teamName: string
  totalSeries: number
  
  // Ban phase 1 patterns - which maps they ban first
  banPhase1Patterns: {
    ban1: MapFrequency[] // First ban
    ban2: MapFrequency[] // Second ban (if applicable in phase 1)
    allBans: MapFrequency[] // All bans in phase 1
  }
  
  // Pick patterns - which maps they pick when open
  pickPatterns: {
    pick1: MapFrequency[] // First pick
    pick2: MapFrequency[] // Second pick (if applicable)
    allPicks: MapFrequency[]
  }
  
  // Ban phase 2 patterns (if exists)
  banPhase2Patterns: {
    allBans: MapFrequency[]
  } | null
  
  // Complete veto sequences for detailed analysis
  vetoSequences: TeamMapVetoSequence[]
}

/**
 * Overall map veto analysis result
 */
interface MapVetoAnalysisData {
  totalMaps: number
  teams: TeamMapVetoAnalysis[]
}

/**
 * Format map name for display
 */
function formatMapName(mapId: string): string {
  return mapId.charAt(0).toUpperCase() + mapId.slice(1)
}

/**
 * Calculate frequency statistics from map IDs
 */
function calculateMapFrequencies(mapIds: string[], total: number): MapFrequency[] {
  const counts: { [key: string]: number } = {}
  
  for (const mapId of mapIds) {
    counts[mapId] = (counts[mapId] || 0) + 1
  }
  
  return Object.entries(counts)
    .map(([mapId, count]) => ({
      mapId,
      mapName: formatMapName(mapId),
      count,
      percentage: total > 0 ? (count / total) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count)
}

/**
 * Analyze map veto for a single team
 */
function analyzeTeamMapVeto(
  teamId: string,
  teamName: string,
  mapVeto: MapVetoAction[]
): TeamMapVetoSequence {
  // Get actions by this team
  const teamBans = mapVeto.filter(v => v.teamId === teamId && v.action === 'ban')
  const teamPicks = mapVeto.filter(v => v.teamId === teamId && v.action === 'pick')
  const decider = mapVeto.find(v => v.action === 'decider')
  
  // Valorant veto format varies, but typically:
  // Bo3: Team A ban, Team B ban, Team A pick, Team B pick, decider
  // Bo5: More complex, but similar pattern
  
  // For now, we categorize based on sequence order
  // Bans that occur before any picks are "ban phase 1"
  const firstPickIndex = mapVeto.findIndex(v => v.action === 'pick')
  
  const banPhase1Actions = teamBans.filter(b => {
    const banIndex = mapVeto.findIndex(v => v === b)
    return firstPickIndex === -1 || banIndex < firstPickIndex
  })
  
  // Bans that occur after picks are "ban phase 2"
  const banPhase2Actions = teamBans.filter(b => {
    const banIndex = mapVeto.findIndex(v => v === b)
    return firstPickIndex !== -1 && banIndex > firstPickIndex
  })
  
  // Find our first pick's index
  const ourFirstPickIndex = mapVeto.findIndex(v => v.teamId === teamId && v.action === 'pick')
  
  // All bans (by both teams) that occurred before our first pick
  const allBansBeforeOurPick: string[] = []
  if (ourFirstPickIndex !== -1) {
    for (let i = 0; i < ourFirstPickIndex; i++) {
      if (mapVeto[i].action === 'ban') {
        allBansBeforeOurPick.push(mapVeto[i].mapId)
      }
    }
  } else {
    // No picks, so all bans count
    allBansBeforeOurPick.push(...mapVeto.filter(v => v.action === 'ban').map(v => v.mapId))
  }
  
  // Find our first ban's index
  const ourFirstBanIndex = mapVeto.findIndex(v => v.teamId === teamId && v.action === 'ban')
  
  // All opponent bans that occurred before our first ban
  const opponentBansBeforeOurFirstBan: string[] = []
  if (ourFirstBanIndex !== -1) {
    for (let i = 0; i < ourFirstBanIndex; i++) {
      if (mapVeto[i].action === 'ban' && mapVeto[i].teamId !== teamId) {
        opponentBansBeforeOurFirstBan.push(mapVeto[i].mapId)
      }
    }
  }
  
  return {
    teamId,
    teamName,
    banPhase1Actions,
    pickActions: teamPicks,
    banPhase2Actions,
    deciderMap: decider?.mapId || null,
    allBansBeforeOurPick,
    opponentBansBeforeOurFirstBan,
  }
}

/**
 * Map Veto Analysis
 * 
 * Analyzes team map veto patterns in Valorant:
 * - Which maps teams ban first (ban phase 1)
 * - Which maps teams pick when open
 * - Which maps teams ban in second ban phase (if applicable)
 */
export function mapVetoAnalysis(series: ValorantStreamlinedSeries): ValorantAnalyticsResult | null {
  if (series.teams.length < 2 || series.mapVeto.length === 0) {
    return null
  }
  
  const teamAnalyses: TeamMapVetoAnalysis[] = []
  
  for (const team of series.teams) {
    const vetoSequence = analyzeTeamMapVeto(team.id, team.name, series.mapVeto)
    
    // Calculate frequencies (this is for a single series, so percentages are 100% or 0%)
    const banPhase1Maps = vetoSequence.banPhase1Actions.map(a => a.mapId)
    const pickMaps = vetoSequence.pickActions.map(a => a.mapId)
    const banPhase2Maps = vetoSequence.banPhase2Actions.map(a => a.mapId)
    
    const analysis: TeamMapVetoAnalysis = {
      teamId: team.id,
      teamName: team.name,
      totalSeries: 1, // Single series
      banPhase1Patterns: {
        ban1: vetoSequence.banPhase1Actions[0] 
          ? [{ mapId: vetoSequence.banPhase1Actions[0].mapId, mapName: formatMapName(vetoSequence.banPhase1Actions[0].mapId), count: 1, percentage: 100 }]
          : [],
        ban2: vetoSequence.banPhase1Actions[1]
          ? [{ mapId: vetoSequence.banPhase1Actions[1].mapId, mapName: formatMapName(vetoSequence.banPhase1Actions[1].mapId), count: 1, percentage: 100 }]
          : [],
        allBans: calculateMapFrequencies(banPhase1Maps, 1),
      },
      pickPatterns: {
        pick1: vetoSequence.pickActions[0]
          ? [{ mapId: vetoSequence.pickActions[0].mapId, mapName: formatMapName(vetoSequence.pickActions[0].mapId), count: 1, percentage: 100 }]
          : [],
        pick2: vetoSequence.pickActions[1]
          ? [{ mapId: vetoSequence.pickActions[1].mapId, mapName: formatMapName(vetoSequence.pickActions[1].mapId), count: 1, percentage: 100 }]
          : [],
        allPicks: calculateMapFrequencies(pickMaps, 1),
      },
      banPhase2Patterns: banPhase2Maps.length > 0 ? {
        allBans: calculateMapFrequencies(banPhase2Maps, 1),
      } : null,
      vetoSequences: [vetoSequence],
    }
    
    teamAnalyses.push(analysis)
  }
  
  const result: MapVetoAnalysisData = {
    totalMaps: series.games.length,
    teams: teamAnalyses,
  }
  
  return {
    name: 'mapVetoAnalysis',
    description: 'Analysis of map veto patterns including bans and picks',
    data: result,
    generatedAt: new Date().toISOString(),
  }
}
