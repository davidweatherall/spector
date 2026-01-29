'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import layoutStyles from '../../../components/GamePageLayout.module.css'
import styles from '../../../lol/series/[seriesId]/SeriesPage.module.css'

// Streamlined types from converter
interface StreamlinedSeries {
  teams: StreamlinedTeam[]
  games: StreamlinedGame[]
}

interface StreamlinedTeam {
  name: string
  id: string
  players: StreamlinedPlayer[]
}

interface StreamlinedPlayer {
  name: string
  id: string
}

interface StreamlinedGame {
  id: string
  blueSideTeamId: string
  winnerTeamId: string | null
  gameLength: number
  startTime: string
  players: GamePlayerInfo[]
  draftingActions: DraftingAction[]
  events: GameEvent[]
}

interface GamePlayerInfo {
  id: string
  name: string
  champName: string
  teamId: string
}

interface DraftingAction {
  teamId: string
  champName: string
  action: 'ban' | 'pick'
}

interface GameEvent {
  type: string
  playerId?: string
  targetId?: string
  itemName?: string
  monsterName?: string
  towerName?: string
  inhibitorName?: string
  newLevel?: number
  assistPlayerIds?: string[]
  time: number
}

export default function SeriesPage() {
  const params = useParams()
  const seriesId = params.seriesId as string
  
  const [seriesData, setSeriesData] = useState<StreamlinedSeries | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      setError(null)

      try {
        const res = await fetch(`/api/grid/series/${seriesId}/convert`)
        
        if (!res.ok) {
          throw new Error('Failed to fetch series data')
        }

        const result = await res.json()
        if (result.error) {
          throw new Error(result.error)
        }
        
        setSeriesData(result.data)
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

  // Get team name by ID
  const getTeamName = (teamId: string): string => {
    const team = seriesData?.teams.find(t => t.id === teamId)
    return team?.name || teamId
  }

  // Get team side for a game
  const getTeamSide = (game: StreamlinedGame, teamId: string): 'blue' | 'red' => {
    return game.blueSideTeamId === teamId ? 'blue' : 'red'
  }

  // Group consecutive draft actions by the same team
  interface DraftGroup {
    teamId: string
    type: 'ban' | 'pick'
    actions: DraftingAction[]
  }

  const groupDraftActions = (actions: DraftingAction[]): DraftGroup[] => {
    if (!actions || actions.length === 0) return []

    const groups: DraftGroup[] = []
    let currentGroup: DraftGroup | null = null

    for (const action of actions) {
      if (
        !currentGroup ||
        currentGroup.teamId !== action.teamId ||
        currentGroup.type !== action.action
      ) {
        if (currentGroup) {
          groups.push(currentGroup)
        }
        currentGroup = {
          teamId: action.teamId,
          type: action.action,
          actions: [action],
        }
      } else {
        currentGroup.actions.push(action)
      }
    }

    if (currentGroup) {
      groups.push(currentGroup)
    }

    return groups
  }

  const renderDraftTimeline = (game: StreamlinedGame) => {
    if (!game.draftingActions || game.draftingActions.length === 0) {
      return <p style={{ color: 'var(--text-tertiary)' }}>No draft data available</p>
    }

    const groups = groupDraftActions(game.draftingActions)
    
    const blueTeamId = game.blueSideTeamId
    const redTeamId = seriesData?.teams.find(t => t.id !== blueTeamId)?.id || ''

    let lastType: 'ban' | 'pick' | null = null
    let lastTeamId: string | null = null
    let sequenceNumber = 0

    return (
      <div className={styles.draftTimeline}>
        {/* Team Headers */}
        <div className={styles.draftTeamHeaders}>
          <div className={styles.draftTeamLabel}>
            <span className={`${styles.draftTeamName} ${styles.blue}`}>
              {getTeamName(blueTeamId)}
            </span>
            <span className={styles.draftTeamSide}>Attackers</span>
          </div>
          <div className={`${styles.draftTeamLabel} ${styles.right}`}>
            <span className={`${styles.draftTeamName} ${styles.red}`}>
              {getTeamName(redTeamId)}
            </span>
            <span className={styles.draftTeamSide}>Defenders</span>
          </div>
        </div>

        {/* Horizontal Draft Row */}
        <div className={styles.draftHorizontalRow}>
          {groups.map((group, groupIndex) => {
            const side = getTeamSide(game, group.teamId)
            const showPhaseDivider = lastType !== null && lastType !== group.type
            const showGroupSeparator = !showPhaseDivider && lastTeamId !== null && lastTeamId !== group.teamId
            
            lastType = group.type
            lastTeamId = group.teamId

            return (
              <div key={groupIndex} style={{ display: 'contents' }}>
                {showPhaseDivider && (
                  <div className={styles.phaseDivider}>
                    <div className={styles.phaseDividerLine} />
                  </div>
                )}
                
                {showGroupSeparator && (
                  <div className={styles.groupSeparator} />
                )}
                
                {/* Agents - text only for Valorant */}
                {group.actions.map((action, actionIndex) => {
                  sequenceNumber++
                  return (
                    <div 
                      key={`${groupIndex}-${actionIndex}`}
                      className={`${styles.draftChampionHorizontal} ${styles[side]} ${styles[action.action]}`}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        width: 'auto',
                        minWidth: '36px',
                        padding: '0.25rem 0.5rem',
                        background: 'rgba(255, 255, 255, 0.05)'
                      }}
                    >
                      <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>
                        {action.champName}
                      </span>
                      <span className={styles.seqBadge}>{sequenceNumber}</span>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const formatGameLength = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const renderEvents = (events: GameEvent[]) => {
    if (!events || events.length === 0) {
      return <p style={{ color: 'var(--text-tertiary)' }}>No events recorded</p>
    }

    return (
      <div className={styles.eventsList}>
        {events.map((event, index) => {
          const { time, type, ...eventData } = event
          const eventJson = Object.keys(eventData).length > 0 
            ? JSON.stringify(eventData) 
            : ''
          
          return (
            <div key={index} className={styles.eventRow}>
              <span className={styles.eventTime}>[{formatTime(time)}]</span>
              <span className={styles.eventType}>{type}</span>
              {eventJson && (
                <span className={styles.eventData}>{eventJson}</span>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  // Calculate series score
  const getSeriesScore = () => {
    if (!seriesData) return { team1: 0, team2: 0 }
    
    const team1Id = seriesData.teams[0]?.id
    const team2Id = seriesData.teams[1]?.id
    
    let team1Wins = 0
    let team2Wins = 0
    
    for (const game of seriesData.games) {
      if (game.winnerTeamId === team1Id) team1Wins++
      else if (game.winnerTeamId === team2Id) team2Wins++
    }
    
    return { team1: team1Wins, team2: team2Wins }
  }

  const score = getSeriesScore()
  const seriesWinner = score.team1 > score.team2 
    ? seriesData?.teams[0]?.id 
    : score.team2 > score.team1 
      ? seriesData?.teams[1]?.id 
      : null

  return (
    <div className={layoutStyles.container}>
      <header className={layoutStyles.header}>
        <Link href="/" className={layoutStyles.logo}>
          SPECTOR
        </Link>
        <h1 className={`${layoutStyles.pageTitle} ${layoutStyles.pageTitleVal}`}>
          SERIES
        </h1>
        <Link 
          href="/val" 
          className={`${layoutStyles.switchButton} ${layoutStyles.switchButtonVal}`}
        >
          Back to Valorant
        </Link>
      </header>

      <div className={`${layoutStyles.accentBar} ${layoutStyles.accentBarVal}`} />

      <main className={layoutStyles.main}>
        <div className={layoutStyles.contentSection}>
          {loading && (
            <div className={styles.loading}>
              <div className={styles.loadingSpinner} />
              <span>Fetching and converting data...</span>
            </div>
          )}
          
          {error && (
            <div className={styles.error}>{error}</div>
          )}
          
          {seriesData && (
            <>
              {/* Series Header */}
              <div className={styles.seriesHeader}>
                <h2 className={styles.seriesTitle}>
                  {seriesData.teams.map(t => t.name).join(' vs ')}
                </h2>
                <div className={styles.seriesMeta}>
                  <span>Games: {seriesData.games.length}</span>
                  {seriesData.games[0]?.startTime && (
                    <span>
                      {new Date(seriesData.games[0].startTime).toLocaleDateString('en-US', {
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
                {seriesData.teams.map((team, index) => {
                  const isWinner = team.id === seriesWinner
                  const teamScore = index === 0 ? score.team1 : score.team2
                  
                  return (
                    <div 
                      key={team.id} 
                      className={`${styles.teamScore} ${isWinner ? styles.winner : ''}`}
                    >
                      <span className={styles.teamName}>{team.name}</span>
                      <span className={styles.score}>{teamScore}</span>
                      {isWinner && <span className={styles.winnerBadge}>Winner</span>}
                    </div>
                  )
                }).reduce((prev, curr, i) => 
                  i === 0 ? [curr] : [...prev, <span key={`div-${i}`} className={styles.scoreDivider}>-</span>, curr], 
                  [] as React.ReactNode[]
                )}
              </div>

              {/* Games */}
              <div className={styles.gamesList}>
                {seriesData.games.map((game, index) => {
                  const winnerName = game.winnerTeamId ? getTeamName(game.winnerTeamId) : null
                  
                  return (
                    <div key={game.id} className={styles.gameCard}>
                      <div className={styles.gameHeader}>
                        <h3 className={styles.gameTitle}>
                          Game {index + 1}
                        </h3>
                        <div className={styles.gameInfo}>
                          <span className={styles.gameLength}>
                            {formatGameLength(game.gameLength)}
                          </span>
                          {winnerName && (
                            <span className={styles.gameWinner}>
                              Winner: {winnerName}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className={styles.gameContent}>
                        {renderDraftTimeline(game)}
                        
                        {/* Events Section */}
                        <div className={styles.eventsSection}>
                          <h4 className={styles.eventsSectionTitle}>Events:</h4>
                          {renderEvents(game.events)}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
