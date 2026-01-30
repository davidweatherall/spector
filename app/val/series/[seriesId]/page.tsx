'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import layoutStyles from '../../../components/GamePageLayout.module.css'
import styles from '../../../lol/series/[seriesId]/SeriesPage.module.css'
import ValorantMapPlayer from '../../../components/ValorantMapPlayer'

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

interface GamePlayer {
  id: string
  name: string
  teamId: string
  characterId: string
  characterName: string
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
  players: GamePlayer[]
  rounds: ValorantRound[]
}

interface ValorantRound {
  roundNumber: number
  winnerTeamId: string
  winnerTeamName: string
  winType: string
  purchases: RoundPurchase[]
  abilityUsages: AbilityUsage[]
  kills: PlayerKill[]
  bombPlant?: BombPlant
  bombDefuse?: BombDefuse
  coordinateTracking: CoordinateSnapshot[]
}

interface PlayerKill {
  killerId: string
  killerName: string
  victimId: string
  victimName: string
  killerPosition: {
    x: number
    y: number
  }
  victimPosition: {
    x: number
    y: number
  }
  occurredAt: string
}

interface BombPlant {
  playerId: string
  playerName: string
  position: {
    x: number
    y: number
  }
  occurredAt: string
}

interface BombDefuse {
  playerId: string
  playerName: string
  occurredAt: string
}

interface RoundPurchase {
  playerId: string
  playerName: string
  teamId: string
  items: string[]
}

interface AbilityUsage {
  playerId: string
  playerName: string
  abilityId: string
  position: {
    x: number
    y: number
  }
  occurredAt: string
}

interface CoordinateSnapshot {
  time: number
  playerCoordinates: PlayerCoordinate[]
}

interface PlayerCoordinate {
  playerId: string
  x: number
  y: number
}

