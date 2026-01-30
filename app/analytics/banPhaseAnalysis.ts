import { StreamlinedSeries, StreamlinedGame, StreamlinedTeam, DraftingAction } from '../utils/seriesConverter'
import { AnalyticsResult } from './types'

interface BanSequence {
  gameNumber: number
  isFirstPick: boolean
  ourBans: string[] // Our 3 bans in order
  enemyBans: string[] // Enemy 3 bans in order (interleaved with ours)
  unavailableChamps: string[] // Champs picked in previous games (not available)
}

interface BanFrequency {
  champion: string
  count: number
  percentage: number
}

interface ConditionalBan {
  ifEnemyBans: string // If enemy bans this champ
  thenWeBan: { champion: string; count: number; percentage: number }[] // We typically ban these
  sampleSize: number
}

interface BanPositionStats {
  // Our bans by position (1st, 2nd, 3rd) when we have first pick
  firstPickBan1: BanFrequency[]
  firstPickBan2: BanFrequency[]
  firstPickBan3: BanFrequency[]
  // Our bans by position when we have second pick
  secondPickBan1: BanFrequency[]
  secondPickBan2: BanFrequency[]
  secondPickBan3: BanFrequency[]
}

interface AdaptiveBanStats {
  // When enemy bans X first, what do we ban?
  reactionsToEnemyFirstBan: ConditionalBan[]
  // When enemy bans X second, what do we ban third?
  reactionsToEnemySecondBan: ConditionalBan[]
}

interface BanPhaseAnalysisResult {
  teamId: string
  teamName: string
  totalGames: number
  banSequences: BanSequence[]
  banPositionStats: BanPositionStats
  adaptiveBanStats: AdaptiveBanStats
  // Most common overall first bans
  mostCommonFirstBans: BanFrequency[]
  // Priority bans (appear frequently across all positions)
  priorityBans: BanFrequency[]
}

/**
 * Get team name by team ID
 */
function getTeamName(teams: StreamlinedTeam[], teamId: string): string {
  const team = teams.find(t => t.id === teamId)
  return team?.name || 'Unknown'
}

/**
 * Extract the first 6 bans from drafting actions (3 per team, interleaved)
 * Standard ban order: FP1, SP1, FP2, SP2, FP3, SP3
 */
function extractFirstBanPhase(
  draftingActions: DraftingAction[],
  ourTeamId: string,
  firstPickTeamId: string
): { ourBans: string[]; enemyBans: string[] } {
  const bans = draftingActions.filter(a => a.action === 'ban').slice(0, 6)
  const ourBans: string[] = []
  const enemyBans: string[] = []
  
  for (const ban of bans) {
    if (ban.teamId === ourTeamId) {
      ourBans.push(ban.champName)
    } else {
      enemyBans.push(ban.champName)
    }
  }
  
  return { ourBans, enemyBans }
}

/**
 * Calculate frequency statistics from a list of champions
 */
