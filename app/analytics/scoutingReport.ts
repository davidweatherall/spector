import { AnalyticsOutput, AnalyticsResult } from './types'

/**
 * Aggregated scouting report data across multiple series
 */
export interface ScoutingReport {
  teamId: string
  teamName: string
  seriesAnalyzed: number
  generatedAt: string
  
  // Counter Pick Gold Diff aggregation
  counterPickStats: {
    topLane: {
      gamesAsCounterPick: number
      gamesCounterPicked: number
      avgWorthDiffWhenCounterPicking: number
      avgWorthDiffWhenCounterPicked: number
      counterPickValues: number[]
      counterPickedValues: number[]
    }
    midLane: {
      gamesAsCounterPick: number
      gamesCounterPicked: number
      avgWorthDiffWhenCounterPicking: number
      avgWorthDiffWhenCounterPicked: number
      counterPickValues: number[]
      counterPickedValues: number[]
    }
  } | null
  
  // Bot Lane Drake Prio aggregation
  drakePrioStats: {
    totalDrakes: number
    drakesWhenHadPrio: number
    drakesWhenNoPrio: number
    prioWinRate: number
  } | null
  
  // Support Grub Recall aggregation
  supportGrubStats: {
    totalGrubs: number
    avgRecallTimeBeforeGrub: number | null
    recallTimes: number[] // Individual recall times for charting
  } | null
  
  // ADC Joined Grubs aggregation
  adcGrubStats: {
    totalFirstGrubs: number
    grubsWithAdcPresent: number
    adcPresentRate: number
  } | null
  
  // Player Gold Lead at 15 - by role (compared to lane opponent)
  goldLeadAt15ByRole: {
    top: { avg: number; values: number[] }
    jungle: { avg: number; values: number[] }
    mid: { avg: number; values: number[] }
    bot: { avg: number; values: number[] }
    support: { avg: number; values: number[] }
  } | null
  
  // Drake Gold Holding aggregation
  drakeGoldHoldingStats: {
    totalDrakes: number
    avgMidGoldHeld: number
    avgAdcGoldHeld: number
  } | null
  
  // Comeback Stats aggregation
  comebackStats: {
    totalGames: number
    comebackRate: number
    leadHoldRate: number
    avgComebackDeficit: number
    avgLeadWhenHeld: number
  } | null
  
  // Class Win Rate Stats by role
  classWinRateStats: {
    top: { className: string; wins: number; games: number; winRate: number }[]
    jungle: { className: string; wins: number; games: number; winRate: number }[]
    support: { className: string; wins: number; games: number; winRate: number }[]
  } | null
  
  // Ban Phase Analysis
  banPhaseStats: {
    totalGames: number
    firstPickGames: number
    secondPickGames: number
    // Bans by game number (fearless mode aware)
    bansByGame: {
      game1: { champion: string; count: number; percentage: number }[]
      game2: { champion: string; count: number; percentage: number }[] // % of times banned when available
      game3: { champion: string; count: number; percentage: number }[] // % of times banned when available
    }
    // Second ban phase patterns - "When we pick X, we tend to ban Y"
    secondBanPhasePatterns: {
      ifWePick: string
      weBan: { champion: string; count: number; percentage: number }[]
      sampleSize: number
    }[]
    // Bans by position when first pick
    firstPick: {
      priorityBans: { champion: string; count: number; percentage: number }[]
      ban1: { champion: string; count: number; percentage: number }[]
      ban2: { champion: string; count: number; percentage: number }[]
      ban3: { champion: string; count: number; percentage: number }[]
      adaptiveBans: {
        ifEnemyBans: string
        thenWeBan: { champion: string; count: number; percentage: number }[]
        sampleSize: number
      }[]
      // First pick = 1 champion picked first (% = pick rate when available)
      firstPicks: { champion: string; count: number; available: number; percentage: number }[]
    }
    // Bans by position when second pick
    secondPick: {
      priorityBans: { champion: string; count: number; percentage: number }[]
      ban1: { champion: string; count: number; percentage: number }[]
      ban2: { champion: string; count: number; percentage: number }[]
      ban3: { champion: string; count: number; percentage: number }[]
      adaptiveBans: {
        ifEnemyBans: string
        thenWeBan: { champion: string; count: number; percentage: number }[]
        sampleSize: number
      }[]
      // Second pick = 2 champions picked (% = pick rate when available)
      firstPicks: { champion: string; count: number; available: number; percentage: number }[]
      // Track common pick pairs (first two picks together)
      pickPairs: { pair: string[]; count: number; percentage: number }[]
      // Adaptive picks - when enemy first picks X, we respond with Y
      adaptivePicks: {
        ifEnemyPicks: string
        thenWePick: { champion: string; count: number; percentage: number; banRate: number }[]
        sampleSize: number
      }[]
    }
  } | null
  
