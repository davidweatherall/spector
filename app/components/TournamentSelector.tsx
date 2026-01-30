'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useGridData, Tournament, Team } from '../contexts/GridDataContext'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { getChampionImagePath } from '../utils/championMapping'
import styles from './TournamentSelector.module.css'

interface TournamentSelectorProps {
  game: 'lol' | 'valorant'
}

interface ScoutingReport {
  teamName: string
  seriesAnalyzed: number
  generatedAt: string
  counterPickStats: any
  drakePrioStats: any
  supportGrubStats: any
  adcGrubStats: any
  goldLeadAt15ByRole: any
  drakeGoldHoldingStats: any
  comebackStats: any
  seriesBreakdown: any[]
}

export default function TournamentSelector({ game }: TournamentSelectorProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [isGamesExpanded, setIsGamesExpanded] = useState(true)
  const [scoutingLoading, setScoutingLoading] = useState(false)
  const [scoutingProgress, setScoutingProgress] = useState(0)
  const [scoutingTotal, setScoutingTotal] = useState(0)
  const [currentAnalyzingId, setCurrentAnalyzingId] = useState<string | null>(null)
  const [completedSeriesIds, setCompletedSeriesIds] = useState<Set<string>>(new Set())
  const [scoutingReport, setScoutingReport] = useState<ScoutingReport | null>(null)
  const [scoutingError, setScoutingError] = useState<string | null>(null)
  const [selectedGoldLeadRole, setSelectedGoldLeadRole] = useState<'top' | 'jungle' | 'mid' | 'bot' | 'support'>('mid')
  const [selectedCounterPickTab, setSelectedCounterPickTab] = useState<'top-cp' | 'top-cpd' | 'mid-cp' | 'mid-cpd'>('mid-cp')
  const [selectedBanPhaseTab, setSelectedBanPhaseTab] = useState<'fp1' | 'fp2' | 'fp3' | 'sp1' | 'sp2' | 'sp3'>('fp1')
  
  const {
    lolData,
    lolLoading,
    lolError,
    fetchLolData,
    selectedLolLeagues,
    toggleLolLeague,
    selectedLolTournaments,
    toggleLolTournament,
    lolTeams,
    lolTeamsLoading,
    lolTeamsError,
    fetchLolTeams,
    selectedLolTeam,
    setSelectedLolTeam,
    lolGames,
    lolGamesLoading,
    lolGamesError,
    fetchLolGames,
    valData,
    valLoading,
    valError,
    fetchValData,
    selectedValLeagues,
    toggleValLeague,
    selectedValTournaments,
    toggleValTournament,
    valTeams,
    valTeamsLoading,
    valTeamsError,
    fetchValTeams,
    selectedValTeam,
    setSelectedValTeam,
    valGames,
    valGamesLoading,
    valGamesError,
    fetchValGames,
  } = useGridData()

  const data = game === 'lol' ? lolData : valData
  const loading = game === 'lol' ? lolLoading : valLoading
  const error = game === 'lol' ? lolError : valError
  const selectedLeagues = game === 'lol' ? selectedLolLeagues : selectedValLeagues
  const toggleLeague = game === 'lol' ? toggleLolLeague : toggleValLeague
  const selectedTournaments = game === 'lol' ? selectedLolTournaments : selectedValTournaments
  const toggleTournament = game === 'lol' ? toggleLolTournament : toggleValTournament
  const fetchData = game === 'lol' ? fetchLolData : fetchValData
  const teams = game === 'lol' ? lolTeams : valTeams
  const teamsLoading = game === 'lol' ? lolTeamsLoading : valTeamsLoading
  const teamsError = game === 'lol' ? lolTeamsError : valTeamsError
  const fetchTeams = game === 'lol' ? fetchLolTeams : fetchValTeams
  const selectedTeam = game === 'lol' ? selectedLolTeam : selectedValTeam
  const setSelectedTeam = game === 'lol' ? setSelectedLolTeam : setSelectedValTeam
  const games = game === 'lol' ? lolGames : valGames
  const gamesLoading = game === 'lol' ? lolGamesLoading : valGamesLoading
  const gamesError = game === 'lol' ? lolGamesError : valGamesError
  const fetchGames = game === 'lol' ? fetchLolGames : fetchValGames

  useEffect(() => {
    if (!data && !loading && !error) {
      fetchData()
    }
  }, [data, loading, error, fetchData])

  const handleLeagueToggle = (league: string) => {
    toggleLeague(league)
  }

  const handleTournamentToggle = (tournament: Tournament) => {
    toggleTournament(tournament)
  }

  const handleFindTeams = () => {
    fetchTeams()
  }

  const handleTeamSelect = (team: Team) => {
    if (selectedTeam?.id === team.id) {
      setSelectedTeam(null)
      setScoutingReport(null)
    } else {
      setSelectedTeam(team)
      setScoutingReport(null)
    }
  }

  const handleGenerateScoutingReport = async () => {
    if (!selectedTeam || games.length === 0) return
    
    setScoutingLoading(true)
    setScoutingError(null)
    setScoutingProgress(0)
    setScoutingTotal(games.length)
    setCompletedSeriesIds(new Set())
    setCurrentAnalyzingId(null)
    
    try {
      // Process each series one by one to show progress
      const seriesList: { id: string; opponent: string; date: string }[] = []
      
      for (let i = 0; i < games.length; i++) {
        const gameItem = games[i]
        setCurrentAnalyzingId(gameItem.id)
        setScoutingProgress(i)
        
        // Call API to analyze this series (will convert if needed)
        const analyzeResponse = await fetch('/api/scouting-report/analyze-series', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ seriesId: gameItem.id }),
        })
        
        if (!analyzeResponse.ok) {
          console.error(`Failed to analyze series ${gameItem.id}`)
        } else {
          const result = await analyzeResponse.json()
          
          // Only delay if it was a cache miss (made external API calls)
          if (!result.cacheHit && i < games.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500))
          }
        }
        
        seriesList.push({
          id: gameItem.id,
          opponent: gameItem.opponent?.name || 'Unknown',
          date: gameItem.date || '',
        })
        
        // Mark as completed
        setCompletedSeriesIds(prev => new Set([...prev, gameItem.id]))
      }
      
      setCurrentAnalyzingId(null)
      setScoutingProgress(games.length)
      
      // Now aggregate all analytics into the report
      const response = await fetch('/api/scouting-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: selectedTeam.id,
          teamName: selectedTeam.name,
          seriesList,
        }),
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to generate report')
      }
      
      const data = await response.json()
      setScoutingReport(data.report)
    } catch (error) {
      console.error('Error generating scouting report:', error)
      setScoutingError(error instanceof Error ? error.message : 'Unknown error')
    } finally {
      setScoutingLoading(false)
      setCurrentAnalyzingId(null)
    }
  }

  const isLeagueSelected = (league: string) => {
    return selectedLeagues.includes(league)
  }

  const isTournamentSelected = (tournament: Tournament) => {
    return selectedTournaments.some(t => t.id === tournament.id)
  }

  const isTeamSelected = (team: Team) => {
    return selectedTeam?.id === team.id
  }

  const accentClass = game === 'lol' ? styles.lolAccent : styles.valAccent
  
  // Get tournaments from all selected leagues
  const tournamentsForSelectedLeagues = selectedLeagues.length > 0 && data
    ? selectedLeagues.flatMap(league => data.tournamentsByLeague[league] || [])
    : []

  // Format date for display
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'TBD'
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    })
  }

  return (
    <div className={styles.wrapper}>
      {/* Filters Panel */}
      <div className={styles.container}>
        {/* Header with toggle */}
        <button 
          className={styles.header}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <span className={styles.headerTitle}>Filters</span>
          <span className={styles.headerSummary}>
            {selectedLeagues.length > 0 && `${selectedLeagues.length} leagues`}
            {selectedLeagues.length > 0 && selectedTournaments.length > 0 && ' · '}
            {selectedTournaments.length > 0 && `${selectedTournaments.length} tournaments`}
            {teams.length > 0 && ` · ${teams.length} teams`}
            {selectedTeam && ` · ${selectedTeam.name}`}
          </span>
          <svg 
            className={`${styles.chevron} ${isExpanded ? styles.chevronExpanded : ''}`}
            width="16" 
            height="16" 
            viewBox="0 0 16 16" 
            fill="none"
          >
            <path 
              d="M4 6L8 10L12 6" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {/* Collapsible content */}
        {isExpanded && (
          <div className={styles.filtersGrid}>
            {/* Leagues Column */}
            <div className={styles.column}>
              <label className={styles.label}>
                Leagues
                <span className={styles.count}>({selectedLeagues.length})</span>
              </label>
              {loading ? (
                <div className={styles.loadingText}>Loading...</div>
              ) : (
                <div className={`${styles.list} ${accentClass}`}>
                  {data?.leagues.map((league) => (
                    <label 
                      key={league} 
                      className={`${styles.checkboxItem} ${isLeagueSelected(league) ? styles.checked : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={isLeagueSelected(league)}
                        onChange={() => handleLeagueToggle(league)}
                        className={styles.checkbox}
                      />
                      <span className={styles.checkboxCustom}>
                        {isLeagueSelected(league) && (
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                            <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </span>
                      <span className={styles.checkboxLabel}>{league}</span>
                    </label>
                  ))}
                </div>
              )}
              {error && <p className={styles.error}>{error}</p>}
            </div>

            {/* Tournaments Column */}
            <div className={styles.column}>
              <label className={styles.label}>
                Tournaments
                <span className={styles.count}>({selectedTournaments.length})</span>
              </label>
              {selectedLeagues.length === 0 ? (
                <div className={styles.placeholder}>Select leagues first</div>
              ) : tournamentsForSelectedLeagues.length === 0 ? (
                <div className={styles.placeholder}>No tournaments found</div>
              ) : (
                <div className={`${styles.list} ${accentClass}`}>
                  {tournamentsForSelectedLeagues.map((tournament) => (
                    <label 
                      key={tournament.id} 
                      className={`${styles.checkboxItem} ${isTournamentSelected(tournament) ? styles.checked : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={isTournamentSelected(tournament)}
                        onChange={() => handleTournamentToggle(tournament)}
                        className={styles.checkbox}
                      />
                      <span className={styles.checkboxCustom}>
                        {isTournamentSelected(tournament) && (
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                            <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </span>
                      <span className={styles.checkboxLabel}>
                        {tournament.name}
                        {tournament.isLive && <span className={styles.liveBadge}>LIVE</span>}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Teams Column */}
            <div className={styles.column}>
              <div className={styles.teamsHeader}>
                <label className={styles.label}>
                  Teams
                  <span className={styles.count}>({teams.length})</span>
                </label>
                {selectedTournaments.length > 0 && teams.length === 0 && (
                  <button
                    className={`${styles.findButton} ${accentClass}`}
                    onClick={handleFindTeams}
                    disabled={teamsLoading}
                  >
                    {teamsLoading ? 'Loading...' : 'Find Teams'}
                  </button>
                )}
              </div>
              {teamsError ? (
                <div className={styles.error}>{teamsError}</div>
              ) : teams.length === 0 ? (
                <div className={styles.placeholder}>
                  {selectedTournaments.length === 0 
                    ? 'Select tournaments first' 
                    : 'Click "Find Teams" to load'}
                </div>
              ) : (
                <div className={`${styles.list} ${accentClass}`}>
                  {teams.map((team) => (
                    <button
                      key={team.id}
                      className={`${styles.teamButton} ${isTeamSelected(team) ? styles.teamSelected : ''}`}
                      onClick={() => handleTeamSelect(team)}
                    >
                      {team.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Games Panel */}
      {selectedTeam && (
        <div className={styles.gamesPanel}>
          <button 
            className={styles.gamesPanelHeader}
            onClick={() => setIsGamesExpanded(!isGamesExpanded)}
          >
            <h3 className={styles.gamesPanelTitle}>
              {selectedTeam.name}
              {games.length > 0 && (
                <span className={styles.gamesCount}>{games.length} Games</span>
              )}
            </h3>
            <div className={styles.headerButtons}>
              <button
                className={`${styles.fetchGamesButton} ${accentClass}`}
                onClick={(e) => { e.stopPropagation(); fetchGames(); }}
                disabled={gamesLoading}
              >
                {gamesLoading ? 'Loading...' : games.length > 0 ? 'Refetch Games' : 'Fetch Games'}
              </button>
              {games.length > 0 && (
                <button
                  className={`${styles.scoutingButton} ${scoutingLoading ? styles.scoutingButtonLoading : ''}`}
                  onClick={(e) => { e.stopPropagation(); handleGenerateScoutingReport(); }}
                  disabled={scoutingLoading}
                >
                  {scoutingLoading ? 'Generating...' : 'Generate Scouting Report'}
                </button>
              )}
            </div>
            <svg 
              className={`${styles.chevron} ${isGamesExpanded ? styles.chevronExpanded : ''}`}
              width="16" 
              height="16" 
              viewBox="0 0 16 16" 
              fill="none"
            >
              <path 
                d="M4 6L8 10L12 6" 
                stroke="currentColor" 
                strokeWidth="1.5" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
            </svg>
          </button>
          
          {isGamesExpanded && (
            <>
              {gamesLoading ? (
                <div className={styles.gamesLoading}>Loading games...</div>
              ) : gamesError ? (
                <div className={styles.error}>{gamesError}</div>
              ) : games.length === 0 ? (
                <div className={styles.placeholder}>Click "Fetch Games" to load</div>
              ) : (
                <div className={styles.gamesList}>
                  {games.map((gameItem) => {
                    const isAnalyzing = currentAnalyzingId === gameItem.id
                    const isCompleted = completedSeriesIds.has(gameItem.id)
                    
                    // Get draft data from scouting report if available
                    const seriesDraftData = scoutingReport?.seriesBreakdown?.find(
                      (s: any) => s.seriesId === gameItem.id
                    )
                    
                    return (
                      <div key={gameItem.id} className={styles.gameRowContainer}>
                        <Link 
                          href={`/${game === 'lol' ? 'lol' : 'val'}/series/${gameItem.id}`}
                          className={`${styles.gameRow} ${isAnalyzing ? styles.gameRowAnalyzing : ''} ${isCompleted ? styles.gameRowCompleted : ''}`}
                        >
                          <div className={styles.gameDate}>{formatDate(gameItem.date)}</div>
                          <div className={styles.gameMatchup}>
                            <span className={styles.gameTeam}>{selectedTeam.name}</span>
                            <span className={styles.gameVs}>vs</span>
                            <span className={styles.gameOpponent}>{gameItem.opponent.name}</span>
                          </div>
                          <div className={styles.gameTournament}>
                            {isAnalyzing && <span className={styles.analyzingBadge}>Analysing...</span>}
                            {isCompleted && !isAnalyzing && <span className={styles.completedBadge}>✓</span>}
                            {!isAnalyzing && !isCompleted && gameItem.tournament}
                          </div>
                        </Link>
                        
                        {/* Draft info for each game in this series */}
                        {seriesDraftData?.games && seriesDraftData.games.length > 0 && (
                          <div className={styles.draftContainer}>
                            {seriesDraftData.games.map((gameDraft: any) => {
                              // Group consecutive actions by same team and type
                              const groups: { teamId: string; type: string; actions: any[]; isOurTeam: boolean }[] = []
                              let currentGroup: any = null
                              
                              for (const action of gameDraft.draftActions || []) {
                                if (!currentGroup || currentGroup.teamId !== action.teamId || currentGroup.type !== action.action) {
                                  if (currentGroup) groups.push(currentGroup)
                                  currentGroup = { teamId: action.teamId, type: action.action, actions: [action], isOurTeam: action.isOurTeam }
                                } else {
                                  currentGroup.actions.push(action)
                                }
                              }
                              if (currentGroup) groups.push(currentGroup)
                              
                              let lastType: string | null = null
                              
                              return (
                                <div key={gameDraft.gameNumber} className={styles.draftRow}>
                                  <div className={styles.draftGameLabel}>
                                    Game {gameDraft.gameNumber}
                                    <span className={gameDraft.isFirstPick ? styles.firstPick : styles.secondPick}>
                                      {gameDraft.isFirstPick ? 'First Pick' : 'Second Pick'}
                                    </span>
                                  </div>
                                  <div className={styles.draftHorizontalRow}>
                                    {groups.map((group, groupIndex) => {
                                      const showPhaseDivider = lastType !== null && lastType !== group.type
                                      lastType = group.type
                                      
                                      return (
                                        <div key={groupIndex} className={styles.draftGroup}>
                                          {showPhaseDivider && <div className={styles.phaseDivider} />}
                                          {group.actions.map((action: any, actionIndex: number) => (
                                            <div 
                                              key={actionIndex}
                                              className={`${styles.draftChampion} ${group.isOurTeam ? styles.ourTeam : styles.enemyTeam} ${action.action === 'ban' ? styles.ban : styles.pick}`}
                                            >
                                              <Image
                                                src={getChampionImagePath(action.champName)}
                                                alt={action.champName}
                                                width={28}
                                                height={28}
                                                unoptimized
                                              />
                                              <span className={styles.championTooltip}>{action.champName}</span>
                                            </div>
                                          ))}
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Scouting Report Panel */}
      {scoutingLoading && (
        <div className={styles.scoutingPanel}>
          <div className={styles.scoutingProgress}>
            <div className={styles.scoutingProgressTitle}>
              Generating Scouting Report
            </div>
            <div className={styles.scoutingProgressText}>
              Analysing {Math.min(scoutingProgress + 1, scoutingTotal)} of {scoutingTotal} games
            </div>
            <div className={styles.scoutingProgressBar}>
              <div 
                className={styles.scoutingProgressFill} 
                style={{ width: `${scoutingTotal > 0 ? (Math.min(scoutingProgress + 1, scoutingTotal) / scoutingTotal) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {scoutingError && (
        <div className={styles.scoutingPanel}>
          <div className={styles.error} style={{ padding: '1rem' }}>
            Error: {scoutingError}
          </div>
        </div>
      )}

      {scoutingReport && !scoutingLoading && (
        <div className={styles.scoutingPanel}>
          <div className={styles.scoutingPanelHeader}>
            <h3 className={styles.scoutingPanelTitle}>
              Scouting Report: {scoutingReport.teamName}
              <span className={styles.gamesCount}>
                {scoutingReport.seriesAnalyzed} Series Analyzed
              </span>
            </h3>
          </div>
          
          <div className={styles.scoutingContent}>
            {/* Comeback Stats */}
            {scoutingReport.comebackStats && (
              <div className={styles.scoutingCard}>
                <div className={styles.scoutingCardTitle}>Comeback & Lead Stats</div>
                <div className={styles.scoutingStat}>
                  <span className={styles.scoutingStatLabel}>Games Analyzed</span>
                  <span className={styles.scoutingStatValue}>
                    {scoutingReport.comebackStats.totalGames}
                  </span>
                </div>
                <div className={styles.scoutingStat}>
                  <span className={styles.scoutingStatLabel}>Comeback Rate</span>
                  <span className={`${styles.scoutingStatValue} ${styles.scoutingStatPositive}`}>
                    {scoutingReport.comebackStats.comebackRate.toFixed(1)}%
                  </span>
                </div>
                <div className={styles.scoutingStat}>
                  <span className={styles.scoutingStatLabel}>Lead Hold Rate</span>
                  <span className={`${styles.scoutingStatValue} ${styles.scoutingStatPositive}`}>
                    {scoutingReport.comebackStats.leadHoldRate.toFixed(1)}%
                  </span>
                </div>
                <div className={styles.scoutingStat}>
                  <span className={styles.scoutingStatLabel}>Avg Comeback Deficit</span>
                  <span className={styles.scoutingStatValue}>
                    {Math.round(scoutingReport.comebackStats.avgComebackDeficit).toLocaleString()} gold
                  </span>
                </div>
              </div>
            )}

            {/* Gold Lead at 15 by Role */}
            {scoutingReport.goldLeadAt15ByRole && (
              <div className={`${styles.scoutingCard} ${styles.scoutingCardWide}`}>
                <div className={styles.scoutingCardTitle}>Avg Gold Lead at 15 min</div>
                <div className={styles.roleTabs}>
                  {(['top', 'jungle', 'mid', 'bot', 'support'] as const).map((role) => {
                    const roleData = scoutingReport.goldLeadAt15ByRole![role]
                    const displayName = role === 'bot' ? 'ADC' : role.charAt(0).toUpperCase() + role.slice(1)
                    return (
                      <button
                        key={role}
                        className={`${styles.roleTab} ${selectedGoldLeadRole === role ? styles.roleTabActive : ''}`}
                        onClick={() => setSelectedGoldLeadRole(role)}
                      >
                        <span className={styles.roleTabName}>{displayName}</span>
                        <span className={`${styles.roleTabValue} ${roleData.avg >= 0 ? styles.scoutingStatPositive : styles.scoutingStatNegative}`}>
                          {roleData.avg >= 0 ? '+' : ''}{Math.round(roleData.avg).toLocaleString()}
                        </span>
                      </button>
                    )
                  })}
                </div>
                {scoutingReport.goldLeadAt15ByRole[selectedGoldLeadRole].values.length > 0 && (
                  <div className={styles.chartContainer}>
                    <ResponsiveContainer width="100%" height={160}>
                      <LineChart 
                        data={(() => {
                          const values = scoutingReport.goldLeadAt15ByRole![selectedGoldLeadRole].values
                          const sortedValues = [...values].sort((a, b) => a - b)
                          const total = sortedValues.length
                          const p15Index = Math.floor(total * 0.15)
                          const p85Index = Math.ceil(total * 0.85) - 1
                          const filteredValues = sortedValues.slice(p15Index, p85Index + 1)
                          
                          return filteredValues.map((value, idx) => ({
                            gold: value,
                            gameIndex: idx + 1,
                          }))
                        })()}
                        margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
                      >
                        <XAxis 
                          dataKey="gameIndex"
                          type="number"
                          tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
                          axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                          tickLine={false}
                          label={{ value: 'Games (sorted)', position: 'insideBottom', offset: -2, fill: 'var(--text-tertiary)', fontSize: 9 }}
                        />
                        <YAxis 
                          dataKey="gold"
                          tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
                          axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                          tickLine={false}
                          tickFormatter={(value) => `${value >= 0 ? '+' : ''}${(value / 1000).toFixed(1)}k`}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            background: 'rgba(20, 20, 30, 0.95)', 
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '6px',
                            color: 'var(--text-primary)'
                          }}
                          formatter={(value: number, name: string) => {
                            if (name === 'gold') return [`${value >= 0 ? '+' : ''}${value.toLocaleString()}`, 'Gold Lead']
                            return [value, name]
                          }}
                          labelFormatter={(value) => `Game ${value}`}
                        />
                        <ReferenceLine 
                          y={0} 
                          stroke="rgba(255,255,255,0.3)" 
                          strokeDasharray="3 3"
                        />
                        <ReferenceLine 
                          y={scoutingReport.goldLeadAt15ByRole![selectedGoldLeadRole].avg} 
                          stroke="var(--accent-primary)" 
                          strokeDasharray="4 4"
                          label={{ 
                            value: 'Avg', 
                            fill: 'var(--accent-primary)', 
                            fontSize: 10,
                            position: 'right'
                          }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="gold" 
                          stroke="var(--accent-primary)" 
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4, fill: 'var(--accent-primary)' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}

            {/* Support Grub Timing */}
            {scoutingReport.supportGrubStats && scoutingReport.supportGrubStats.avgRecallTimeBeforeGrub !== null && (
              <div className={`${styles.scoutingCard} ${styles.scoutingCardWide}`}>
                <div className={styles.scoutingCardTitle}>Support Grub Recall Timings</div>
                <div className={styles.scoutingStatRow}>
                  <div className={styles.scoutingStat}>
                    <span className={styles.scoutingStatLabel}>Games Analyzed</span>
                    <span className={styles.scoutingStatValue}>
                      {scoutingReport.supportGrubStats.totalGrubs}
                    </span>
                  </div>
                  <div className={styles.scoutingStat}>
                    <span className={styles.scoutingStatLabel}>Avg Recall Time</span>
                    <span className={styles.scoutingStatValue}>
                      {Math.floor(scoutingReport.supportGrubStats.avgRecallTimeBeforeGrub / 60)}:{String(Math.floor(scoutingReport.supportGrubStats.avgRecallTimeBeforeGrub % 60)).padStart(2, '0')}
                    </span>
                  </div>
                </div>
                {scoutingReport.supportGrubStats.recallTimes && scoutingReport.supportGrubStats.recallTimes.length > 0 && (
                  <div className={styles.chartContainer}>
                    <ResponsiveContainer width="100%" height={180}>
                      <LineChart 
                        data={(() => {
                          // Create cumulative distribution data with 15th-85th percentile filter
                          const sortedTimes = [...scoutingReport.supportGrubStats.recallTimes].sort((a: number, b: number) => a - b)
                          const total = sortedTimes.length
                          const p15Index = Math.floor(total * 0.15)
                          const p85Index = Math.ceil(total * 0.85) - 1
                          const filteredTimes = sortedTimes.slice(p15Index, p85Index + 1)
                          
                          return filteredTimes.map((time: number, idx: number) => ({
                            time,
                            timeLabel: `${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, '0')}`,
                            cumulativeGames: p15Index + idx + 1,
                          }))
                        })()}
                        margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
                      >
                        <XAxis 
                          dataKey="time"
                          type="number"
                          domain={['dataMin', 'dataMax']}
                          tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                          axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                          tickLine={false}
                          tickFormatter={(value) => `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`}
                          label={{ value: 'Recall Time (15th-85th %ile)', position: 'insideBottom', offset: -2, fill: 'var(--text-tertiary)', fontSize: 10 }}
                        />
                        <YAxis 
                          tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                          axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                          tickLine={false}
                          allowDecimals={false}
                          label={{ value: 'Games', angle: -90, position: 'insideLeft', fill: 'var(--text-tertiary)', fontSize: 10 }}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            background: 'rgba(20, 20, 30, 0.95)', 
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '6px',
                            color: 'var(--text-primary)'
                          }}
                          formatter={(value: number, name: string) => {
                            if (name === 'cumulativeGames') return [value, 'Total Games']
                            return [value, name]
                          }}
                          labelFormatter={(value) => `Recall: ${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`}
                        />
                        <ReferenceLine 
                          x={scoutingReport.supportGrubStats.avgRecallTimeBeforeGrub} 
                          stroke="var(--accent-primary)" 
                          strokeDasharray="4 4"
                          label={{ 
                            value: 'Avg', 
                            fill: 'var(--accent-primary)', 
                            fontSize: 10,
                            position: 'top'
                          }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="cumulativeGames" 
                          stroke="var(--accent-primary)" 
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4, fill: 'var(--accent-primary)' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}

            {/* Drake Priority */}
            {scoutingReport.drakePrioStats && (
              <div className={styles.scoutingCard}>
                <div className={styles.scoutingCardTitle}>Bot Lane Drake Priority</div>
                <div className={styles.scoutingStat}>
                  <span className={styles.scoutingStatLabel}>Total Drakes</span>
                  <span className={styles.scoutingStatValue}>
                    {scoutingReport.drakePrioStats.totalDrakes}
                  </span>
                </div>
                <div className={styles.scoutingStat}>
                  <span className={styles.scoutingStatLabel}>Times Had Prio</span>
                  <span className={styles.scoutingStatValue}>
                    {scoutingReport.drakePrioStats.drakesWhenNoPrio}
                  </span>
                </div>
                <div className={styles.scoutingStat}>
                  <span className={styles.scoutingStatLabel}>Secured w/ Prio</span>
                  <span className={styles.scoutingStatValue}>
                    {scoutingReport.drakePrioStats.drakesWhenHadPrio}
                  </span>
                </div>
                <div className={styles.scoutingStat}>
                  <span className={styles.scoutingStatLabel}>Secure % w/ Bot Prio</span>
                  <span className={`${styles.scoutingStatValue} ${scoutingReport.drakePrioStats.prioWinRate >= 50 ? styles.scoutingStatPositive : styles.scoutingStatNegative}`}>
                    {scoutingReport.drakePrioStats.prioWinRate.toFixed(1)}%
                  </span>
                </div>
              </div>
            )}

            {/* ADC Grub Presence */}
            {scoutingReport.adcGrubStats && (
              <div className={styles.scoutingCard}>
                <div className={styles.scoutingCardTitle}>ADC Grub Participation</div>
                <div className={styles.scoutingStat}>
                  <span className={styles.scoutingStatLabel}>First Grubs Analyzed</span>
                  <span className={styles.scoutingStatValue}>
                    {scoutingReport.adcGrubStats.totalFirstGrubs}
                  </span>
                </div>
                <div className={styles.scoutingStat}>
                  <span className={styles.scoutingStatLabel}>ADC Present</span>
                  <span className={styles.scoutingStatValue}>
                    {scoutingReport.adcGrubStats.grubsWithAdcPresent}
                  </span>
                </div>
                <div className={styles.scoutingStat}>
                  <span className={styles.scoutingStatLabel}>ADC Present Rate</span>
                  <span className={`${styles.scoutingStatValue} ${
                    scoutingReport.adcGrubStats.adcPresentRate > 50 
                      ? styles.scoutingStatPositive 
                      : styles.scoutingStatNegative
                  }`}>
                    {scoutingReport.adcGrubStats.adcPresentRate.toFixed(1)}%
                  </span>
                </div>
              </div>
            )}

            {/* Drake Gold Holding */}
            {scoutingReport.drakeGoldHoldingStats && (
              <div className={styles.scoutingCard}>
                <div className={styles.scoutingCardTitle}>Gold Held at Drake</div>
                <div className={styles.scoutingStat}>
                  <span className={styles.scoutingStatLabel}>Drakes Analyzed</span>
                  <span className={styles.scoutingStatValue}>
                    {scoutingReport.drakeGoldHoldingStats.totalDrakes}
                  </span>
                </div>
                <div className={styles.scoutingStat}>
                  <span className={styles.scoutingStatLabel}>Avg Mid Gold Held</span>
                  <span className={`${styles.scoutingStatValue} ${
                    scoutingReport.drakeGoldHoldingStats.avgMidGoldHeld > 800 
                      ? styles.scoutingStatNegative 
                      : styles.scoutingStatPositive
                  }`}>
                    {Math.round(scoutingReport.drakeGoldHoldingStats.avgMidGoldHeld).toLocaleString()}
                  </span>
                </div>
                <div className={styles.scoutingStat}>
                  <span className={styles.scoutingStatLabel}>Avg ADC Gold Held</span>
                  <span className={`${styles.scoutingStatValue} ${
                    scoutingReport.drakeGoldHoldingStats.avgAdcGoldHeld > 800 
                      ? styles.scoutingStatNegative 
                      : styles.scoutingStatPositive
                  }`}>
                    {Math.round(scoutingReport.drakeGoldHoldingStats.avgAdcGoldHeld).toLocaleString()}
                  </span>
                </div>
              </div>
            )}

            {/* Counter Pick Stats */}
            {scoutingReport.counterPickStats && (
              <div className={`${styles.scoutingCard} ${styles.scoutingCardWide}`}>
                <div className={styles.scoutingCardTitle}>Counter Pick Performance</div>
                <div className={styles.roleTabs}>
                  {([
                    { key: 'top-cp', label: 'Top (CP)', lane: 'top', type: 'counterPick' },
                    { key: 'top-cpd', label: 'Top (CPd)', lane: 'top', type: 'counterPicked' },
                    { key: 'mid-cp', label: 'Mid (CP)', lane: 'mid', type: 'counterPick' },
                    { key: 'mid-cpd', label: 'Mid (CPd)', lane: 'mid', type: 'counterPicked' },
                  ] as const).map((tab) => {
                    const laneData = tab.lane === 'top' 
                      ? scoutingReport.counterPickStats!.topLane 
                      : scoutingReport.counterPickStats!.midLane
                    const avg = tab.type === 'counterPick' 
                      ? laneData.avgWorthDiffWhenCounterPicking 
                      : laneData.avgWorthDiffWhenCounterPicked
                    return (
                      <button
                        key={tab.key}
                        className={`${styles.roleTab} ${selectedCounterPickTab === tab.key ? styles.roleTabActive : ''}`}
                        onClick={() => setSelectedCounterPickTab(tab.key)}
                      >
                        <span className={styles.roleTabName}>{tab.label}</span>
                        <span className={`${styles.roleTabValue} ${avg >= 0 ? styles.scoutingStatPositive : styles.scoutingStatNegative}`}>
                          {avg >= 0 ? '+' : ''}{Math.round(avg).toLocaleString()}
                        </span>
                      </button>
                    )
                  })}
                </div>
                
                {/* Graph for selected tab */}
                {(() => {
                  const isTop = selectedCounterPickTab.startsWith('top')
                  const isCounterPicking = selectedCounterPickTab.endsWith('-cp')
                  const laneData = isTop 
                    ? scoutingReport.counterPickStats!.topLane 
                    : scoutingReport.counterPickStats!.midLane
                  const values = isCounterPicking ? laneData.counterPickValues : laneData.counterPickedValues
                  const avg = isCounterPicking ? laneData.avgWorthDiffWhenCounterPicking : laneData.avgWorthDiffWhenCounterPicked
                  const gameCount = isCounterPicking ? laneData.gamesAsCounterPick : laneData.gamesCounterPicked
                  const lineColor = isCounterPicking ? '#4ade80' : '#ef4444'
                  const label = isCounterPicking ? 'Counter Picking' : 'Being Counter Picked'
                  
                  if (values.length === 0) {
                    return <div className={styles.placeholder}>No data available</div>
                  }
                  
                  return (
                    <>
                      <div className={styles.scoutingStatRow}>
                        <div className={styles.scoutingStat}>
                          <span className={styles.scoutingStatLabel}>{label}</span>
                          <span className={`${styles.scoutingStatValue} ${avg >= 0 ? styles.scoutingStatPositive : styles.scoutingStatNegative}`}>
                            {avg >= 0 ? '+' : ''}{Math.round(avg).toLocaleString()} gold ({gameCount} games)
                          </span>
                        </div>
                      </div>
                      
                      <div className={styles.chartContainer}>
                        <ResponsiveContainer width="100%" height={140}>
                          <LineChart 
                            data={[...values].sort((a, b) => a - b).map((value, idx) => ({
                              gameIndex: idx + 1,
                              gold: value,
                            }))}
                            margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
                          >
                            <XAxis 
                              dataKey="gameIndex"
                              type="number"
                              tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
                              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                              tickLine={false}
                            />
                            <YAxis 
                              tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
                              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                              tickLine={false}
                              tickFormatter={(value) => `${value >= 0 ? '+' : ''}${(value / 1000).toFixed(1)}k`}
                            />
                            <Tooltip 
                              contentStyle={{ 
                                background: 'rgba(20, 20, 30, 0.95)', 
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '6px',
                                color: 'var(--text-primary)'
                              }}
                              formatter={(value: number) => [`${value >= 0 ? '+' : ''}${value.toLocaleString()}`, 'Gold Diff']}
                              labelFormatter={(value) => `Game ${value}`}
                            />
                            <ReferenceLine 
                              y={0} 
                              stroke="rgba(255,255,255,0.3)" 
                              strokeDasharray="3 3"
                            />
                            <ReferenceLine 
                              y={avg} 
                              stroke={lineColor}
                              strokeDasharray="4 4"
                              label={{ 
                                value: 'Avg', 
                                fill: lineColor, 
                                fontSize: 10,
                                position: 'right'
                              }}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="gold" 
                              stroke={lineColor}
                              strokeWidth={2}
                              dot={false}
                              activeDot={{ r: 4, fill: lineColor }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </>
                  )
                })()}
              </div>
            )}
            
            {/* Ban Phase Analysis */}
            {scoutingReport.banPhaseStats && (
              <div className={`${styles.scoutingCard} ${styles.scoutingCardWide}`}>
                <div className={styles.scoutingCardTitle}>First Ban Phase Analysis ({scoutingReport.banPhaseStats.totalGames} games)</div>
                
                {/* Priority Bans Summary */}
                <div className={styles.banPrioritySection}>
                  <div className={styles.banSectionLabel}>Priority Bans (most banned overall)</div>
                  <div className={styles.banChampList}>
                    {scoutingReport.banPhaseStats.priorityBans.slice(0, 6).map((ban: any, idx: number) => (
                      <div key={ban.champion} className={styles.banChampItem}>
                        <Image
                          src={getChampionImagePath(ban.champion)}
                          alt={ban.champion}
                          width={32}
                          height={32}
                          unoptimized
                        />
                        <span className={styles.banChampPercent}>{Math.round(ban.percentage)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Ban Position Tabs */}
                <div className={styles.banPhaseTabs}>
                  <div className={styles.banPhaseTabGroup}>
                    <span className={styles.banPhaseTabGroupLabel}>First Pick:</span>
                    {(['fp1', 'fp2', 'fp3'] as const).map((tab, idx) => (
                      <button
                        key={tab}
                        className={`${styles.banPhaseTab} ${selectedBanPhaseTab === tab ? styles.banPhaseTabActive : ''}`}
                        onClick={() => setSelectedBanPhaseTab(tab)}
                      >
                        Ban {idx + 1}
                      </button>
                    ))}
                  </div>
                  <div className={styles.banPhaseTabGroup}>
                    <span className={styles.banPhaseTabGroupLabel}>Second Pick:</span>
                    {(['sp1', 'sp2', 'sp3'] as const).map((tab, idx) => (
                      <button
                        key={tab}
                        className={`${styles.banPhaseTab} ${selectedBanPhaseTab === tab ? styles.banPhaseTabActive : ''}`}
                        onClick={() => setSelectedBanPhaseTab(tab)}
                      >
                        Ban {idx + 1}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Ban Position Details */}
                {(() => {
                  const isFirstPick = selectedBanPhaseTab.startsWith('fp')
                  const banNum = parseInt(selectedBanPhaseTab.slice(2)) as 1 | 2 | 3
                  const banKey = `ban${banNum}` as 'ban1' | 'ban2' | 'ban3'
                  const bans = isFirstPick 
                    ? scoutingReport.banPhaseStats!.firstPickBans[banKey]
                    : scoutingReport.banPhaseStats!.secondPickBans[banKey]
                  
                  return (
                    <div className={styles.banPositionDetails}>
                      <div className={styles.banSectionLabel}>
                        {isFirstPick ? 'First Pick' : 'Second Pick'} - Ban #{banNum}
                      </div>
                      <div className={styles.banChampGrid}>
                        {bans.slice(0, 8).map((ban: any) => (
                          <div key={ban.champion} className={styles.banChampCard}>
                            <Image
                              src={getChampionImagePath(ban.champion)}
                              alt={ban.champion}
                              width={40}
                              height={40}
                              unoptimized
                            />
                            <div className={styles.banChampInfo}>
                              <span className={styles.banChampName}>{ban.champion}</span>
                              <span className={styles.banChampStats}>
                                {ban.count} ({Math.round(ban.percentage)}%)
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}
                
                {/* Adaptive Bans */}
                {scoutingReport.banPhaseStats.adaptiveBans.length > 0 && (
                  <div className={styles.adaptiveBansSection}>
                    <div className={styles.banSectionLabel}>Adaptive Banning (reactions to enemy bans)</div>
                    <div className={styles.adaptiveBansList}>
                      {scoutingReport.banPhaseStats.adaptiveBans.slice(0, 5).map((adaptive: any) => (
                        <div key={adaptive.ifEnemyBans} className={styles.adaptiveBanRow}>
                          <div className={styles.adaptiveBanTrigger}>
                            <span className={styles.adaptiveBanLabel}>If enemy bans</span>
                            <Image
                              src={getChampionImagePath(adaptive.ifEnemyBans)}
                              alt={adaptive.ifEnemyBans}
                              width={28}
                              height={28}
                              unoptimized
                            />
                          </div>
                          <span className={styles.adaptiveBanArrow}>→</span>
                          <div className={styles.adaptiveBanResponses}>
                            {adaptive.thenWeBan.slice(0, 3).map((response: any) => (
                              <div key={response.champion} className={styles.adaptiveBanResponse}>
                                <Image
                                  src={getChampionImagePath(response.champion)}
                                  alt={response.champion}
                                  width={24}
                                  height={24}
                                  unoptimized
                                />
                                <span className={styles.adaptiveBanPercent}>{Math.round(response.percentage)}%</span>
                              </div>
                            ))}
                          </div>
                          <span className={styles.adaptiveBanSample}>({adaptive.sampleSize})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
