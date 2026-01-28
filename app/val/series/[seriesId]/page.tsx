'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import layoutStyles from '../../../components/GamePageLayout.module.css'
import styles from '../../../lol/series/[seriesId]/SeriesPage.module.css'
import { formatDuration } from '../../../types/seriesEndState'

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
    
    if (map.size === 0 && seriesTeams.length >= 2) {
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

  // For Valorant, we don't have champion images - just show agent names
  const renderDraftSummary = (game: Game) => {
    if (!game.draftActions || game.draftActions.length === 0) {
      return <p style={{ color: 'var(--text-tertiary)' }}>No draft data available</p>
    }

    const teamIds = Array.from(new Set(game.draftActions.map(a => a.drafter.id)))
    const team1Id = teamIds[0]
    const team2Id = teamIds[1]

    const team1Actions = game.draftActions.filter(a => a.drafter.id === team1Id)
    const team2Actions = game.draftActions.filter(a => a.drafter.id === team2Id)

    const team1Bans = team1Actions.filter(a => a.type === 'ban')
    const team1Picks = team1Actions.filter(a => a.type === 'pick')
    const team2Bans = team2Actions.filter(a => a.type === 'ban')
    const team2Picks = team2Actions.filter(a => a.type === 'pick')

    return (
      <div className={styles.draftSummary}>
        {/* Team 1 */}
        <div className={styles.draftTeamColumn}>
          <div className={styles.draftTeamHeader}>
            <span className={`${styles.draftTeamName} ${styles.blue}`}>
              {getTeamName(team1Id)}
            </span>
            <span className={styles.draftTeamSide}>Attackers</span>
          </div>
          
          {team1Bans.length > 0 && (
            <div className={styles.draftCategory}>
              <span className={styles.draftCategoryTitle}>Bans</span>
              <div className={styles.draftCategoryItems}>
                {team1Bans.map(action => (
                  <div key={action.id} className={`${styles.championCard} ${styles.ban}`}>
                    <span className={styles.championName}>{action.draftable.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className={styles.draftCategory}>
            <span className={styles.draftCategoryTitle}>Picks</span>
            <div className={styles.draftCategoryItems}>
              {team1Picks.map(action => (
                <div key={action.id} className={`${styles.championCard} ${styles.pick}`}>
                  <span className={styles.championName}>{action.draftable.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Team 2 */}
        <div className={`${styles.draftTeamColumn} ${styles.right}`}>
          <div className={styles.draftTeamHeader}>
            <span className={`${styles.draftTeamName} ${styles.red}`}>
              {getTeamName(team2Id)}
            </span>
            <span className={styles.draftTeamSide}>Defenders</span>
          </div>
          
          {team2Bans.length > 0 && (
            <div className={styles.draftCategory}>
              <span className={styles.draftCategoryTitle}>Bans</span>
              <div className={styles.draftCategoryItems}>
                {team2Bans.map(action => (
                  <div key={action.id} className={`${styles.championCard} ${styles.ban}`}>
                    <span className={styles.championName}>{action.draftable.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className={styles.draftCategory}>
            <span className={styles.draftCategoryTitle}>Picks</span>
            <div className={styles.draftCategoryItems}>
              {team2Picks.map(action => (
                <div key={action.id} className={`${styles.championCard} ${styles.pick}`}>
                  <span className={styles.championName}>{action.draftable.name}</span>
                </div>
              ))}
            </div>
          </div>
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
            <div className={styles.loading}>Loading series data...</div>
          )}
          
          {error && (
            <div className={styles.error}>{error}</div>
          )}
          
          {endState && (
            <>
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
                        {renderDraftSummary(game)}
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
