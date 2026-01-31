'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams, useRouter } from 'next/navigation'
import { useGridData, Tournament, Team } from '../contexts/GridDataContext'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { getChampionImagePath } from '../utils/championMapping'
import styles from './TournamentSelector.module.css'

// Helper to get Valorant agent image path
const getAgentImagePath = (agentName: string): string => {
  // Normalize: lowercase and remove special chars (e.g., 'kay/o' -> 'kayo')
  const lowerName = agentName.toLowerCase().replace(/[^a-z]/g, '')
  return `/agents/${lowerName}.png`
}

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
  classWinRateStats: any
  banPhaseStats: any
  seriesBreakdown: any[]
}

interface ValorantScoutingReport {
  teamId: string
  teamName: string
  seriesAnalyzed: number
  mapsPlayed: number
  generatedAt: string
  mapVetoStats: {
    banPhase1: {
      ban1: { mapId: string; mapName: string; count: number; available: number; percentage: number }[]
      ban2: { mapId: string; mapName: string; count: number; percentage: number }[]
      allBans: { mapId: string; mapName: string; count: number; percentage: number }[]
    }
    mapPicks: {
      pick1: { mapId: string; mapName: string; count: number; percentage: number }[]
      pick2: { mapId: string; mapName: string; count: number; percentage: number }[]
      allPicks: { mapId: string; mapName: string; count: number; available: number; percentage: number }[]
    }
    banPhase2: {
      allBans: { mapId: string; mapName: string; count: number; percentage: number }[]
    } | null
    deciderMaps: { mapId: string; mapName: string; count: number; percentage: number }[]
  } | null
  agentStats: {
    overallPicks: { agentId: string; agentName: string; count: number; totalGames: number; percentage: number }[]
    picksByMap: {
      mapId: string
      mapName: string
      gamesPlayed: number
      agentPicks: { agentId: string; agentName: string; count: number; percentage: number }[]
    }[]
    playerPreferences: {
      playerId: string
      playerName: string
      totalMapsPlayed: number
      wins: number
      winPercentage: number
      agentPicks: { agentId: string; agentName: string; count: number; percentage: number }[]
    }[]
  } | null
  seriesBreakdown: {
    seriesId: string
    opponent: string
    date: string
    mapsPlayed: number
    mapVeto: {
      sequenceNumber: number
      action: 'ban' | 'pick' | 'decider'
      mapId: string
      teamId: string | null
      teamName: string | null
      isOurTeam: boolean
    }[]
    games: {
      gameNumber: number
      mapId: string
      winnerTeamId: string | null
      isWin: boolean
      ourAgents: {
        playerId: string
        playerName: string
        agentId: string
        agentName: string
        kills: number
        deaths: number
        attackerKills: number
        attackerDeaths: number
        defenderKills: number
        defenderDeaths: number
      }[]
    }[]
  }[]
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
  const [valScoutingReport, setValScoutingReport] = useState<ValorantScoutingReport | null>(null)
  const [scoutingError, setScoutingError] = useState<string | null>(null)
  const [selectedValMapTab, setSelectedValMapTab] = useState<string | null>(null)
  const [selectedGoldLeadRole, setSelectedGoldLeadRole] = useState<'top' | 'jungle' | 'mid' | 'bot' | 'support'>('mid')
  const [selectedCounterPickTab, setSelectedCounterPickTab] = useState<'top-cp' | 'top-cpd' | 'mid-cp' | 'mid-cpd'>('mid-cp')
  const [selectedBanPhasePickSide, setSelectedBanPhasePickSide] = useState<'first' | 'second'>('first')
  const [selectedBanPosition, setSelectedBanPosition] = useState<1 | 2 | 3>(1)
  
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

  // URL param handling
  const searchParams = useSearchParams()
  const router = useRouter()
  const [hasRestoredFromUrl, setHasRestoredFromUrl] = useState(false)

  // Update URL params when state changes
  const updateUrlParams = useCallback(() => {
    const params = new URLSearchParams()
    
    if (selectedLeagues.length > 0) {
      params.set('leagues', selectedLeagues.join(','))
    }
    if (selectedTournaments.length > 0) {
      params.set('tournaments', selectedTournaments.map(t => t.id).join(','))
    }
    if (selectedTeam) {
      params.set('team', selectedTeam.id)
      params.set('teamName', selectedTeam.name)
    }
    
    const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname
    window.history.replaceState({}, '', newUrl)
  }, [selectedLeagues, selectedTournaments, selectedTeam])

  // Restore state from URL params on mount
  useEffect(() => {
    if (hasRestoredFromUrl || !data) return
    
    const leaguesParam = searchParams.get('leagues')
    const tournamentsParam = searchParams.get('tournaments')
    const teamParam = searchParams.get('team')
    const teamNameParam = searchParams.get('teamName')
    
    // Restore leagues
    if (leaguesParam) {
      const leagues = leaguesParam.split(',')
      for (const league of leagues) {
        if (!selectedLeagues.includes(league)) {
          toggleLeague(league)
        }
      }
    }
    
    // Restore tournaments
    if (tournamentsParam && data) {
      const tournamentIds = tournamentsParam.split(',')
      for (const id of tournamentIds) {
        // Find tournament in data
        for (const league of Object.values(data)) {
          if (!league?.tournaments) continue
          const tournament = league.tournaments.find((t: Tournament) => t.id === id)
          if (tournament && !selectedTournaments.some(t => t.id === id)) {
            toggleTournament(tournament)
          }
        }
      }
    }
    
    // Restore team (we need to fetch teams first if not loaded)
    if (teamParam && teamNameParam) {
      // If tournaments are selected but teams not loaded, fetch them
      if (selectedTournaments.length > 0 && teams.length === 0 && !teamsLoading) {
        fetchTeams()
      }
      // If teams are loaded, find and select the team
      if (teams.length > 0) {
        const team = teams.find(t => t.id === teamParam)
        if (team && (!selectedTeam || selectedTeam.id !== team.id)) {
          setSelectedTeam(team)
        }
      }
    }
    
    if (leaguesParam || tournamentsParam || teamParam) {
      setHasRestoredFromUrl(true)
    }
  }, [data, searchParams, hasRestoredFromUrl, selectedLeagues, selectedTournaments, toggleLeague, toggleTournament, teams, teamsLoading, fetchTeams, selectedTeam, setSelectedTeam])

