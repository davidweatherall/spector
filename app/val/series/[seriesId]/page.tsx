'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import layoutStyles from '../../../components/GamePageLayout.module.css'
import styles from '../../../lol/series/[seriesId]/SeriesPage.module.css'

// Valorant streamlined types
interface ValorantStreamlinedSeries {
  seriesId: string
  teams: ValorantTeam[]
  mapVeto: MapVetoAction[]
  games: ValorantGame[]
}

interface ValorantTeam {
  id: string
  name: string
  players: ValorantPlayer[]
}

interface ValorantPlayer {
  id: string
  name: string
}

interface MapVetoAction {
  sequenceNumber: number
  occurredAt: string
  action: 'ban' | 'pick' | 'decider'
  mapId: string
  teamId: string | null
  teamName: string | null
}

interface ValorantGame {
  gameNumber: number
  mapId: string
  startedAt: string | null
  winnerTeamId: string | null
  rounds: ValorantRound[]
}

interface ValorantRound {
  roundNumber: number
  winnerTeamId: string
  winnerTeamName: string
  winType: string
  purchases: RoundPurchase[]
}

interface RoundPurchase {
  playerId: string
  playerName: string
  teamId: string
  items: string[]
}

export default function ValorantSeriesPage() {
  const params = useParams()
  const seriesId = params.seriesId as string
  
  const [seriesData, setSeriesData] = useState<ValorantStreamlinedSeries | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedGames, setExpandedGames] = useState<Set<number>>(new Set())

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      setError(null)

      try {
        // Use the Valorant-specific convert endpoint
        const res = await fetch(`/api/val/series/${seriesId}/convert`)
        
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

  // Toggle game expansion
  const toggleGame = (gameNumber: number) => {
    setExpandedGames(prev => {
      const next = new Set(prev)
      if (next.has(gameNumber)) {
        next.delete(gameNumber)
      } else {
        next.add(gameNumber)
      }
      return next
    })
  }

  // Get team by ID
  const getTeam = (teamId: string | null): ValorantTeam | undefined => {
    if (!teamId) return undefined
    return seriesData?.teams.find(t => t.id === teamId)
  }

  // Format map name for display
  const formatMapName = (mapId: string): string => {
    return mapId.charAt(0).toUpperCase() + mapId.slice(1)
  }

  // Get action color class
  const getActionClass = (action: MapVetoAction['action']): string => {
    switch (action) {
      case 'ban': return styles.vetoActionBan
      case 'pick': return styles.vetoActionPick
      case 'decider': return styles.vetoActionDecider
      default: return ''
    }
  }

  // Format win type for display
  const formatWinType = (winType: string): string => {
    switch (winType) {
      case 'opponentEliminated': return 'Elimination'
      case 'bombExploded': return 'Spike Detonated'
      case 'bombDefused': return 'Spike Defused'
      case 'timeExpired': return 'Time Expired'
      default: return winType
    }
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
            <div className={styles.loading}>
              <div className={styles.loadingSpinner} />
              <span>Fetching and converting Valorant data...</span>
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
                  <span>Series ID: {seriesData.seriesId}</span>
                  <span>Maps: {seriesData.games.length}</span>
                </div>
              </div>

              {/* Teams Summary */}
              <div className={styles.teamsSummary}>
                {seriesData.teams.map((team, index) => (
                  <div key={team.id} className={styles.teamScore}>
                    <span className={styles.teamName}>{team.name}</span>
                    {team.players.length > 0 && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                        ({team.players.map(p => p.name).join(', ')})
                      </span>
                    )}
                  </div>
                )).reduce((prev, curr, i) => 
                  i === 0 ? [curr] : [...prev, <span key={`div-${i}`} className={styles.scoreDivider}>vs</span>, curr], 
                  [] as React.ReactNode[]
                )}
              </div>

              {/* Map Veto Section */}
              <div className={styles.gameCard}>
                <div className={styles.gameHeader}>
                  <h3 className={styles.gameTitle}>Map Veto</h3>
                </div>
                <div className={styles.gameContent}>
                  <table className={styles.vetoTable}>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Action</th>
                        <th>Map</th>
                        <th>Team</th>
                      </tr>
                    </thead>
                    <tbody>
                      {seriesData.mapVeto.map((action) => (
                        <tr key={action.sequenceNumber}>
                          <td className={styles.vetoSequence}>{action.sequenceNumber}</td>
                          <td>
                            <span className={`${styles.vetoAction} ${getActionClass(action.action)}`}>
                              {action.action.toUpperCase()}
                            </span>
                          </td>
                          <td className={styles.vetoMap}>{formatMapName(action.mapId)}</td>
                          <td className={styles.vetoTeam}>
                            {action.teamName || <span className={styles.vetoAuto}>Auto</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Games/Maps List */}
              <div className={styles.gamesList}>
                {seriesData.games.map((game) => {
                  const winnerTeam = getTeam(game.winnerTeamId)
                  const isExpanded = expandedGames.has(game.gameNumber)
                  
                  return (
                    <div key={game.gameNumber} className={styles.gameCard}>
                      <div 
                        className={styles.gameHeader} 
                        onClick={() => toggleGame(game.gameNumber)}
                        style={{ cursor: 'pointer' }}
                      >
                        <h3 className={styles.gameTitle}>
                          Game {game.gameNumber}: {formatMapName(game.mapId)}
                          <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem' }}>
                            {isExpanded ? '▼' : '▶'} ({game.rounds?.length || 0} rounds)
                          </span>
                        </h3>
                        <div className={styles.gameInfo}>
                          {winnerTeam && (
                            <span className={styles.gameWinner}>
                              Winner: {winnerTeam.name}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {isExpanded && game.rounds && (
                        <div className={styles.gameContent}>
                          <table className={styles.vetoTable}>
                            <thead>
                              <tr>
                                <th>Round</th>
                                <th>Winner</th>
                                <th>Win Type</th>
                                <th>Purchases</th>
                              </tr>
                            </thead>
                            <tbody>
                              {game.rounds.map((round) => (
                                <tr key={round.roundNumber}>
                                  <td style={{ fontWeight: 'bold' }}>{round.roundNumber}</td>
                                  <td>{round.winnerTeamName}</td>
                                  <td>
                                    <span style={{ 
                                      padding: '2px 6px', 
                                      borderRadius: '4px',
                                      fontSize: '0.75rem',
                                      background: round.winType === 'opponentEliminated' 
                                        ? 'rgba(239, 68, 68, 0.2)' 
                                        : round.winType === 'bombExploded'
                                        ? 'rgba(249, 115, 22, 0.2)'
                                        : round.winType === 'bombDefused'
                                        ? 'rgba(34, 197, 94, 0.2)'
                                        : 'rgba(156, 163, 175, 0.2)'
                                    }}>
                                      {formatWinType(round.winType)}
                                    </span>
                                  </td>
                                  <td style={{ fontSize: '0.75rem', maxWidth: '400px' }}>
                                    {round.purchases.length > 0 ? (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                        {round.purchases.map((purchase, idx) => (
                                          <div key={idx}>
                                            <strong>{purchase.playerName}:</strong>{' '}
                                            {purchase.items.join(', ')}
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <span style={{ color: 'var(--text-tertiary)' }}>No purchases</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Raw Data Debug */}
              <div className={styles.gameCard} style={{ marginTop: '2rem' }}>
                <div className={styles.gameHeader}>
                  <h3 className={styles.gameTitle}>Raw Data (Debug)</h3>
                </div>
                <div className={styles.gameContent}>
                  <pre style={{ 
                    fontSize: '0.7rem', 
                    overflow: 'auto', 
                    maxHeight: '400px',
                    background: 'rgba(0,0,0,0.3)',
                    padding: '1rem',
                    borderRadius: '4px'
                  }}>
                    {JSON.stringify(seriesData, null, 2)}
                  </pre>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

    </div>
  )
}
