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
  
  // Ban Phase Analysis
  banPhaseStats: {
    totalGames: number
    // Most common first bans overall
    mostCommonFirstBans: { champion: string; count: number; percentage: number }[]
    // Priority bans (high frequency across all positions)
    priorityBans: { champion: string; count: number; percentage: number }[]
    // Bans by position when first pick
    firstPickBans: {
      ban1: { champion: string; count: number; percentage: number }[]
      ban2: { champion: string; count: number; percentage: number }[]
      ban3: { champion: string; count: number; percentage: number }[]
    }
    // Bans by position when second pick
    secondPickBans: {
      ban1: { champion: string; count: number; percentage: number }[]
      ban2: { champion: string; count: number; percentage: number }[]
      ban3: { champion: string; count: number; percentage: number }[]
    }
    // Adaptive banning - reactions to enemy bans
    adaptiveBans: {
      ifEnemyBans: string
      thenWeBan: { champion: string; count: number; percentage: number }[]
      sampleSize: number
    }[]
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
    banPhaseStats: null,
    seriesBreakdown: analyticsResults.map(r => {
      // Get draft data for this series
      const draftData = r.analytics.results.find(res => res.name === 'draftAnalysis')?.data
      const games: { gameNumber: number; isFirstPick: boolean; ourBans: string[]; ourPicks: string[]; enemyBans: string[]; enemyPicks: string[] }[] = []
      
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
              if (player.role === 'mid') midGolds.push(player.holdingGoldWhenDrakeDies)
              if (player.role === 'bot') adcGolds.push(player.holdingGoldWhenDrakeDies)
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
  
  // Aggregate ban phase stats - only for our team
  const banPhaseData = collectAnalyticsData(analyticsResults, 'banPhaseAnalysis')
  if (banPhaseData.length > 0) {
    // Collect all ban data from series where our team was analyzed
    const allFirstBans: string[] = []
    const allBans: string[] = []
    const firstPickBan1: string[] = []
    const firstPickBan2: string[] = []
    const firstPickBan3: string[] = []
    const secondPickBan1: string[] = []
    const secondPickBan2: string[] = []
    const secondPickBan3: string[] = []
    const adaptiveReactions: { [enemyBan: string]: string[] } = {}
    let totalGames = 0
    
    for (const data of banPhaseData) {
      if (data.teams) {
        // Find our team's data
        const ourTeamData = data.teams.find((t: any) => t.teamId === teamId)
        if (ourTeamData) {
          totalGames += ourTeamData.totalGames
          
          // Collect ban sequences
          for (const seq of ourTeamData.banSequences || []) {
            if (seq.ourBans[0]) allFirstBans.push(seq.ourBans[0])
            allBans.push(...seq.ourBans)
            
            if (seq.isFirstPick) {
              if (seq.ourBans[0]) firstPickBan1.push(seq.ourBans[0])
              if (seq.ourBans[1]) firstPickBan2.push(seq.ourBans[1])
              if (seq.ourBans[2]) firstPickBan3.push(seq.ourBans[2])
              // Track adaptive reactions (when FP, we react to enemy ban1 with our ban2)
              if (seq.enemyBans[0] && seq.ourBans[1]) {
                if (!adaptiveReactions[seq.enemyBans[0]]) adaptiveReactions[seq.enemyBans[0]] = []
                adaptiveReactions[seq.enemyBans[0]].push(seq.ourBans[1])
              }
            } else {
              if (seq.ourBans[0]) secondPickBan1.push(seq.ourBans[0])
              if (seq.ourBans[1]) secondPickBan2.push(seq.ourBans[1])
              if (seq.ourBans[2]) secondPickBan3.push(seq.ourBans[2])
              // Track adaptive reactions (when SP, we react to enemy ban1 with our ban1)
              if (seq.enemyBans[0] && seq.ourBans[0]) {
                if (!adaptiveReactions[seq.enemyBans[0]]) adaptiveReactions[seq.enemyBans[0]] = []
                adaptiveReactions[seq.enemyBans[0]].push(seq.ourBans[0])
              }
            }
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
    
    // Calculate adaptive bans
    const adaptiveBans = Object.entries(adaptiveReactions)
      .filter(([_, reactions]) => reactions.length >= 2)
      .map(([enemyBan, reactions]) => ({
        ifEnemyBans: enemyBan,
        thenWeBan: calcFreq(reactions, reactions.length).slice(0, 5),
        sampleSize: reactions.length,
      }))
      .sort((a, b) => b.sampleSize - a.sampleSize)
      .slice(0, 10)
    
    report.banPhaseStats = {
      totalGames,
      mostCommonFirstBans: calcFreq(allFirstBans, totalGames),
      priorityBans: calcFreq(allBans, totalGames),
      firstPickBans: {
        ban1: calcFreq(firstPickBan1, firstPickBan1.length),
        ban2: calcFreq(firstPickBan2, firstPickBan2.length),
        ban3: calcFreq(firstPickBan3, firstPickBan3.length),
      },
      secondPickBans: {
        ban1: calcFreq(secondPickBan1, secondPickBan1.length),
        ban2: calcFreq(secondPickBan2, secondPickBan2.length),
        ban3: calcFreq(secondPickBan3, secondPickBan3.length),
      },
      adaptiveBans,
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