export default function ValorantSeriesPage() {
  const params = useParams()
  const seriesId = params.seriesId as string
  
  const [seriesData, setSeriesData] = useState<ValorantStreamlinedSeries | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedGames, setExpandedGames] = useState<Set<number>>(new Set())
  const [expandedRounds, setExpandedRounds] = useState<Set<string>>(new Set())
  const [selectedMapRound, setSelectedMapRound] = useState<{ gameNumber: number; roundNumber: number } | null>(null)

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

  // Toggle round expansion (for ability details)
  const toggleRound = (gameNumber: number, roundNumber: number) => {
    const key = `${gameNumber}-${roundNumber}`
    setExpandedRounds(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
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

  // Format ability name
  const formatAbilityName = (abilityId: string): string => {
    return abilityId
      .split(/[-_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
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
                          {/* Player Agents */}
                          {game.players && game.players.length > 0 && (
                            <div style={{ 
                              display: 'flex', 
                              gap: '2rem', 
                              marginBottom: '1rem',
                              padding: '0.75rem 1rem',
                              background: 'rgba(0,0,0,0.2)',
                              borderRadius: '8px',
                            }}>
                              {seriesData.teams.map((team) => {
                                const teamPlayers = game.players.filter(p => p.teamId === team.id)
                                if (teamPlayers.length === 0) return null
                                
                                return (
                                  <div key={team.id} style={{ flex: 1 }}>
                                    <div style={{ 
                                      fontWeight: 'bold', 
                                      marginBottom: '0.5rem',
                                      color: 'var(--text-secondary)',
                                      fontSize: '0.8rem',
                                    }}>
                                      {team.name}
                                    </div>
                                    <div style={{ 
                                      display: 'flex', 
                                      flexWrap: 'wrap',
                                      gap: '0.5rem',
                                    }}>
                                      {teamPlayers.map((player) => (
                                        <div 
                                          key={player.id}
                                          style={{
                                            background: 'rgba(255, 70, 85, 0.15)',
                                            border: '1px solid rgba(255, 70, 85, 0.3)',
                                            borderRadius: '4px',
                                            padding: '4px 8px',
                                            fontSize: '0.75rem',
                                          }}
                                        >
                                          <span style={{ color: '#ff4655', fontWeight: 'bold' }}>
                                            {player.characterName}
                                          </span>
                                          <span style={{ color: 'var(--text-tertiary)', marginLeft: '0.25rem' }}>
                                            ({player.name})
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}

                          <table className={styles.vetoTable}>
                            <thead>
                              <tr>
                                <th>Round</th>
                                <th>Winner</th>
                                <th>Win Type</th>
                                <th>Kills</th>
                                <th>Spike</th>
                                <th>Purchases</th>
                                <th>Abilities</th>
                                <th>Coords</th>
                              </tr>
                            </thead>
                            <tbody>
                              {game.rounds.map((round) => {
                                const roundKey = `${game.gameNumber}-${round.roundNumber}`
                                const isRoundExpanded = expandedRounds.has(roundKey)
                                
                                return (
                                  <>
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
                                      <td style={{ fontSize: '0.75rem' }}>
                                        {round.kills?.length > 0 ? (
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                            {round.kills.map((kill, idx) => (
                                              <div key={idx} style={{ whiteSpace: 'nowrap' }}>
                                                <span style={{ color: '#22c55e' }}>{kill.killerName}</span>
                                                <span style={{ color: 'var(--text-tertiary)', margin: '0 4px' }}>→</span>
                                                <span style={{ color: '#ef4444' }}>{kill.victimName}</span>
                                              </div>
                                            ))}
                                          </div>
                                        ) : (
                                          <span style={{ color: 'var(--text-tertiary)' }}>-</span>
                                        )}
                                      </td>
                                      <td style={{ fontSize: '0.75rem' }}>
                                        {round.bombPlant || round.bombDefuse ? (
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                            {round.bombPlant && (
                                              <div style={{ whiteSpace: 'nowrap' }}>
                                                <span style={{ color: '#f97316' }}>💣 {round.bombPlant.playerName}</span>
                                              </div>
                                            )}
                                            {round.bombDefuse && (
                                              <div style={{ whiteSpace: 'nowrap' }}>
                                                <span style={{ color: '#3b82f6' }}>🛡 {round.bombDefuse.playerName}</span>
                                              </div>
                                            )}
                                          </div>
                                        ) : (
                                          <span style={{ color: 'var(--text-tertiary)' }}>-</span>
                                        )}
                                      </td>
                                      <td style={{ fontSize: '0.75rem', maxWidth: '300px' }}>
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
                                          <span style={{ color: 'var(--text-tertiary)' }}>-</span>
                                        )}
                                      </td>
                                      <td style={{ fontSize: '0.75rem' }}>
                                        {round.abilityUsages?.length > 0 ? (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              toggleRound(game.gameNumber, round.roundNumber)
                                            }}
                                            style={{
                                              background: 'rgba(139, 92, 246, 0.2)',
                                              border: '1px solid rgba(139, 92, 246, 0.3)',
                                              borderRadius: '4px',
                                              padding: '2px 8px',
                                              cursor: 'pointer',
                                              color: '#a78bfa',
                                              fontSize: '0.7rem',
                                            }}
                                          >
                                            {isRoundExpanded ? '▼' : '▶'} {round.abilityUsages.length} abilities
                                          </button>
                                        ) : (
                                          <span style={{ color: 'var(--text-tertiary)' }}>-</span>
                                        )}
                                      </td>
                                      <td style={{ fontSize: '0.7rem' }}>
                                        {round.coordinateTracking?.length > 0 ? (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              setSelectedMapRound(
                                                selectedMapRound?.gameNumber === game.gameNumber && 
                                                selectedMapRound?.roundNumber === round.roundNumber
                                                  ? null
                                                  : { gameNumber: game.gameNumber, roundNumber: round.roundNumber }
                                              )
                                            }}
                                            style={{
                                              background: selectedMapRound?.gameNumber === game.gameNumber && 
                                                         selectedMapRound?.roundNumber === round.roundNumber
                                                ? 'rgba(255, 70, 85, 0.3)'
                                                : 'rgba(255, 70, 85, 0.15)',
                                              border: '1px solid rgba(255, 70, 85, 0.3)',
                                              borderRadius: '4px',
                                              padding: '2px 8px',
                                              cursor: 'pointer',
                                              color: '#ff4655',
                                              fontSize: '0.7rem',
                                            }}
                                          >
                                            {selectedMapRound?.gameNumber === game.gameNumber && 
                                             selectedMapRound?.roundNumber === round.roundNumber ? '✕ Hide' : '🗺 View'} ({round.coordinateTracking.length})
                                          </button>
                                        ) : (
                                          <span style={{ color: 'var(--text-tertiary)' }}>-</span>
                                        )}
                                      </td>
                                    </tr>
                                    {isRoundExpanded && round.abilityUsages?.length > 0 && (
                                      <tr key={`${round.roundNumber}-abilities`}>
                                        <td colSpan={8} style={{ padding: '0.5rem 1rem', background: 'rgba(0,0,0,0.2)' }}>
                                          <div style={{ fontSize: '0.7rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <strong style={{ color: '#a78bfa', marginBottom: '4px' }}>Ability Usage:</strong>
                                            {round.abilityUsages.map((ability, idx) => (
                                              <div key={idx} style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                                <span style={{ minWidth: '80px' }}><strong>{ability.playerName}</strong></span>
                                                <span style={{ 
                                                  background: 'rgba(139, 92, 246, 0.2)', 
                                                  padding: '1px 6px', 
                                                  borderRadius: '3px',
                                                  minWidth: '100px'
                                                }}>
                                                  {formatAbilityName(ability.abilityId)}
                                                </span>
                                                <span style={{ color: 'var(--text-tertiary)' }}>
                                                  x: {ability.position.x.toFixed(0)}, y: {ability.position.y.toFixed(0)}
                                                </span>
                                              </div>
                                            ))}
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                    {selectedMapRound?.gameNumber === game.gameNumber && 
                                     selectedMapRound?.roundNumber === round.roundNumber && (
                                      <tr key={`${round.roundNumber}-map`}>
                                        <td colSpan={8} style={{ padding: '1rem', background: 'rgba(0,0,0,0.3)' }}>
                                          <ValorantMapPlayer
                                            mapName={game.mapId}
                                            coordinateTracking={round.coordinateTracking}
                                            players={seriesData.teams.flatMap(team => 
                                              team.players.map(p => ({
                                                id: p.id,
                                                name: p.name,
                                                teamId: team.id,
                                              }))
                                            )}
                                            team1Id={seriesData.teams[0]?.id || ''}
                                            roundNumber={round.roundNumber}
                                            kills={round.kills}
                                          />
                                        </td>
                                      </tr>
                                    )}
                                  </>
                                )
                              })}
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
