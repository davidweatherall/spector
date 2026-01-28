'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import layoutStyles from '../../../components/GamePageLayout.module.css'
import styles from './SeriesPage.module.css'
import { formatDuration } from '../../../types/seriesEndState'
import { getChampionImagePath } from '../../../utils/championMapping'

interface DraftAction {
  id: string
  sequenceNumber: string
  type: 'ban' | 'pick'
  drafter: {
    id: string
    type: string
  }
  draftable: {
    id: string
    name: string
    type: string
  }
}

interface GameTeam {
  id: string
  name?: string
  side?: 'blue' | 'red'
  won?: boolean
}

interface Game {
  id: string
  sequenceNumber: number
  finished?: boolean
  started?: boolean
  teams?: GameTeam[]
  draftActions?: DraftAction[]
}

interface SeriesTeam {
  id?: string
  name: string
  score: number
  won: boolean
}

interface SeriesEndState {
  seriesState: {
    id: string
    format: string
    finished?: boolean
    duration: string
    started?: boolean
    startedAt?: string
    teams: SeriesTeam[]
    games: Game[]
  }
}

export default function SeriesPage() {
  const params = useParams()
  const seriesId = params.seriesId as string
  
  const [endState, setEndState] = useState<SeriesEndState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [eventsDownloaded, setEventsDownloaded] = useState(false)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      setError(null)

      try {
        const [endStateRes, eventsRes] = await Promise.all([
          fetch(`/api/grid/series/${seriesId}/end-state`),
          fetch(`/api/grid/series/${seriesId}/events`),
        ])

        if (!endStateRes.ok) {
          throw new Error('Failed to fetch end-state')
        }

        const endStateData = await endStateRes.json()
        if (endStateData.error) {
          throw new Error(endStateData.error)
        }
        setEndState(endStateData.data)

        if (eventsRes.ok) {
          const eventsData = await eventsRes.json()
          setEventsDownloaded(eventsData.downloaded)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load series data')
      } finally {
        setLoading(false)
      }
    }

    if (seriesId) {
      fetchData()
    }
  }, [seriesId])

  // Create a map of team IDs to team info
  const teamMap = useMemo(() => {
    if (!endState) return new Map<string, { name: string; side: 'blue' | 'red' }>()
    
    const map = new Map<string, { name: string; side: 'blue' | 'red' }>()
    const seriesTeams = endState.seriesState.teams || []
    
    const firstGame = endState.seriesState.games?.[0]
    if (firstGame?.teams) {
      firstGame.teams.forEach((team, index) => {
        const seriesTeam = seriesTeams[index]
        map.set(team.id, {
          name: seriesTeam?.name || team.name || `Team ${index + 1}`,
          side: team.side || (index === 0 ? 'blue' : 'red')
        })
      })
    }
    
    // Fallback: use series teams if game teams not available
    if (map.size === 0 && seriesTeams.length >= 2) {
      // Try to find team IDs from draft actions
      const firstGameDraft = endState.seriesState.games?.[0]?.draftActions
      if (firstGameDraft && firstGameDraft.length > 0) {
        const teamIds = Array.from(new Set(firstGameDraft.map(a => a.drafter.id)))
        teamIds.forEach((id, index) => {
          map.set(id, {
            name: seriesTeams[index]?.name || `Team ${index + 1}`,
            side: index === 0 ? 'blue' : 'red'
          })
        })
      }
    }
    
    return map
  }, [endState])

  const getTeamName = (teamId: string): string => {
    return teamMap.get(teamId)?.name || teamId
  }

  const getTeamSide = (teamId: string): 'blue' | 'red' => {
    return teamMap.get(teamId)?.side || 'blue'
  }

  // Group consecutive draft actions by the same team
  interface DraftGroup {
    teamId: string
    type: 'ban' | 'pick'
    actions: DraftAction[]
    startSeq: number
    endSeq: number
  }

  const groupDraftActions = (actions: DraftAction[]): DraftGroup[] => {
    if (!actions || actions.length === 0) return []

    // Sort by sequence number
    const sorted = [...actions].sort(
      (a, b) => parseInt(a.sequenceNumber) - parseInt(b.sequenceNumber)
    )

    const groups: DraftGroup[] = []
    let currentGroup: DraftGroup | null = null

    for (const action of sorted) {
      // Check if we should start a new group
      if (
        !currentGroup ||
        currentGroup.teamId !== action.drafter.id ||
        currentGroup.type !== action.type
      ) {
        // Save current group if exists
        if (currentGroup) {
          groups.push(currentGroup)
        }
        // Start new group
        currentGroup = {
          teamId: action.drafter.id,
          type: action.type,
          actions: [action],
          startSeq: parseInt(action.sequenceNumber),
          endSeq: parseInt(action.sequenceNumber),
        }
      } else {
        // Add to current group
        currentGroup.actions.push(action)
        currentGroup.endSeq = parseInt(action.sequenceNumber)
      }
    }

    // Don't forget the last group
    if (currentGroup) {
      groups.push(currentGroup)
    }

    return groups
  }

  const renderDraftTimeline = (game: Game) => {
    if (!game.draftActions || game.draftActions.length === 0) {
      return <p style={{ color: 'var(--text-tertiary)' }}>No draft data available</p>
    }

    const groups = groupDraftActions(game.draftActions)
    
    // Get team IDs for headers
    const teamIds = Array.from(new Set(game.draftActions.map(a => a.drafter.id)))
    const team1Id = teamIds[0]
    const team2Id = teamIds[1]

    // Track last type and team for separators
    let lastType: 'ban' | 'pick' | null = null
    let lastTeamId: string | null = null

    return (
      <div className={styles.draftTimeline}>
        {/* Team Headers */}
        <div className={styles.draftTeamHeaders}>
          <div className={styles.draftTeamLabel}>
            <span className={`${styles.draftTeamName} ${styles.blue}`}>
              {getTeamName(team1Id)}
            </span>
            <span className={styles.draftTeamSide}>Blue Side</span>
          </div>
          <div className={`${styles.draftTeamLabel} ${styles.right}`}>
            <span className={`${styles.draftTeamName} ${styles.red}`}>
              {getTeamName(team2Id)}
            </span>
            <span className={styles.draftTeamSide}>Red Side</span>
          </div>
        </div>

        {/* Horizontal Draft Row */}
        <div className={styles.draftHorizontalRow}>
          {groups.map((group, groupIndex) => {
            const side = getTeamSide(group.teamId)
            const showPhaseDivider = lastType !== null && lastType !== group.type
            const showGroupSeparator = !showPhaseDivider && lastTeamId !== null && lastTeamId !== group.teamId
            
            lastType = group.type
            lastTeamId = group.teamId

            return (
              <div key={groupIndex} style={{ display: 'contents' }}>
                {/* Phase divider (ban to pick) */}
                {showPhaseDivider && (
                  <div className={styles.phaseDivider}>
                    <div className={styles.phaseDividerLine} />
                  </div>
                )}
                
                {/* Group separator (team change within same phase) */}
                {showGroupSeparator && (
                  <div className={styles.groupSeparator} />
                )}
                
                {/* Champions in this group */}
                {group.actions.map(action => (
                  <div 
                    key={action.id} 
                    className={`${styles.draftChampionHorizontal} ${styles[side]} ${styles[action.type]}`}
                  >
                    <Image
                      src={getChampionImagePath(action.draftable.name)}
                      alt={action.draftable.name}
                      width={36}
                      height={36}
                      unoptimized
                    />
                    <span className={styles.championTooltip}>{action.draftable.name}</span>
                    <span className={styles.seqBadge}>{action.sequenceNumber}</span>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const getGameWinner = (game: Game): string | null => {
    if (!game.teams) return null
    const winner = game.teams.find(t => t.won)
    if (winner) {
      return getTeamName(winner.id)
    }
    return null
  }

  return (
    <div className={layoutStyles.container}>
      <header className={layoutStyles.header}>
        <Link href="/" className={layoutStyles.logo}>
          SPECTOR
        </Link>
        <h1 className={`${layoutStyles.pageTitle} ${layoutStyles.pageTitleLol}`}>
          SERIES
        </h1>
        <Link 
          href="/lol" 
          className={`${layoutStyles.switchButton} ${layoutStyles.switchButtonLol}`}
        >
          Back to League
        </Link>
      </header>

      <div className={`${layoutStyles.accentBar} ${layoutStyles.accentBarLol}`} />

      <main className={layoutStyles.main}>
        <div className={layoutStyles.contentSection}>
          {loading && (
            <div className={styles.loading}>Loading series data...</div>
          )}
          
          {error && (
            <div className={styles.error}>{error}</div>
          )}
          
          {endState && (
            <>
              {/* Series Header */}
              <div className={styles.seriesHeader}>
                <h2 className={styles.seriesTitle}>
                  {endState.seriesState.teams.map(t => t.name).join(' vs ')}
                </h2>
                <div className={styles.seriesMeta}>
                  <span>Format: {endState.seriesState.format}</span>
                  <span>Duration: {formatDuration(endState.seriesState.duration)}</span>
                  {endState.seriesState.startedAt && (
                    <span>
                      {new Date(endState.seriesState.startedAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </span>
                  )}
                </div>
              </div>

              {/* Teams Score Summary */}
              <div className={styles.teamsSummary}>
                {endState.seriesState.teams.map((team, index) => (
                  <div 
                    key={index} 
                    className={`${styles.teamScore} ${team.won ? styles.winner : ''}`}
                  >
                    <span className={styles.teamName}>{team.name}</span>
                    <span className={styles.score}>{team.score}</span>
                    {team.won && <span className={styles.winnerBadge}>Winner</span>}
                  </div>
                )).reduce((prev, curr, i) => 
                  i === 0 ? [curr] : [...prev, <span key={`div-${i}`} className={styles.scoreDivider}>-</span>, curr], 
                  [] as React.ReactNode[]
                )}
              </div>

              {/* Games */}
              <div className={styles.gamesList}>
                {endState.seriesState.games?.map((game, index) => {
                  const winner = getGameWinner(game)
                  
                  return (
                    <div key={game.id} className={styles.gameCard}>
                      <div className={styles.gameHeader}>
                        <h3 className={styles.gameTitle}>
                          Game {game.sequenceNumber || index + 1}
                        </h3>
                        {winner && (
                          <span className={styles.gameWinner}>
                            Winner: {winner}
                          </span>
                        )}
                      </div>
                      <div className={styles.gameContent}>
                        {renderDraftTimeline(game)}
                      </div>
                    </div>
                  )
                })}
              </div>

              {eventsDownloaded && (
                <div className={styles.eventsStatus}>
                  Events data downloaded to server
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}