  // Update URL when selections change (after initial restore)
  useEffect(() => {
    if (hasRestoredFromUrl || (selectedLeagues.length > 0 || selectedTournaments.length > 0 || selectedTeam)) {
      updateUrlParams()
    }
  }, [selectedLeagues, selectedTournaments, selectedTeam, hasRestoredFromUrl, updateUrlParams])

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
      setValScoutingReport(null)
    } else {
      setSelectedTeam(team)
      setScoutingReport(null)
      setValScoutingReport(null)
    }
    // Reset analyzing state when switching teams
    setCompletedSeriesIds(new Set())
    setCurrentAnalyzingId(null)
  }

  // Auto-fetch games when team selection changes
  useEffect(() => {
    if (selectedTeam) {
      fetchGames()
    }
  }, [selectedTeam?.id])

  const handleGenerateScoutingReport = async (limit?: number) => {
    if (!selectedTeam || games.length === 0) return
    
    // Close filters panel when generating report
    setIsExpanded(false)
    
    // Apply limit if specified
    const gamesToAnalyze = limit ? games.slice(0, limit) : games
    
    setScoutingLoading(true)
    setScoutingError(null)
    setScoutingProgress(0)
    setScoutingTotal(gamesToAnalyze.length)
    setCompletedSeriesIds(new Set())
    setCurrentAnalyzingId(null)
    
    try {
      // Process each series one by one to show progress
      const seriesList: { id: string; opponent: string; date: string }[] = []
      
      for (let i = 0; i < gamesToAnalyze.length; i++) {
        const gameItem = gamesToAnalyze[i]
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
          if (!result.cacheHit && i < gamesToAnalyze.length - 1) {
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
      setScoutingProgress(gamesToAnalyze.length)
      
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

  const handleGenerateValScoutingReport = async (limit?: number) => {
    if (!selectedTeam || games.length === 0) return
    
    // Close filters panel when generating report
    setIsExpanded(false)
    
    // Apply limit if specified
    const gamesToAnalyze = limit ? games.slice(0, limit) : games
    
    setScoutingLoading(true)
    setScoutingError(null)
    setScoutingProgress(0)
    setScoutingTotal(gamesToAnalyze.length)
    setCompletedSeriesIds(new Set())
    setCurrentAnalyzingId(null)
    
    try {
      // Process each series one by one to show progress
      const seriesList: { seriesId: string; opponent: string; date: string }[] = []
      
      for (let i = 0; i < gamesToAnalyze.length; i++) {
        const gameItem = gamesToAnalyze[i]
        setCurrentAnalyzingId(gameItem.id)
        setScoutingProgress(i)
        
        // Call Valorant API to analyze this series (will convert if needed)
        const analyzeResponse = await fetch('/api/val/scouting-report/analyze-series', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ seriesId: gameItem.id }),
        })
        
        if (!analyzeResponse.ok) {
          console.error(`Failed to analyze Valorant series ${gameItem.id}`)
        } else {
          const result = await analyzeResponse.json()
          
          // Only delay if it was a cache miss (made external API calls)
          if (!result.cacheHit && i < gamesToAnalyze.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500))
          }
        }
        
        seriesList.push({
          seriesId: gameItem.id,
          opponent: gameItem.opponent?.name || 'Unknown',
          date: gameItem.date || '',
        })
        
        // Mark as completed
        setCompletedSeriesIds(prev => new Set([...prev, gameItem.id]))
      }
      
      setCurrentAnalyzingId(null)
      setScoutingProgress(gamesToAnalyze.length)
      
      // Now aggregate all analytics into the Valorant report
      const response = await fetch('/api/val/scouting-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: selectedTeam.id,
          teamName: selectedTeam.name,
          seriesIds: seriesList,
        }),
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to generate Valorant report')
      }
      
      const data = await response.json()
      setValScoutingReport(data.report)
      
      // Set default map tab if there are maps
      if (data.report?.agentStats?.picksByMap?.length > 0) {
        setSelectedValMapTab(data.report.agentStats.picksByMap[0].mapId)
      }
    } catch (error) {
      console.error('Error generating Valorant scouting report:', error)
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

      {/* Team Actions Panel - CTA for scouting report (LoL only) */}
      {selectedTeam && (
        <div className={styles.teamActionsPanel}>
          <div className={styles.teamActionsHeader}>
            <h3 className={styles.teamActionsTitle}>{selectedTeam.name}</h3>
            {gamesLoading ? (
              <span className={styles.gamesLoadingText}>Loading games...</span>
            ) : gamesError ? (
              <div className={styles.gamesErrorContainer}>
                <span className={styles.gamesErrorText}>{gamesError}</span>
                <button 
                  className={styles.retryButton}
                  onClick={() => fetchGames()}
                >
                  Retry
                </button>
              </div>
            ) : games.length > 0 ? (
              <span className={styles.gamesCount}>{games.length} Games Found</span>
            ) : null}
          </div>
          <div className={styles.teamActionsButtons}>
            <button
              className={`${styles.scoutingButton} ${styles.scoutingButtonQuick} ${scoutingLoading ? styles.scoutingButtonLoading : ''} ${game === 'valorant' ? styles.scoutingButtonVal : ''}`}
              onClick={() => game === 'lol' ? handleGenerateScoutingReport(5) : handleGenerateValScoutingReport(5)}
              disabled={scoutingLoading || games.length === 0}
            >
              {scoutingLoading ? 'Generating...' : 'Quick Report (5 Games)'}
            </button>
            <button
              className={`${styles.scoutingButton} ${scoutingLoading ? styles.scoutingButtonLoading : ''} ${game === 'valorant' ? styles.scoutingButtonVal : ''}`}
              onClick={() => game === 'lol' ? handleGenerateScoutingReport() : handleGenerateValScoutingReport()}
              disabled={scoutingLoading || games.length === 0}
            >
              {scoutingLoading ? 'Generating...' : `Full Report (${games.length} Games)`}
            </button>
          </div>
        </div>
      )}

      {/* Scouting Report Loading Panel */}
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

      {game === 'lol' && scoutingReport && !scoutingLoading && (
        <div className={styles.scoutingPanel}>
          <div className={styles.scoutingPanelHeader}>
            <h3 className={styles.scoutingPanelTitle}>
              Scouting Report: {scoutingReport.teamName}
              <span className={styles.gamesCount}>
                {scoutingReport.seriesAnalyzed} Series Analyzed
              </span>
            </h3>
          </div>
          
          {/* Pick Ban Analysis - Full Width at Top */}
          {scoutingReport.banPhaseStats && (
            <div className={styles.pickBanAnalysis}>
              <div className={styles.pickBanHeader}>
                <h4 className={styles.pickBanTitle}>Pick Ban Analysis</h4>
              </div>
              
              {/* Bans by Game (Fearless Mode) */}
              {scoutingReport.banPhaseStats.bansByGame && (
                <div className={styles.bansByGameSection}>
                  <div className={styles.banSectionLabel}>Bans by Game (Fearless Mode)</div>
                  <div className={styles.bansByGameGrid}>
                    {/* Game 1 */}
                    <div className={styles.bansByGameColumn}>
                      <div className={styles.bansByGameHeader}>Game 1</div>
                      <div className={styles.bansByGameList}>
                        {scoutingReport.banPhaseStats.bansByGame.game1.slice(0, 8).map((ban: any) => (
                          <div key={ban.champion} className={styles.bansByGameItem}>
                            <Image
                              src={getChampionImagePath(ban.champion)}
                              alt={ban.champion}
                              width={24}
                              height={24}
                              unoptimized
                            />
                            <span className={styles.bansByGameName}>{ban.champion}</span>
                            <span className={styles.bansByGamePercent}>{Math.round(ban.percentage)}%</span>
                          </div>
                        ))}
                        {scoutingReport.banPhaseStats.bansByGame.game1.length === 0 && (
                          <span className={styles.noDataText}>No data</span>
                        )}
                      </div>
                    </div>
                    
                    {/* Game 2 */}
                    <div className={styles.bansByGameColumn}>
                      <div className={styles.bansByGameHeader}>Game 2 <span className={styles.bansByGameSubheader}>(when available)</span></div>
                      <div className={styles.bansByGameList}>
                        {scoutingReport.banPhaseStats.bansByGame.game2.slice(0, 8).map((ban: any) => (
                          <div key={ban.champion} className={styles.bansByGameItem}>
                            <Image
                              src={getChampionImagePath(ban.champion)}
                              alt={ban.champion}
                              width={24}
                              height={24}
                              unoptimized
                            />
                            <span className={styles.bansByGameName}>{ban.champion}</span>
                            <span className={styles.bansByGamePercent}>{Math.round(ban.percentage)}%</span>
                          </div>
                        ))}
                        {scoutingReport.banPhaseStats.bansByGame.game2.length === 0 && (
                          <span className={styles.noDataText}>No data</span>
                        )}
                      </div>
                    </div>
                    
                    {/* Game 3+ */}
                    <div className={styles.bansByGameColumn}>
                      <div className={styles.bansByGameHeader}>Game 3+ <span className={styles.bansByGameSubheader}>(when available)</span></div>
                      <div className={styles.bansByGameList}>
                        {scoutingReport.banPhaseStats.bansByGame.game3.slice(0, 8).map((ban: any) => (
                          <div key={ban.champion} className={styles.bansByGameItem}>
                            <Image
                              src={getChampionImagePath(ban.champion)}
                              alt={ban.champion}
                              width={24}
                              height={24}
                              unoptimized
                            />
                            <span className={styles.bansByGameName}>{ban.champion}</span>
                            <span className={styles.bansByGamePercent}>{Math.round(ban.percentage)}%</span>
                          </div>
                        ))}
                        {scoutingReport.banPhaseStats.bansByGame.game3.length === 0 && (
                          <span className={styles.noDataText}>No data</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Second Ban Phase Patterns */}
              {scoutingReport.banPhaseStats.secondBanPhasePatterns && scoutingReport.banPhaseStats.secondBanPhasePatterns.length > 0 && (
                <div className={styles.secondBanPhaseSection}>
                  <div className={styles.banSectionLabel}>Second Ban Phase (When we pick → We tend to ban)</div>
                  <div className={styles.secondBanPhaseGrid}>
                    {scoutingReport.banPhaseStats.secondBanPhasePatterns.slice(0, 8).map((pattern: any) => (
                      <div key={pattern.ifWePick} className={styles.secondBanPhaseCard}>
                        <div className={styles.secondBanPhaseTrigger}>
                          <span className={styles.secondBanPhaseLabel}>If we pick</span>
                          <Image
                            src={getChampionImagePath(pattern.ifWePick)}
                            alt={pattern.ifWePick}
                            width={32}
                            height={32}
                            unoptimized
                          />
                          <span className={styles.secondBanPhaseName}>{pattern.ifWePick}</span>
                          <span className={styles.secondBanPhaseSample}>({pattern.sampleSize})</span>
                        </div>
                        <div className={styles.secondBanPhaseResponses}>
                          {pattern.weBan.slice(0, 3).map((ban: any) => (
                            <div key={ban.champion} className={styles.secondBanPhaseResponse}>
                              <Image
                                src={getChampionImagePath(ban.champion)}
                                alt={ban.champion}
                                width={24}
                                height={24}
                                unoptimized
                              />
                              <span className={styles.secondBanPhaseResponseName}>{ban.champion}</span>
                              <span className={styles.secondBanPhasePercent}>{Math.round(ban.percentage)}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Pick Side Toggle */}
              <div className={styles.pickSideToggleSection}>
                <div className={styles.pickSideToggle}>
                  <button
                    className={`${styles.pickSideButton} ${selectedBanPhasePickSide === 'first' ? styles.pickSideButtonActive : ''}`}
                    onClick={() => setSelectedBanPhasePickSide('first')}
                  >
                    First Pick ({scoutingReport.banPhaseStats.firstPickGames} games)
                  </button>
                  <button
                    className={`${styles.pickSideButton} ${selectedBanPhasePickSide === 'second' ? styles.pickSideButtonActive : ''}`}
                    onClick={() => setSelectedBanPhasePickSide('second')}
                  >
                    Second Pick ({scoutingReport.banPhaseStats.secondPickGames} games)
                  </button>
                </div>
              </div>
              
              {(() => {
                const pickData = selectedBanPhasePickSide === 'first' 
                  ? scoutingReport.banPhaseStats!.firstPick 
                  : scoutingReport.banPhaseStats!.secondPick
                const banKey = `ban${selectedBanPosition}` as 'ban1' | 'ban2' | 'ban3'
                
                return (
                  <div className={styles.pickBanContent}>
                    {/* Priority Bans Summary */}
                    <div className={styles.banPrioritySection}>
                      <div className={styles.banSectionLabel}>Priority Bans</div>
                      <div className={styles.banChampList}>
                        {pickData.priorityBans.slice(0, 6).map((ban: any) => (
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
                        {([1, 2, 3] as const).map((num) => (
                          <button
                            key={num}
                            className={`${styles.banPhaseTab} ${selectedBanPosition === num ? styles.banPhaseTabActive : ''}`}
                            onClick={() => setSelectedBanPosition(num)}
                          >
                            Ban {num}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    {/* Ban Position Details */}
                    <div className={styles.banPositionDetails}>
                      <div className={styles.banSectionLabel}>
                        {selectedBanPhasePickSide === 'first' ? 'First Pick' : 'Second Pick'} - Ban #{selectedBanPosition}
                      </div>
                      <div className={styles.banChampGrid}>
                        {pickData[banKey].slice(0, 8).map((ban: any) => (
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
                    
                    {/* Adaptive Bans */}
                    {pickData.adaptiveBans.length > 0 && (
                      <div className={styles.adaptiveBansSection}>
                        <div className={styles.banSectionLabel}>Adaptive Banning</div>
                        <div className={styles.adaptiveBansList}>
                          {pickData.adaptiveBans.slice(0, 5).map((adaptive: any) => (
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
                    
                    {/* First Picks Section */}
                    {pickData.firstPicks && pickData.firstPicks.length > 0 && (
                      <div className={styles.firstPicksSection}>
                        <div className={styles.banSectionLabel}>
                          Pick Rate When Available
                        </div>
                        <div className={styles.firstPicksGrid}>
                          {pickData.firstPicks.slice(0, 8).map((pick: any) => (
                            <div key={pick.champion} className={styles.firstPickCard}>
                              <Image
                                src={getChampionImagePath(pick.champion)}
                                alt={pick.champion}
                                width={44}
                                height={44}
                                unoptimized
                              />
                              <div className={styles.firstPickInfo}>
                                <span className={styles.firstPickName}>{pick.champion}</span>
                                <span className={styles.firstPickStats}>
                                  {Math.round(pick.percentage)}% ({pick.count}/{pick.available || pick.count})
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        {/* Pick Pairs - only for second pick */}
                        {selectedBanPhasePickSide === 'second' && pickData.pickPairs && pickData.pickPairs.length > 0 && (
                          <div className={styles.pickPairsSection}>
                            <div className={styles.banSectionLabel}>Common Pick Pairs</div>
                            <div className={styles.pickPairsList}>
                              {pickData.pickPairs.slice(0, 5).map((pairData: any, idx: number) => (
                                <div key={idx} className={styles.pickPairRow}>
                                  <div className={styles.pickPairChamps}>
                                    {pairData.pair.map((champ: string) => (
                                      <Image
                                        key={champ}
                                        src={getChampionImagePath(champ)}
                                        alt={champ}
                                        width={32}
                                        height={32}
                                        unoptimized
                                      />
                                    ))}
                                  </div>
                                  <span className={styles.pickPairNames}>
                                    {pairData.pair.join(' + ')}
                                  </span>
                                  <span className={styles.pickPairStats}>
                                    {pairData.count} ({Math.round(pairData.percentage)}%)
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Adaptive Picks - only for second pick */}
                        {selectedBanPhasePickSide === 'second' && pickData.adaptivePicks && pickData.adaptivePicks.length > 0 && (
                          <div className={styles.adaptiveBansSection}>
                            <div className={styles.banSectionLabel}>Adaptive Picking (response to enemy first pick)</div>
                            <div className={styles.adaptiveBansList}>
                              {pickData.adaptivePicks.slice(0, 5).map((adaptive: any) => (
                                <div key={adaptive.ifEnemyPicks} className={styles.adaptiveBanRow}>
                                  <div className={styles.adaptiveBanTrigger}>
                                    <span className={styles.adaptiveBanLabel}>If enemy picks</span>
                                    <Image
                                      src={getChampionImagePath(adaptive.ifEnemyPicks)}
                                      alt={adaptive.ifEnemyPicks}
                                      width={28}
                                      height={28}
                                      unoptimized
                                    />
                                  </div>
                                  <span className={styles.adaptiveBanArrow}>→</span>
                                  <div className={styles.adaptiveBanResponses}>
                                    {adaptive.thenWePick.slice(0, 3).map((response: any) => (
                                      <div key={response.champion} className={styles.adaptivePickResponse}>
                                        <Image
                                          src={getChampionImagePath(response.champion)}
                                          alt={response.champion}
                                          width={24}
                                          height={24}
                                          unoptimized
                                        />
                                        <div className={styles.adaptivePickStats}>
                                          <span className={styles.adaptivePickPercent}>{Math.round(response.percentage)}%</span>
                                          {response.banRate > 0 && (
                                            <span className={styles.adaptiveBanRate}>{Math.round(response.banRate)}% banned</span>
                                          )}
                                        </div>
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
                )
              })()}
            </div>
          )}
          
          <div className={styles.scoutingContent}>
            {/* Game Performance Stats Section */}
            <div className={styles.gameStatsSection}>
              <div className={styles.gameStatsSectionHeader}>
                <h4 className={styles.gameStatsSectionTitle}>Game Performance Stats</h4>
              </div>

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
              
              {/* Class Win Rates */}
              {scoutingReport.classWinRateStats && (
                <div className={styles.classWinRateSection}>
                  <div className={styles.classWinRateGrid}>
                    {/* Top Lane */}
                    <div className={styles.classWinRateColumn}>
                      <div className={styles.classWinRateHeader}>
                        <span className={styles.classWinRateTitle}>Top Lane</span>
                        <span className={styles.classWinRateColumnHeader}>Games</span>
                        <span className={styles.classWinRateColumnHeader}>Win %</span>
                      </div>
                      <div className={styles.classWinRateList}>
                        {scoutingReport.classWinRateStats.top.slice(0, 6).map((stat: any) => (
                          <div key={stat.className} className={styles.classWinRateItem}>
                            <span className={styles.classWinRateName}>{stat.className}</span>
                            <span className={styles.classWinRateGames}>{stat.games}</span>
                            <span className={`${styles.classWinRatePercent} ${stat.winRate >= 50 ? styles.classWinRatePositive : styles.classWinRateNegative}`}>
                              {Math.round(stat.winRate)}%
                            </span>
                          </div>
                        ))}
                        {(!scoutingReport.classWinRateStats.top || scoutingReport.classWinRateStats.top.length === 0) && (
                          <span className={styles.noDataText}>No data</span>
                        )}
                      </div>
                    </div>
                    
                    {/* Jungle */}
                    <div className={styles.classWinRateColumn}>
                      <div className={styles.classWinRateHeader}>
                        <span className={styles.classWinRateTitle}>Jungle</span>
                        <span className={styles.classWinRateColumnHeader}>Games</span>
                        <span className={styles.classWinRateColumnHeader}>Win %</span>
                      </div>
                      <div className={styles.classWinRateList}>
                        {scoutingReport.classWinRateStats.jungle.slice(0, 6).map((stat: any) => (
                          <div key={stat.className} className={styles.classWinRateItem}>
                            <span className={styles.classWinRateName}>{stat.className}</span>
                            <span className={styles.classWinRateGames}>{stat.games}</span>
                            <span className={`${styles.classWinRatePercent} ${stat.winRate >= 50 ? styles.classWinRatePositive : styles.classWinRateNegative}`}>
                              {Math.round(stat.winRate)}%
                            </span>
                          </div>
                        ))}
                        {(!scoutingReport.classWinRateStats.jungle || scoutingReport.classWinRateStats.jungle.length === 0) && (
                          <span className={styles.noDataText}>No data</span>
                        )}
                      </div>
                    </div>
                    
                    {/* Support */}
                    <div className={styles.classWinRateColumn}>
                      <div className={styles.classWinRateHeader}>
                        <span className={styles.classWinRateTitle}>Support</span>
                        <span className={styles.classWinRateColumnHeader}>Games</span>
                        <span className={styles.classWinRateColumnHeader}>Win %</span>
                      </div>
                      <div className={styles.classWinRateList}>
                        {scoutingReport.classWinRateStats.support.slice(0, 6).map((stat: any) => (
                          <div key={stat.className} className={styles.classWinRateItem}>
                            <span className={styles.classWinRateName}>{stat.className}</span>
                            <span className={styles.classWinRateGames}>{stat.games}</span>
                            <span className={`${styles.classWinRatePercent} ${stat.winRate >= 50 ? styles.classWinRatePositive : styles.classWinRateNegative}`}>
                              {Math.round(stat.winRate)}%
                            </span>
                          </div>
                        ))}
                        {(!scoutingReport.classWinRateStats.support || scoutingReport.classWinRateStats.support.length === 0) && (
                          <span className={styles.noDataText}>No data</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Stats Grid */}
              <div className={styles.gameStatsGrid}>
                {/* Left Column */}
                <div className={styles.gameStatsColumn}>
                  {/* Comeback Stats */}
                  {scoutingReport.comebackStats && (
                    <div className={styles.scoutingCard}>
                      <div className={styles.scoutingCardTitle}>Comeback & Lead Stats</div>
                      <div className={styles.scoutingStat}>
                        <span className={styles.scoutingStatLabel}>Games Analyzed</span>
                        <span className={styles.scoutingStatValue}>{scoutingReport.comebackStats.totalGames}</span>
                      </div>
                      <div className={styles.scoutingStat}>
                        <span className={styles.scoutingStatLabel}>Comeback Rate</span>
                        <span className={styles.scoutingStatValue}>{scoutingReport.comebackStats.comebackRate.toFixed(1)}%</span>
                      </div>
                      <div className={styles.scoutingStat}>
                        <span className={styles.scoutingStatLabel}>Lead Hold Rate</span>
                        <span className={styles.scoutingStatValue}>{scoutingReport.comebackStats.leadHoldRate.toFixed(1)}%</span>
                      </div>
                      <div className={styles.scoutingStat}>
                        <span className={styles.scoutingStatLabel}>Avg Comeback Deficit</span>
                        <span className={styles.scoutingStatValue}>{Math.round(scoutingReport.comebackStats.avgComebackDeficit).toLocaleString()} gold</span>
                      </div>
                    </div>
                  )}

                  {/* Drake Priority */}
                  {scoutingReport.drakePrioStats && (
                    <div className={styles.scoutingCard}>
                      <div className={styles.scoutingCardTitle}>Bot Lane Drake Priority</div>
                      <div className={styles.scoutingStat}>
                        <span className={styles.scoutingStatLabel}>Total Drakes</span>
                        <span className={styles.scoutingStatValue}>{scoutingReport.drakePrioStats.totalDrakes}</span>
                      </div>
                      <div className={styles.scoutingStat}>
                        <span className={styles.scoutingStatLabel}>Times Had Prio</span>
                        <span className={styles.scoutingStatValue}>{scoutingReport.drakePrioStats.drakesWhenHadPrio}</span>
                      </div>
                      <div className={styles.scoutingStat}>
                        <span className={styles.scoutingStatLabel}>No Prio</span>
                        <span className={styles.scoutingStatValue}>{scoutingReport.drakePrioStats.drakesWhenNoPrio}</span>
                      </div>
                      <div className={styles.scoutingStat}>
                        <span className={styles.scoutingStatLabel}>Secure % w/ Bot Prio</span>
                        <span className={`${styles.scoutingStatValue} ${scoutingReport.drakePrioStats.prioWinRate >= 50 ? styles.scoutingStatPositive : styles.scoutingStatNegative}`}>
                          {scoutingReport.drakePrioStats.prioWinRate.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  )}

                  {/* ADC Grub Participation */}
                  {scoutingReport.adcGrubStats && (
                    <div className={styles.scoutingCard}>
                      <div className={styles.scoutingCardTitle}>ADC Grub Participation</div>
                      <div className={styles.scoutingStat}>
                        <span className={styles.scoutingStatLabel}>First Grubs Analyzed</span>
                        <span className={styles.scoutingStatValue}>{scoutingReport.adcGrubStats.totalFirstGrubs}</span>
                      </div>
                      <div className={styles.scoutingStat}>
                        <span className={styles.scoutingStatLabel}>ADC Present</span>
                        <span className={styles.scoutingStatValue}>{scoutingReport.adcGrubStats.grubsWithAdcPresent}</span>
                      </div>
                      <div className={styles.scoutingStat}>
                        <span className={styles.scoutingStatLabel}>ADC Present Rate</span>
                        <span className={`${styles.scoutingStatValue} ${scoutingReport.adcGrubStats.adcPresentRate >= 50 ? styles.scoutingStatPositive : styles.scoutingStatNegative}`}>
                          {scoutingReport.adcGrubStats.adcPresentRate.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Gold Held at Drake */}
                  {scoutingReport.drakeGoldHoldingStats && (
                    <div className={styles.scoutingCard}>
                      <div className={styles.scoutingCardTitle}>Gold Held at Drake</div>
                      <div className={styles.scoutingStat}>
                        <span className={styles.scoutingStatLabel}>Drakes Analyzed</span>
                        <span className={styles.scoutingStatValue}>{scoutingReport.drakeGoldHoldingStats.totalDrakes}</span>
                      </div>
                      <div className={styles.scoutingStat}>
                        <span className={styles.scoutingStatLabel}>Avg Mid Gold Held</span>
                        <span className={styles.scoutingStatValue}>{Math.round(scoutingReport.drakeGoldHoldingStats.avgMidGoldHeld)}</span>
                      </div>
                      <div className={styles.scoutingStat}>
                        <span className={styles.scoutingStatLabel}>Avg ADC Gold Held</span>
                        <span className={styles.scoutingStatValue}>{Math.round(scoutingReport.drakeGoldHoldingStats.avgAdcGoldHeld)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Column */}
                <div className={styles.gameStatsColumn}>
            {/* Support Grub Timing */}
            {scoutingReport.supportGrubStats && scoutingReport.supportGrubStats.avgRecallTimeBeforeGrub !== null && (
              <div className={styles.scoutingCard}>
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
                </div>
              </div>
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
            </div>
          </div>
        </div>
      )}

      {/* Valorant Scouting Report Panel */}
      {game === 'valorant' && valScoutingReport && !scoutingLoading && (
        <div className={`${styles.scoutingPanel} ${styles.scoutingPanelVal}`}>
          <div className={styles.scoutingPanelHeader}>
            <h3 className={styles.scoutingPanelTitle}>
              Scouting Report: {valScoutingReport.teamName}
              <span className={styles.gamesCount}>
                {valScoutingReport.seriesAnalyzed} Series · {valScoutingReport.mapsPlayed} Maps
              </span>
            </h3>
          </div>
          
          {/* Map Veto Analysis - only show if there's actual data */}
          {valScoutingReport.mapVetoStats && (
            valScoutingReport.mapVetoStats.banPhase1.ban1.some(b => b.percentage > 0) ||
            valScoutingReport.mapVetoStats.mapPicks.allPicks.some(p => p.percentage > 0)
          ) && (
            <div className={styles.valMapVetoSection}>
              <div className={styles.pickBanHeader}>
                <h4 className={styles.pickBanTitle}>Map Veto Analysis</h4>
              </div>
              
              <div className={styles.valVetoGrid}>
                {/* Ban Phase 1 - First Ban When Available % */}
                <div className={styles.valVetoColumn}>
                  <div className={styles.valVetoColumnHeader}>First Ban When Available %</div>
                  <div className={styles.valVetoList}>
                    {valScoutingReport.mapVetoStats.banPhase1.ban1.filter(b => b.percentage > 0).slice(0, 7).map((ban) => (
                      <div key={ban.mapId} className={styles.valVetoItem}>
                        <span className={styles.valVetoMapName}>{ban.mapName}</span>
                        <div className={styles.valVetoBar}>
                          <div 
                            className={`${styles.valVetoBarFill} ${styles.valVetoBan}`}
                            style={{ width: `${ban.percentage}%` }}
                          />
                        </div>
                        <span className={styles.valVetoPercent} title={`${ban.count}/${ban.available} available`}>
                          {Math.round(ban.percentage)}% ({ban.available})
                        </span>
                      </div>
                    ))}
                    {valScoutingReport.mapVetoStats.banPhase1.ban1.filter(b => b.percentage > 0).length === 0 && (
                      <span className={styles.noDataText}>No data</span>
                    )}
                  </div>
                </div>
                
                {/* Map Picks - Pick When Available % */}
                <div className={styles.valVetoColumn}>
                  <div className={styles.valVetoColumnHeader}>Pick When Available %</div>
                  <div className={styles.valVetoList}>
                    {valScoutingReport.mapVetoStats.mapPicks.allPicks.filter(p => p.percentage > 0).slice(0, 7).map((pick) => (
                      <div key={pick.mapId} className={styles.valVetoItem}>
                        <span className={styles.valVetoMapName}>{pick.mapName}</span>
                        <div className={styles.valVetoBar}>
                          <div 
                            className={`${styles.valVetoBarFill} ${styles.valVetoPick}`}
                            style={{ width: `${pick.percentage}%` }}
                          />
                        </div>
                        <span className={styles.valVetoPercent} title={`${pick.count}/${pick.available} available`}>
                          {Math.round(pick.percentage)}% ({pick.available})
                        </span>
                      </div>
                    ))}
                    {valScoutingReport.mapVetoStats.mapPicks.allPicks.filter(p => p.percentage > 0).length === 0 && (
                      <span className={styles.noDataText}>No data</span>
                    )}
                  </div>
                </div>
                
                {/* Ban Phase 2 (if exists) */}
                {valScoutingReport.mapVetoStats.banPhase2 && (
                  <div className={styles.valVetoColumn}>
                    <div className={styles.valVetoColumnHeader}>Second Bans</div>
                    <div className={styles.valVetoList}>
                      {valScoutingReport.mapVetoStats.banPhase2.allBans.slice(0, 7).map((ban) => (
                        <div key={ban.mapId} className={styles.valVetoItem}>
                          <span className={styles.valVetoMapName}>{ban.mapName}</span>
                          <div className={styles.valVetoBar}>
                            <div 
                              className={`${styles.valVetoBarFill} ${styles.valVetoBan}`}
                              style={{ width: `${ban.percentage}%` }}
                            />
                          </div>
                          <span className={styles.valVetoPercent}>{Math.round(ban.percentage)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Agent Pick Analysis */}
          {valScoutingReport.agentStats && (
            <div className={styles.valAgentSection}>
              <div className={styles.pickBanHeader}>
                <h4 className={styles.pickBanTitle}>Agent Pick Patterns</h4>
              </div>
              
              {/* Overall Agent Picks */}
              <div className={styles.valAgentOverall}>
                <div className={styles.banSectionLabel}>Overall Agent Picks ({valScoutingReport.mapsPlayed} maps)</div>
                <div className={styles.valAgentGrid}>
                  {valScoutingReport.agentStats.overallPicks.slice(0, 12).map((agent) => (
                    <div key={agent.agentId} className={styles.valAgentCard}>
                      <Image
                        src={getAgentImagePath(agent.agentName)}
                        alt={agent.agentName}
                        width={36}
                        height={36}
                        className={styles.valAgentImage}
                        unoptimized
                      />
                      <div className={styles.valAgentInfo}>
                        <span className={styles.valAgentName}>{agent.agentName}</span>
                        <span className={styles.valAgentStats}>
                          {Math.round(agent.percentage)}% ({agent.count}/{agent.totalGames})
                        </span>
                      </div>
                      <div className={styles.valAgentBarContainer}>
                        <div 
                          className={styles.valAgentBar}
                          style={{ width: `${agent.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Agent Picks by Map */}
              {valScoutingReport.agentStats.picksByMap.length > 0 && (
                <div className={styles.valAgentByMap}>
                  <div className={styles.banSectionLabel}>Agent Picks by Map</div>
                  
                  {/* Map Tabs */}
                  <div className={styles.valMapTabs}>
                    {valScoutingReport.agentStats.picksByMap.map((mapData) => (
                      <button
                        key={mapData.mapId}
                        className={`${styles.valMapTab} ${selectedValMapTab === mapData.mapId ? styles.valMapTabActive : ''}`}
                        onClick={() => setSelectedValMapTab(mapData.mapId)}
                      >
                        {mapData.mapName}
                        <span className={styles.valMapTabCount}>({mapData.gamesPlayed})</span>
                      </button>
                    ))}
                  </div>
                  
                  {/* Selected Map Agent Picks */}
                  {selectedValMapTab && (() => {
                    const selectedMapData = valScoutingReport.agentStats?.picksByMap.find(
                      (m) => m.mapId === selectedValMapTab
                    )
                    if (!selectedMapData) return null
                    
                    return (
                      <div className={styles.valAgentMapContent}>
                        <div className={styles.valAgentGrid}>
                          {selectedMapData.agentPicks.slice(0, 10).map((agent) => (
                            <div key={agent.agentId} className={styles.valAgentCard}>
                              <Image
                                src={getAgentImagePath(agent.agentName)}
                                alt={agent.agentName}
                                width={36}
                                height={36}
                                className={styles.valAgentImage}
                                unoptimized
                              />
                              <div className={styles.valAgentInfo}>
                                <span className={styles.valAgentName}>{agent.agentName}</span>
                                <span className={styles.valAgentStats}>
                                  {Math.round(agent.percentage)}% ({agent.count} picks)
                                </span>
                              </div>
                              <div className={styles.valAgentBarContainer}>
                                <div 
                                  className={styles.valAgentBar}
                                  style={{ width: `${agent.percentage}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )}
              
              {/* Player Agent Preferences */}
              {valScoutingReport.agentStats.playerPreferences.length > 0 && (
                <div className={styles.valPlayerPrefs}>
                  <div className={styles.banSectionLabel}>Player Agent Preferences</div>
                  <div className={styles.valPlayerTable}>
                    <div className={styles.valPlayerTableHeader}>
                      <span className={styles.valPlayerColPlayer}>Player</span>
                      <span className={styles.valPlayerColMaps}>Maps</span>
                      <span className={styles.valPlayerColWin}>Win %</span>
                      <span className={styles.valPlayerColAgents}>Top Agents</span>
                    </div>
                    {valScoutingReport.agentStats.playerPreferences.map((player) => (
                      <div key={player.playerId} className={styles.valPlayerRow}>
                        <span className={styles.valPlayerColPlayer}>{player.playerName}</span>
                        <span className={styles.valPlayerColMaps}>{player.totalMapsPlayed}</span>
                        <span className={styles.valPlayerColWin}>{Math.round(player.winPercentage)}%</span>
                        <div className={styles.valPlayerColAgents}>
                          {player.agentPicks.slice(0, 4).map((agent) => (
                            <div key={agent.agentId} className={styles.valPlayerAgentChip}>
                              <Image
                                src={getAgentImagePath(agent.agentName)}
                                alt={agent.agentName}
                                width={20}
                                height={20}
                                className={styles.valPlayerAgentImg}
                                unoptimized
                              />
                              <span className={styles.valPlayerAgentPercent}>{Math.round(agent.percentage)}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Games List Panel - Below Scouting Report */}
      {selectedTeam && games.length > 0 && (
        <div className={styles.gamesPanel}>
          <button 
            className={styles.gamesPanelHeader}
            onClick={() => setIsGamesExpanded(!isGamesExpanded)}
          >
            <h3 className={styles.gamesPanelTitle}>
              Match History
              <span className={styles.gamesCount}>{games.length} Games</span>
            </h3>
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
                    <div className={`${styles.gameRow} ${isAnalyzing ? styles.gameRowAnalyzing : ''} ${isCompleted ? styles.gameRowCompleted : ''}`}>
                      <div className={styles.gameDate}>{formatDate(gameItem.date)}</div>
                      <div className={styles.gameMatchup}>
                        <span className={styles.gameTeam}>{selectedTeam.name}</span>
                        <span className={styles.gameVs}>vs</span>
                        <span className={styles.gameOpponent}>{gameItem.opponent.name}</span>
                      </div>
                      <div className={styles.gameTournament}>
                        {game === 'lol' && isAnalyzing && <span className={styles.analyzingBadge}>Analysing...</span>}
                        {game === 'lol' && isCompleted && !isAnalyzing && <span className={styles.completedBadge}>✓</span>}
                        {(game !== 'lol' || (!isAnalyzing && !isCompleted)) && gameItem.tournament}
                      </div>
                      <Link 
                        href={`/${game === 'lol' ? 'lol' : 'val'}/series/${gameItem.id}`}
                        className={styles.viewMatchButton}
                      >
                        View Match
                      </Link>
                    </div>
                    
                    {/* Draft info for each game in this series - LoL only */}
                    {game === 'lol' && seriesDraftData?.games && seriesDraftData.games.length > 0 && (
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
                    
                    {/* Valorant match details */}
                    {game === 'valorant' && (() => {
                      const valSeriesData = valScoutingReport?.seriesBreakdown?.find(
                        (s) => s.seriesId === gameItem.id
                      )
                      if (!valSeriesData || valSeriesData.games.length === 0) return null
                      
                      return (
                        <div className={styles.valMatchDetails}>
                          {/* Map Veto Sequence */}
                          {valSeriesData.mapVeto.length > 0 && (
                            <div className={styles.valVetoSequence}>
                              <span className={styles.valVetoLabel}>Veto:</span>
                              {valSeriesData.mapVeto.map((veto, idx) => (
                                <span 
                                  key={idx} 
                                  className={`${styles.valVetoChip} ${veto.action === 'ban' ? styles.valVetoBanChip : veto.action === 'pick' ? styles.valVetoPickChip : styles.valVetoDeciderChip} ${veto.isOurTeam ? styles.valVetoOurs : ''}`}
                                  title={`${veto.teamName || 'Auto'} ${veto.action}`}
                                >
                                  {veto.mapId.charAt(0).toUpperCase() + veto.mapId.slice(1)}
                                </span>
                              ))}
                            </div>
                          )}
                          
                          {/* Games with agents and stats */}
                          {valSeriesData.games.map((gameData) => (
                            <div key={gameData.gameNumber} className={styles.valGameRow}>
                              <div className={styles.valGameHeader}>
                                <span className={styles.valGameMap}>
                                  {gameData.mapId.charAt(0).toUpperCase() + gameData.mapId.slice(1)}
                                </span>
                                <span className={`${styles.valGameResult} ${gameData.isWin ? styles.valWin : styles.valLoss}`}>
                                  {gameData.isWin ? 'W' : 'L'}
                                </span>
                              </div>
                              <div className={styles.valPlayerStats}>
                                {gameData.ourAgents.map((agent) => (
                                  <div key={agent.playerId} className={styles.valPlayerStatRow}>
                                    <Image
                                      src={getAgentImagePath(agent.agentName)}
                                      alt={agent.agentName}
                                      width={24}
                                      height={24}
                                      className={styles.valStatAgentImg}
                                      unoptimized
                                    />
                                    <span className={styles.valStatPlayerName}>{agent.playerName}</span>
                                    <span className={styles.valStatKD}>
                                      <span className={styles.valStatKills}>K: {agent.kills}</span>
                                      <span className={styles.valStatDeaths}>D: {agent.deaths}</span>
                                    </span>
                                    <span className={`${styles.valStatSide} ${styles.valStatAttack}`} title="Attack K/D">
                                      <span className={styles.valStatKills}>{agent.attackerKills}</span>/<span className={styles.valStatDeaths}>{agent.attackerDeaths}</span>
                                    </span>
                                    <span className={`${styles.valStatSide} ${styles.valStatDefend}`} title="Defense K/D">
                                      <span className={styles.valStatKills}>{agent.defenderKills}</span>/<span className={styles.valStatDeaths}>{agent.defenderDeaths}</span>
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    })()}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