function calculateFrequencies(champs: string[], total: number): BanFrequency[] {
  const counts: { [key: string]: number } = {}
  
  for (const champ of champs) {
    counts[champ] = (counts[champ] || 0) + 1
  }
  
  return Object.entries(counts)
    .map(([champion, count]) => ({
      champion,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count)
}

/**
 * Analyze a single game's ban phase
 */
function analyzeGameBans(
  game: StreamlinedGame,
  teams: StreamlinedTeam[],
  ourTeamId: string,
  gameNumber: number,
  previousPicks: string[]
): BanSequence | null {
  if (!game.draftingActions || game.draftingActions.length === 0) {
    return null
  }
  
  // Determine first pick team (first action in draft)
  const firstAction = game.draftingActions[0]
  const firstPickTeamId = firstAction.teamId
  const isFirstPick = firstPickTeamId === ourTeamId
  
  const { ourBans, enemyBans } = extractFirstBanPhase(
    game.draftingActions,
    ourTeamId,
    firstPickTeamId
  )
  
  if (ourBans.length < 3 || enemyBans.length < 3) {
    return null
  }
  
  return {
    gameNumber,
    isFirstPick,
    ourBans,
    enemyBans,
    unavailableChamps: previousPicks,
  }
}

/**
 * Calculate conditional ban probabilities
 */
function calculateConditionalBans(
  sequences: BanSequence[],
  enemyBanPosition: number, // 0 = first, 1 = second
  ourBanPosition: number // The position of our ban that comes after
): ConditionalBan[] {
  const reactions: { [enemyBan: string]: string[] } = {}
  
  for (const seq of sequences) {
    if (seq.enemyBans.length > enemyBanPosition && seq.ourBans.length > ourBanPosition) {
      const enemyBan = seq.enemyBans[enemyBanPosition]
      const ourBan = seq.ourBans[ourBanPosition]
      
      if (!reactions[enemyBan]) {
        reactions[enemyBan] = []
      }
      reactions[enemyBan].push(ourBan)
    }
  }
  
  // Convert to conditional probabilities
  const result: ConditionalBan[] = []
  
  for (const [enemyBan, ourBans] of Object.entries(reactions)) {
    if (ourBans.length >= 2) { // Only include if we have enough sample size
      const frequencies = calculateFrequencies(ourBans, ourBans.length)
      result.push({
        ifEnemyBans: enemyBan,
        thenWeBan: frequencies.slice(0, 5), // Top 5 responses
        sampleSize: ourBans.length,
      })
    }
  }
  
  return result.sort((a, b) => b.sampleSize - a.sampleSize)
}

/**
 * Ban Phase Analysis
 * 
 * Analyzes team banning patterns in the first ban phase (3 bans each).
 * Tracks:
 * - What champions are banned by position (1st, 2nd, 3rd ban)
 * - How banning changes based on first/second pick
 * - Adaptive banning based on opponent's bans
 */
export function banPhaseAnalysis(series: StreamlinedSeries): AnalyticsResult | null {
  // We need to analyze for both teams
  if (series.teams.length < 2) return null
  
  const results: BanPhaseAnalysisResult[] = []
  
  for (const team of series.teams) {
    const ourTeamId = team.id
    const sequences: BanSequence[] = []
    const previousPicks: string[] = []
    
    let gameNumber = 0
    for (const game of series.games) {
      gameNumber++
      
      const sequence = analyzeGameBans(game, series.teams, ourTeamId, gameNumber, [...previousPicks])
      if (sequence) {
        sequences.push(sequence)
      }
      
      // Track picks from this game for next game's unavailable list
      const picks = game.draftingActions
        .filter(a => a.action === 'pick')
        .map(a => a.champName)
      previousPicks.push(...picks)
    }
    
    if (sequences.length === 0) continue
    
    // Calculate ban position stats
    const firstPickSequences = sequences.filter(s => s.isFirstPick)
    const secondPickSequences = sequences.filter(s => !s.isFirstPick)
    
    const banPositionStats: BanPositionStats = {
      firstPickBan1: calculateFrequencies(
        firstPickSequences.map(s => s.ourBans[0]).filter(Boolean),
        firstPickSequences.length
      ),
      firstPickBan2: calculateFrequencies(
        firstPickSequences.map(s => s.ourBans[1]).filter(Boolean),
        firstPickSequences.length
      ),
      firstPickBan3: calculateFrequencies(
        firstPickSequences.map(s => s.ourBans[2]).filter(Boolean),
        firstPickSequences.length
      ),
      secondPickBan1: calculateFrequencies(
        secondPickSequences.map(s => s.ourBans[0]).filter(Boolean),
        secondPickSequences.length
      ),
      secondPickBan2: calculateFrequencies(
        secondPickSequences.map(s => s.ourBans[1]).filter(Boolean),
        secondPickSequences.length
      ),
      secondPickBan3: calculateFrequencies(
        secondPickSequences.map(s => s.ourBans[2]).filter(Boolean),
        secondPickSequences.length
      ),
    }
    
    // Calculate adaptive ban stats
    // When on first pick: enemy bans after us, so we react to their ban1 with our ban2
    // When on second pick: enemy bans before us, so we react to their ban1 with our ban1
    const adaptiveBanStats: AdaptiveBanStats = {
      // Reactions to enemy's first ban
      reactionsToEnemyFirstBan: [
        ...calculateConditionalBans(firstPickSequences, 0, 1), // FP: react to enemy ban1 with our ban2
        ...calculateConditionalBans(secondPickSequences, 0, 0), // SP: react to enemy ban1 with our ban1
      ],
      // Reactions to enemy's second ban
      reactionsToEnemySecondBan: [
        ...calculateConditionalBans(firstPickSequences, 1, 2), // FP: react to enemy ban2 with our ban3
        ...calculateConditionalBans(secondPickSequences, 1, 1), // SP: react to enemy ban2 with our ban2
      ],
    }
    
    // Aggregate most common first bans overall
    const allFirstBans = sequences.map(s => s.ourBans[0]).filter(Boolean)
    const mostCommonFirstBans = calculateFrequencies(allFirstBans, sequences.length)
    
    // Aggregate priority bans (appear in any position frequently)
    const allBans = sequences.flatMap(s => s.ourBans)
    const priorityBans = calculateFrequencies(allBans, sequences.length)
    
    results.push({
      teamId: ourTeamId,
      teamName: getTeamName(series.teams, ourTeamId),
      totalGames: sequences.length,
      banSequences: sequences,
      banPositionStats,
      adaptiveBanStats,
      mostCommonFirstBans,
      priorityBans,
    })
  }
  
  if (results.length === 0) return null
  
  return {
    name: 'banPhaseAnalysis',
    data: {
      teams: results,
    },
  }
}