  // Per-series breakdown with draft info
  seriesBreakdown: {
    seriesId: string
    opponent: string
    date: string
    games: {
      gameNumber: number
      isFirstPick: boolean // Did our team have first pick?
      ourTeamId: string
      enemyTeamId: string
      // Full draft actions in order for rendering
      draftActions: {
        teamId: string
        champName: string
        action: 'ban' | 'pick'
        isOurTeam: boolean
      }[]
    }[]
  }[]
}

/**
 * Aggregate analytics from multiple series into a scouting report
 */
export function aggregateScoutingReport(
  teamId: string,
  teamName: string,
  analyticsResults: { seriesId: string; analytics: AnalyticsOutput; opponent: string; date: string }[]
): ScoutingReport {
  const report: ScoutingReport = {
    teamId,
    teamName,
    seriesAnalyzed: analyticsResults.length,
    generatedAt: new Date().toISOString(),
    counterPickStats: null,
    drakePrioStats: null,
    supportGrubStats: null,
    adcGrubStats: null,
    goldLeadAt15ByRole: null,
    drakeGoldHoldingStats: null,
    comebackStats: null,
    classWinRateStats: null,
    banPhaseStats: null,
    seriesBreakdown: analyticsResults.map(r => {
      // Get draft data for this series
      const draftData = r.analytics.results.find(res => res.name === 'draftAnalysis')?.data as any
      const games: { gameNumber: number; isFirstPick: boolean; ourTeamId: string; enemyTeamId: string; draftActions: { teamId: string; champName: string; action: 'ban' | 'pick'; isOurTeam: boolean }[] }[] = []
      
      if (draftData?.games) {
        for (const game of draftData.games) {
          // Determine if our team is blue or red
          const isOurTeamBlue = game.blueTeamId === teamId
          const isFirstPick = game.firstPickTeamId === teamId
          
          // Build draft actions with isOurTeam flag
          const draftActions = game.draftingActions.map((action: any) => ({
            teamId: action.teamId,
            champName: action.champName,
            action: action.action,
            isOurTeam: action.teamId === teamId,
          }))
          
          games.push({
            gameNumber: game.gameNumber,
            isFirstPick,
            ourTeamId: teamId,
            enemyTeamId: isOurTeamBlue ? game.redTeamId : game.blueTeamId,
            draftActions,
          })
        }
      }
      
      return {
        seriesId: r.seriesId,
        opponent: r.opponent,
        date: r.date,
        games,
      }
    }),
  }
  
  // Aggregate counter pick stats - only for our team
  const counterPickData = collectAnalyticsData(analyticsResults, 'counterPickGoldDiff')
  if (counterPickData.length > 0) {
    const topCounterPick: number[] = []
    const topCounterPicked: number[] = []
    const midCounterPick: number[] = []
    const midCounterPicked: number[] = []
    
    for (const data of counterPickData) {
      if (data.topLane) {
        // Filter to only include games where the player is on our team (by ID)
        const ourTopCounterPick = data.topLane.counterPickGames.filter((g: any) => g.teamId === teamId)
        const ourTopCounterPicked = data.topLane.counterPickedGames.filter((g: any) => g.teamId === teamId)
        topCounterPick.push(...ourTopCounterPick.map((g: any) => g.worthDiff))
        topCounterPicked.push(...ourTopCounterPicked.map((g: any) => g.worthDiff))
      }
      if (data.midLane) {
        const ourMidCounterPick = data.midLane.counterPickGames.filter((g: any) => g.teamId === teamId)
        const ourMidCounterPicked = data.midLane.counterPickedGames.filter((g: any) => g.teamId === teamId)
        midCounterPick.push(...ourMidCounterPick.map((g: any) => g.worthDiff))
        midCounterPicked.push(...ourMidCounterPicked.map((g: any) => g.worthDiff))
      }
    }
    
    report.counterPickStats = {
      topLane: {
        gamesAsCounterPick: topCounterPick.length,
        gamesCounterPicked: topCounterPicked.length,
        avgWorthDiffWhenCounterPicking: average(topCounterPick),
        avgWorthDiffWhenCounterPicked: average(topCounterPicked),
        counterPickValues: topCounterPick,
        counterPickedValues: topCounterPicked,
      },
      midLane: {
        gamesAsCounterPick: midCounterPick.length,
        gamesCounterPicked: midCounterPicked.length,
        avgWorthDiffWhenCounterPicking: average(midCounterPick),
        avgWorthDiffWhenCounterPicked: average(midCounterPicked),
        counterPickValues: midCounterPick,
        counterPickedValues: midCounterPicked,
      },
    }
  }
  
  // Aggregate drake prio stats - only for our team
  const drakePrioData = collectAnalyticsData(analyticsResults, 'botLaneDrakePrio')
  if (drakePrioData.length > 0) {
    let totalDrakes = 0
    let timesWeHadPrio = 0
    let drakesSecuredWithPrio = 0
    
    for (const data of drakePrioData) {
      if (data.drakeDetails) {
        for (const drake of data.drakeDetails) {
          // Check if our team is blue or red side (by ID)
          const isOurTeamBlue = drake.blueTeamId === teamId
          const isOurTeamRed = drake.redTeamId === teamId
          
          if (!isOurTeamBlue && !isOurTeamRed) continue
          
          totalDrakes++
          
          if (drake.teamWithPrio === 'even') continue
          
          // Determine if our team had prio
          const ourTeamHadPrio = (isOurTeamBlue && drake.teamWithPrio === 'blue') ||
                                  (isOurTeamRed && drake.teamWithPrio === 'red')
          
          // Determine if our team got the drake (by ID)
          const ourTeamGotDrake = drake.killerTeamId === teamId
          
          if (ourTeamHadPrio) {
            timesWeHadPrio++
            if (ourTeamGotDrake) {
              drakesSecuredWithPrio++
            }
          }
        }
      }
    }
    
    report.drakePrioStats = {
      totalDrakes,
      drakesWhenHadPrio: drakesSecuredWithPrio,
      drakesWhenNoPrio: timesWeHadPrio, // Repurposed: now means "times we had prio"
      prioWinRate: timesWeHadPrio > 0 ? (drakesSecuredWithPrio / timesWeHadPrio) * 100 : 0,
    }
  }
  
  // Aggregate support grub stats - only for our team
  const supportGrubData = collectAnalyticsData(analyticsResults, 'supportGrubRecall')
  if (supportGrubData.length > 0) {
    const recallTimes: number[] = []
    let totalGrubs = 0
    
    for (const data of supportGrubData) {
      if (data.grubDetails) {
        for (const grub of data.grubDetails) {
          // Only include our team's support recall time (by ID)
          if (grub.blueTeamId === teamId && grub.blueSupportRecallTime !== null) {
            recallTimes.push(grub.blueSupportRecallTime)
            totalGrubs++
          } else if (grub.redTeamId === teamId && grub.redSupportRecallTime !== null) {
            recallTimes.push(grub.redSupportRecallTime)
            totalGrubs++
          }
        }
      }
    }
    
    report.supportGrubStats = {
      totalGrubs,
      avgRecallTimeBeforeGrub: recallTimes.length > 0 ? average(recallTimes) : null,
      recallTimes: recallTimes.sort((a, b) => a - b), // Sorted for charting
    }
  }
  
  // Aggregate ADC grub stats - only for our team
  const adcGrubData = collectAnalyticsData(analyticsResults, 'adcJoinedGrubs')
  if (adcGrubData.length > 0) {
    let totalFirstGrubs = 0
    let grubsWithAdcPresent = 0
    
    for (const data of adcGrubData) {
      if (data.grubDetails) {
        for (const grub of data.grubDetails) {
          // Only count if our team got the grub (by ID)
          if (grub.adcTeamId === teamId) {
            totalFirstGrubs++
            if (grub.adcJoinedForGrubs) {
              grubsWithAdcPresent++
            }
          }
        }
      }
    }
    
    report.adcGrubStats = {
      totalFirstGrubs,
      grubsWithAdcPresent,
      adcPresentRate: totalFirstGrubs > 0 ? (grubsWithAdcPresent / totalFirstGrubs) * 100 : 0,
    }
  }
  
  // Aggregate gold lead at 15 by role - comparing our player to opponent in same role
  const worthAt15Data = collectAnalyticsData(analyticsResults, 'playerWorthAt15')
  if (worthAt15Data.length > 0) {
    const goldLeadByRole: { [key: string]: number[] } = {
      top: [], jungle: [], mid: [], bot: [], support: []
    }
    
    for (const data of worthAt15Data) {
      if (data.games) {
        for (const game of data.games) {
          // Group players by role
          const playersByRole: { [role: string]: { ours: any | null, enemy: any | null } } = {
            top: { ours: null, enemy: null },
            jungle: { ours: null, enemy: null },
            mid: { ours: null, enemy: null },
            bot: { ours: null, enemy: null },
            support: { ours: null, enemy: null },
          }
          
          for (const player of game.players) {
            if (!player.role || !playersByRole[player.role]) continue
            
            if (player.teamId === teamId) {
              playersByRole[player.role].ours = player
            } else {
              playersByRole[player.role].enemy = player
            }
          }
          
          // Calculate gold lead for each role
          for (const role of Object.keys(playersByRole)) {
            const { ours, enemy } = playersByRole[role]
            if (ours && enemy) {
              const goldLead = ours.worthAt15 - enemy.worthAt15
              goldLeadByRole[role].push(goldLead)
            }
          }
        }
      }
    }
    
    report.goldLeadAt15ByRole = {
      top: { avg: average(goldLeadByRole.top), values: goldLeadByRole.top },
      jungle: { avg: average(goldLeadByRole.jungle), values: goldLeadByRole.jungle },
      mid: { avg: average(goldLeadByRole.mid), values: goldLeadByRole.mid },
      bot: { avg: average(goldLeadByRole.bot), values: goldLeadByRole.bot },
      support: { avg: average(goldLeadByRole.support), values: goldLeadByRole.support },
    }
  }
  
  // Aggregate drake gold holding - only for our team
  const drakeGoldData = collectAnalyticsData(analyticsResults, 'drakeGoldHolding')
  if (drakeGoldData.length > 0) {
    let totalDrakes = 0
    const midGolds: number[] = []
    const adcGolds: number[] = []
    
    for (const data of drakeGoldData) {
      if (data.drakeDetails) {
        for (const drake of data.drakeDetails) {
          let foundOurTeam = false
          for (const player of drake.players) {
            // Only include players from our team (by ID)
            if (player.teamId === teamId) {
              foundOurTeam = true
              const goldValue = player.holdingGoldWhenDrakeDies
              if (typeof goldValue === 'number' && !isNaN(goldValue)) {
                if (player.role === 'mid') midGolds.push(goldValue)
                if (player.role === 'bot') adcGolds.push(goldValue)
              }
            }
          }
          if (foundOurTeam) totalDrakes++
        }
      }
    }
    
    // Divide by 2 since we're counting unique drakes, not player entries
    report.drakeGoldHoldingStats = {
      totalDrakes: Math.floor(totalDrakes / 2), // Each drake has 2 players from our team
      avgMidGoldHeld: average(midGolds),
      avgAdcGoldHeld: average(adcGolds),
    }
  }
  
  // Aggregate comeback stats - only for our team
  const comebackData = collectAnalyticsData(analyticsResults, 'comebackStats')
  if (comebackData.length > 0) {
    let totalGames = 0
    let totalComebacks = 0
    let totalLeadsHeld = 0
    let totalLeadsLost = 0
    let totalComebacksFailed = 0
    const comebackDeficits: number[] = []
    const leadsHeld: number[] = []
    
    for (const data of comebackData) {
      if (data.games) {
        for (const game of data.games) {
          // Check if our team was in this game (by ID)
          const isOurTeamBlue = game.blueTeamId === teamId
          const isOurTeamRed = game.redTeamId === teamId
          
          if (!isOurTeamBlue && !isOurTeamRed) continue
          
          totalGames++
          
          const ourTeamWon = game.winnerTeamId === teamId
          const ourTeamWasAhead = game.teamAheadAt15Id === teamId
          const ourTeamWasBehind = game.teamBehindAt15Id === teamId
          
          if (game.outcome === 'even_at_15') continue
          
          if (ourTeamWasBehind && ourTeamWon) {
            // We came back from behind
            totalComebacks++
            comebackDeficits.push(game.leadAmount)
          } else if (ourTeamWasBehind && !ourTeamWon) {
            // We were behind and lost
            totalComebacksFailed++
          } else if (ourTeamWasAhead && ourTeamWon) {
            // We held our lead
            totalLeadsHeld++
            leadsHeld.push(game.leadAmount)
          } else if (ourTeamWasAhead && !ourTeamWon) {
            // We threw our lead
            totalLeadsLost++
          }
        }
      }
    }
    
    const gamesWhenBehind = totalComebacks + totalComebacksFailed
    const gamesWhenAhead = totalLeadsHeld + totalLeadsLost
    
    report.comebackStats = {
      totalGames,
      comebackRate: gamesWhenBehind > 0 ? (totalComebacks / gamesWhenBehind) * 100 : 0,
      leadHoldRate: gamesWhenAhead > 0 ? (totalLeadsHeld / gamesWhenAhead) * 100 : 0,
      avgComebackDeficit: average(comebackDeficits),
      avgLeadWhenHeld: average(leadsHeld),
    }
  }
  
  // Aggregate class win rate stats - only for our team
  const classWinRateData = collectAnalyticsData(analyticsResults, 'classWinRate')
  console.log(`[scoutingReport] Found ${classWinRateData.length} classWinRate analytics, teamId: ${teamId}`)
  if (classWinRateData.length > 0) {
    // Track wins and games by class for each role
    const roleClassStats: {
      top: { [className: string]: { wins: number; games: number } }
      jungle: { [className: string]: { wins: number; games: number } }
      support: { [className: string]: { wins: number; games: number } }
    } = {
      top: {},
      jungle: {},
      support: {},
    }
    
    let totalGamesFound = 0
    let matchingTeamGames = 0
    for (const data of classWinRateData) {
      if (data.games) {
        totalGamesFound += data.games.length
        for (const game of data.games) {
          // Only include games for our team
          if (game.teamId !== teamId) continue
          matchingTeamGames++
          
          const role = game.role as 'top' | 'jungle' | 'support'
          const classes = game.classes || []
          
          for (const className of classes) {
            if (!roleClassStats[role][className]) {
              roleClassStats[role][className] = { wins: 0, games: 0 }
            }
            roleClassStats[role][className].games++
            if (game.won) {
              roleClassStats[role][className].wins++
            }
          }
        }
      }
    }
    console.log(`[scoutingReport] classWinRate: totalGamesFound=${totalGamesFound}, matchingTeamGames=${matchingTeamGames}`)
    
    // Convert to sorted arrays
    const convertToArray = (stats: { [className: string]: { wins: number; games: number } }) => {
      return Object.entries(stats)
        .filter(([_, s]) => s.games >= 2) // Need at least 2 games
        .map(([className, s]) => ({
          className,
          wins: s.wins,
          games: s.games,
          winRate: (s.wins / s.games) * 100,
        }))
        .sort((a, b) => b.games - a.games) // Sort by games played
    }
    
    report.classWinRateStats = {
      top: convertToArray(roleClassStats.top),
      jungle: convertToArray(roleClassStats.jungle),
      support: convertToArray(roleClassStats.support),
    }
  }
  
  // Aggregate ban phase stats - only for our team
  const banPhaseData = collectAnalyticsData(analyticsResults, 'banPhaseAnalysis')
  if (banPhaseData.length > 0) {
    // Collect all ban and pick data from series where our team was analyzed
    // Separate by first pick vs second pick
    const firstPickBans: { all: string[]; ban1: string[]; ban2: string[]; ban3: string[] } = { all: [], ban1: [], ban2: [], ban3: [] }
    const secondPickBans: { all: string[]; ban1: string[]; ban2: string[]; ban3: string[] } = { all: [], ban1: [], ban2: [], ban3: [] }
    const firstPickAdaptive: { [enemyBan: string]: string[] } = {}
    const secondPickAdaptive: { [enemyBan: string]: string[] } = {}
    // First picks tracking - now track availability and picks for "pick rate when available"
    // For FP: available = not banned (6 bans), not picked previously
    // For SP: available = not banned (6 bans), not picked by enemy first, not picked previously
    const fpChampAvailability: { [champ: string]: { available: number; picked: number } } = {}
    const spChampAvailability: { [champ: string]: { available: number; picked: number } } = {}
    const spPickPairs: string[][] = [] // When second pick, the pair of picks together
    // Track adaptive picks with ban info: when enemy picks X, what do we pick and what was banned
    const spAdaptivePicks: { [enemyPick: string]: { picks: string[]; bans: string[] }[] } = {} // Each entry has our 2 picks and all bans
    let totalGames = 0
    let firstPickGames = 0
    let secondPickGames = 0
    
    // Track bans by game number (fearless mode)
    // For game 1: just track bans
    // For games 2-3: track bans along with what was unavailable (for % calculation)
    const game1Bans: string[] = []
    const game2Bans: { ban: string; unavailable: string[] }[] = []
    const game3Bans: { ban: string; unavailable: string[] }[] = []
    let game1Count = 0
    let game2Count = 0
    let game3Count = 0
    
    // Track second ban phase patterns - when we pick X, enemy bans Y
    const secondBanPhaseReactions: { [ourPick: string]: string[] } = {}
    
    // First pass: collect all unique champions we've ever picked and all game sequences
    const allFpSequences: any[] = []
    const allSpSequences: any[] = []
    const fpPickedChamps = new Set<string>()
    const spPickedChamps = new Set<string>()
    
    for (const data of banPhaseData) {
      if (data.teams) {
        const ourTeamData = data.teams.find((t: any) => t.teamId === teamId)
        if (ourTeamData) {
          totalGames += ourTeamData.totalGames
          
          for (const seq of ourTeamData.banSequences || []) {
            // Track bans by game number (fearless mode)
            const gameNum = seq.gameNumber || 1
            const unavailable = seq.unavailableChamps || []
            if (gameNum === 1) {
              game1Count++
              game1Bans.push(...seq.ourBans)
            } else if (gameNum === 2) {
              game2Count++
              for (const ban of seq.ourBans) {
                game2Bans.push({ ban, unavailable })
              }
            } else if (gameNum >= 3) {
              game3Count++
              for (const ban of seq.ourBans) {
                game3Bans.push({ ban, unavailable })
              }
            }
            
            // Track second ban phase patterns - when we pick X, we tend to ban Y
            if (seq.ourPicksBeforeSecondBan && seq.ourSecondPhaseBans && seq.ourSecondPhaseBans.length > 0) {
              for (const ourPick of seq.ourPicksBeforeSecondBan) {
                if (!secondBanPhaseReactions[ourPick]) {
                  secondBanPhaseReactions[ourPick] = []
                }
                secondBanPhaseReactions[ourPick].push(...seq.ourSecondPhaseBans)
              }
            }
            
            if (seq.isFirstPick) {
              firstPickGames++
              allFpSequences.push(seq)
              if (seq.ourFirstPicks?.[0]) {
                fpPickedChamps.add(seq.ourFirstPicks[0])
              }
              
              // Collect ban data
              firstPickBans.all.push(...seq.ourBans)
              if (seq.ourBans[0]) firstPickBans.ban1.push(seq.ourBans[0])
              if (seq.ourBans[1]) firstPickBans.ban2.push(seq.ourBans[1])
              if (seq.ourBans[2]) firstPickBans.ban3.push(seq.ourBans[2])
              if (seq.enemyBans[0] && seq.ourBans[1]) {
                if (!firstPickAdaptive[seq.enemyBans[0]]) firstPickAdaptive[seq.enemyBans[0]] = []
                firstPickAdaptive[seq.enemyBans[0]].push(seq.ourBans[1])
              }
            } else {
              secondPickGames++
              allSpSequences.push(seq)
              if (seq.ourFirstPicks) {
                for (const champ of seq.ourFirstPicks) {
                  spPickedChamps.add(champ)
                }
              }
              
              // Collect ban data
              secondPickBans.all.push(...seq.ourBans)
              if (seq.ourBans[0]) secondPickBans.ban1.push(seq.ourBans[0])
              if (seq.ourBans[1]) secondPickBans.ban2.push(seq.ourBans[1])
              if (seq.ourBans[2]) secondPickBans.ban3.push(seq.ourBans[2])
              if (seq.enemyBans[0] && seq.ourBans[0]) {
                if (!secondPickAdaptive[seq.enemyBans[0]]) secondPickAdaptive[seq.enemyBans[0]] = []
                secondPickAdaptive[seq.enemyBans[0]].push(seq.ourBans[0])
              }
              
              if (seq.ourFirstPicks && seq.ourFirstPicks.length >= 2) {
                const sortedPair = [...seq.ourFirstPicks].sort()
                spPickPairs.push(sortedPair)
              }
              
              // Track adaptive picks - when enemy picks X, we respond with our 2 picks
              // Also track what was banned/unavailable in this game (including fearless mode)
              if (seq.enemyFirstPick && seq.ourFirstPicks && seq.ourFirstPicks.length > 0) {
                if (!spAdaptivePicks[seq.enemyFirstPick]) {
                  spAdaptivePicks[seq.enemyFirstPick] = []
                }
                const allBans = seq.allBans || [...(seq.ourBans || []), ...(seq.enemyBans || [])]
                // Include unavailable champs from previous games (fearless mode)
                const unavailableFromFearless = seq.unavailableChamps || []
                const allUnavailable = [...allBans, ...unavailableFromFearless]
                // Only take first 2 picks (the immediate response)
                const firstTwoPicks = seq.ourFirstPicks.slice(0, 2)
                spAdaptivePicks[seq.enemyFirstPick].push({
                  picks: firstTwoPicks,
                  bans: allUnavailable, // includes bans + fearless unavailable
                })
              }
            }
          }
        }
      }
    }
    
    // Second pass: for each champion we've picked, track availability across ALL games
    // First Pick availability
    for (const champ of fpPickedChamps) {
      fpChampAvailability[champ] = { available: 0, picked: 0 }
      
      for (const seq of allFpSequences) {
        const allBans = seq.allBans || [...(seq.ourBans || []), ...(seq.enemyBans || [])]
        const unavailablePrevious = seq.unavailableChamps || []
        const unavailableSet = new Set([...allBans, ...unavailablePrevious])
        
        // Check if this champ was available in this game
        if (!unavailableSet.has(champ)) {
          fpChampAvailability[champ].available++
          
          // Check if we picked it
          if (seq.ourFirstPicks?.[0] === champ) {
            fpChampAvailability[champ].picked++
          }
        }
      }
    }
    
    // Second Pick availability
    for (const champ of spPickedChamps) {
      spChampAvailability[champ] = { available: 0, picked: 0 }
      
      for (const seq of allSpSequences) {
        const allBans = seq.allBans || [...(seq.ourBans || []), ...(seq.enemyBans || [])]
        const unavailablePrevious = seq.unavailableChamps || []
        const enemyFirstPick = seq.enemyFirstPick
        const unavailableSet = new Set([...allBans, ...unavailablePrevious, ...(enemyFirstPick ? [enemyFirstPick] : [])])
        
        // Check if this champ was available in this game
        if (!unavailableSet.has(champ)) {
          spChampAvailability[champ].available++
          
          // Check if we picked it
          if (seq.ourFirstPicks?.includes(champ)) {
            spChampAvailability[champ].picked++
          }
        }
      }
    }
    
    // Calculate frequencies helper
    const calcFreq = (champs: string[], total: number) => {
      const counts: { [key: string]: number } = {}
      for (const champ of champs) counts[champ] = (counts[champ] || 0) + 1
      return Object.entries(counts)
        .map(([champion, count]) => ({ champion, count, percentage: total > 0 ? (count / total) * 100 : 0 }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10) // Top 10
    }
    
    // Calculate adaptive bans helper
    const calcAdaptive = (reactions: { [enemyBan: string]: string[] }) => {
      return Object.entries(reactions)
        .filter(([_, r]) => r.length >= 2)
        .map(([enemyBan, r]) => ({
          ifEnemyBans: enemyBan,
          thenWeBan: calcFreq(r, r.length).slice(0, 5),
          sampleSize: r.length,
        }))
        .sort((a, b) => b.sampleSize - a.sampleSize)
        .slice(0, 10)
    }
    
    // Calculate pick pair frequencies
    const calcPairFreq = (pairs: string[][], total: number) => {
      const counts: { [key: string]: { pair: string[]; count: number } } = {}
      for (const pair of pairs) {
        const key = pair.join('|')
        if (!counts[key]) counts[key] = { pair, count: 0 }
        counts[key].count++
      }
      return Object.values(counts)
        .map(({ pair, count }) => ({ pair, count, percentage: total > 0 ? (count / total) * 100 : 0 }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10) // Top 10 pairs
    }
    
    // Calculate adaptive picks (when enemy picks X, we respond with Y) with ban rates
    const calcAdaptivePicks = (reactions: { [enemyPick: string]: { picks: string[]; bans: string[] }[] }) => {
      return Object.entries(reactions)
        .filter(([_, games]) => games.length >= 2) // Need at least 2 games
        .map(([enemyPick, games]) => {
          // Collect all picks and count ban occurrences
          const pickCounts: { [champ: string]: number } = {}
          const banCounts: { [champ: string]: number } = {}
          const totalGames = games.length
          
          for (const game of games) {
            // Count picks
            for (const pick of game.picks) {
              pickCounts[pick] = (pickCounts[pick] || 0) + 1
            }
            // Count how often each champ was banned
            for (const ban of game.bans) {
              banCounts[ban] = (banCounts[ban] || 0) + 1
            }
          }
          
          // Build response with pick % and ban %
          const thenWePick = Object.entries(pickCounts)
            .map(([champion, count]) => ({
              champion,
              count,
              percentage: (count / totalGames) * 100, // % of games we picked this champ
              banRate: ((banCounts[champion] || 0) / totalGames) * 100, // % of games this champ was banned
            }))
            .sort((a, b) => b.percentage - a.percentage)
            .slice(0, 5)
          
          return {
            ifEnemyPicks: enemyPick,
            thenWePick,
            sampleSize: totalGames,
          }
        })
        .sort((a, b) => b.sampleSize - a.sampleSize)
        .slice(0, 10)
    }
    
    // Calculate pick rate when available (picked / available * 100)
    const calcPickRateWhenAvailable = (availability: { [champ: string]: { available: number; picked: number } }) => {
      return Object.entries(availability)
        .map(([champion, stats]) => ({
          champion,
          count: stats.picked,
          available: stats.available,
          percentage: stats.available > 0 ? (stats.picked / stats.available) * 100 : 0,
        }))
        .sort((a, b) => b.percentage - a.percentage) // Sort by pick rate % (highest first)
        .slice(0, 10) // Top 10
    }
    
    // Calculate bans by game with availability awareness
    // Game 1: simple frequency (all champs available)
    const calcGame1Bans = () => {
      if (game1Count === 0) return []
      const counts: { [champ: string]: number } = {}
      for (const ban of game1Bans) {
        counts[ban] = (counts[ban] || 0) + 1
      }
      return Object.entries(counts)
        .map(([champion, count]) => ({
          champion,
          count,
          percentage: (count / game1Count) * 100, // % of game 1s we banned this
        }))
        .sort((a, b) => b.percentage - a.percentage)
        .slice(0, 10)
    }
    
    // Game 2+: % of times banned when available (not picked in previous games)
    const calcGameNBans = (bans: { ban: string; unavailable: string[] }[], gameCount: number) => {
      if (gameCount === 0) return []
      
      // For each champion, track: times banned AND times available
      const champStats: { [champ: string]: { banned: number; available: number } } = {}
      
      // Get all unique champions that were ever banned in this game slot
      const bannedChamps = new Set(bans.map(b => b.ban))
      
      // For each banned champion, check availability in each game
      for (const champ of bannedChamps) {
        champStats[champ] = { banned: 0, available: 0 }
      }
      
      // Group bans by game instance (every 3 bans = 1 game)
      // Actually, we store each ban separately with its unavailable list
      // We need to track unique games
      const gameInstances: { unavailable: Set<string> }[] = []
      let currentUnavailable: string | null = null
      
      for (const banEntry of bans) {
        // Detect new game by checking if unavailable list changed
        const unavailableKey = banEntry.unavailable.sort().join(',')
        if (currentUnavailable === null || currentUnavailable !== unavailableKey) {
          gameInstances.push({ unavailable: new Set(banEntry.unavailable) })
          currentUnavailable = unavailableKey
        }
        
        // Count this ban
        champStats[banEntry.ban].banned++
      }
      
      // For each champion, count how many games it was available
      for (const champ of bannedChamps) {
        for (const game of gameInstances) {
          if (!game.unavailable.has(champ)) {
            champStats[champ].available++
          }
        }
      }
      
      return Object.entries(champStats)
        .filter(([_, stats]) => stats.available > 0) // Only show champs that were available at least once
        .map(([champion, stats]) => ({
          champion,
          count: stats.banned,
          percentage: (stats.banned / stats.available) * 100, // % of times banned when available
        }))
        .sort((a, b) => b.percentage - a.percentage)
        .slice(0, 10)
    }
    
    // Calculate second ban phase patterns - "When we pick X, we tend to ban Y"
    const calcSecondBanPhasePatterns = () => {
      return Object.entries(secondBanPhaseReactions)
        .filter(([_, bans]) => bans.length >= 2) // Need at least 2 samples
        .map(([ourPick, ourBans]) => {
          // Count frequency of each ban we make
          const banCounts: { [champ: string]: number } = {}
          for (const ban of ourBans) {
            banCounts[ban] = (banCounts[ban] || 0) + 1
          }
          
          // Calculate sample size (number of games where we picked this champ)
          // Each game contributes 2 bans, so divide by 2
          const sampleSize = Math.floor(ourBans.length / 2)
          
          return {
            ifWePick: ourPick,
            weBan: Object.entries(banCounts)
              .map(([champion, count]) => ({
                champion,
                count,
                percentage: (count / sampleSize) * 100, // % of games with this pick that we banned this
              }))
              .sort((a, b) => b.percentage - a.percentage)
              .slice(0, 5), // Top 5 bans
            sampleSize,
          }
        })
        .sort((a, b) => b.sampleSize - a.sampleSize)
        .slice(0, 15) // Top 15 picks by sample size
    }
    
    report.banPhaseStats = {
      totalGames,
      firstPickGames,
      secondPickGames,
      bansByGame: {
        game1: calcGame1Bans(),
        game2: calcGameNBans(game2Bans, game2Count),
        game3: calcGameNBans(game3Bans, game3Count),
      },
      secondBanPhasePatterns: calcSecondBanPhasePatterns(),
      firstPick: {
        priorityBans: calcFreq(firstPickBans.all, firstPickGames),
        ban1: calcFreq(firstPickBans.ban1, firstPickBans.ban1.length),
        ban2: calcFreq(firstPickBans.ban2, firstPickBans.ban2.length),
        ban3: calcFreq(firstPickBans.ban3, firstPickBans.ban3.length),
        adaptiveBans: calcAdaptive(firstPickAdaptive),
        firstPicks: calcPickRateWhenAvailable(fpChampAvailability),
      },
      secondPick: {
        priorityBans: calcFreq(secondPickBans.all, secondPickGames),
        ban1: calcFreq(secondPickBans.ban1, secondPickBans.ban1.length),
        ban2: calcFreq(secondPickBans.ban2, secondPickBans.ban2.length),
        ban3: calcFreq(secondPickBans.ban3, secondPickBans.ban3.length),
        adaptiveBans: calcAdaptive(secondPickAdaptive),
        firstPicks: calcPickRateWhenAvailable(spChampAvailability),
        pickPairs: calcPairFreq(spPickPairs, secondPickGames),
        adaptivePicks: calcAdaptivePicks(spAdaptivePicks),
      },
    }
  }
  
  return report
}

/**
 * Helper to collect all analytics data of a specific type
 */
function collectAnalyticsData(
  results: { analytics: AnalyticsOutput }[],
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
 * Calculate average of an array
 */
function average(nums: number[]): number {
  if (nums.length === 0) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}
