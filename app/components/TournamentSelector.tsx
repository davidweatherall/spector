'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams, useRouter } from 'next/navigation'
import { useGridData, Tournament, Team } from '../contexts/GridDataContext'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { getChampionImagePath } from '../utils/championMapping'
import ValorantMapPlayer from './ValorantMapPlayer'
import styles from './TournamentSelector.module.css'

// Helper to get Valorant agent image path
const getAgentImagePath = (agentName: string): string => {
  // Normalize: lowercase and remove special chars (e.g., 'kay/o' -> 'kayo')
  const lowerName = agentName.toLowerCase().replace(/[^a-z]/g, '')
  return `/agents/${lowerName}.png`
}

// Helper to shorten super region names for display
const shortenRegionName = (region: string): string => {
  const lower = region.toLowerCase()
  if (lower === 'attacker side') return ' atk spawn'
  if (lower === 'defender side') return ' def spawn'
  if (lower === 'mid') return ' mid'
  // For A, B, C sites, just use the first letter uppercase
  return region.charAt(0).toUpperCase()
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
      agentPicks: { agentId: string; agentName: string; count: number; percentage: number; wins: number; winPercentage: number }[]
    }[]
    playerPreferences: {
      playerId: string
      playerName: string
      totalMapsPlayed: number
      wins: number
      winPercentage: number
      agentPicks: { agentId: string; agentName: string; count: number; percentage: number; wins: number; winPercentage: number }[]
    }[]
  } | null
  defensiveSetups: {
    totalDefensiveRounds: number
    byMap: {
      mapId: string
      mapName: string
      totalRounds: number
      formations: {
        formationKey: string
        superRegions: { [superRegionName: string]: number }
        count: number
        percentage: number
      }[]
    }[]
  } | null
  offensiveSetups: {
    totalOffensiveRounds: number
    byMap: {
      mapId: string
      mapName: string
      totalRounds: number
      formations: {
        formationKey: string
        superRegions: { [superRegionName: string]: number }
        count: number
        percentage: number
      }[]
    }[]
  } | null
  economySetups: {
    defensive: {
      buy: { totalRounds: number; byMap: { mapId: string; mapName: string; totalRounds: number; formations: { formationKey: string; superRegions: { [superRegionName: string]: number }; count: number; percentage: number }[] }[] }
      eco: { totalRounds: number; byMap: { mapId: string; mapName: string; totalRounds: number; formations: { formationKey: string; superRegions: { [superRegionName: string]: number }; count: number; percentage: number }[] }[] }
    }
    offensive: {
      buy: { totalRounds: number; byMap: { mapId: string; mapName: string; totalRounds: number; formations: { formationKey: string; superRegions: { [superRegionName: string]: number }; count: number; percentage: number }[] }[] }
      eco: { totalRounds: number; byMap: { mapId: string; mapName: string; totalRounds: number; formations: { formationKey: string; superRegions: { [superRegionName: string]: number }; count: number; percentage: number }[] }[] }
    }
  } | null
  playerPositions: {
    byMap: {
      mapId: string
      mapName: string
      players: {
        playerId: string
        playerName: string
        totalRounds: number
        clusters: {
          centroidX: number
          centroidY: number
          callout: string
          superRegion: string
          count: number
          percentage: number
          positions: { x: number; y: number }[]
        }[]
      }[]
    }[]
  } | null
  lurkerStats: {
    byMap: {
      mapId: string
      mapName: string
      totalAttackRounds: number
      players: {
        playerId: string
        playerName: string
        totalAttackRounds: number
        lurkCount: number
        lurkPercentage: number
        byPushSite: {
          pushSite: string
          lurkLocations: {
            superRegion: string
            count: number
            percentage: number
          }[]
        }[]
      }[]
    }[]
  } | null
  abilityUsage: {
    defensive: {
      mapId: string
      mapName: string
      players: {
        playerId: string
        playerName: string
        totalRounds: number
        clusters: {
          centroidX: number
          centroidY: number
          callout: string
          superRegion: string
          abilityId: string
          agentName: string
          count: number
          percentage: number
          positions: { x: number; y: number }[]
        }[]
      }[]
    }[]
    offensive: {
      mapId: string
      mapName: string
      players: {
        playerId: string
        playerName: string
        totalRounds: number
        clusters: {
          centroidX: number
          centroidY: number
          callout: string
          superRegion: string
          abilityId: string
          agentName: string
          count: number
          percentage: number
          positions: { x: number; y: number }[]
        }[]
      }[]
    }[]
  } | null
  postPlant: {
    byMap: {
      mapId: string
      mapName: string
      totalPlantsOnMap: number
      bySite: {
        site: string
        totalPlants: number
        players: {
          playerId: string
          playerName: string
          totalPlants: number
          clusters: {
            centroidX: number
            centroidY: number
            callout: string
            superRegion: string
            count: number
            percentage: number
            positions: { x: number; y: number }[]
          }[]
        }[]
      }[]
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
  playbackData: {
    byMap: {
      mapId: string
      mapName: string
      attacker: PlaybackRound[]
      defender: PlaybackRound[]
    }[]
  } | null
}

interface PlaybackRound {
  roundId: string
  seriesId: string
  gameNumber: number
  roundNumber: number
  opponent: string
  date: string
  ourSide: 'attacker' | 'defender'
  isWin: boolean
  players: {
    playerId: string
    playerName: string
    teamId: string
    teamName: string
    agentId: string
    side: 'attacker' | 'defender'
  }[]
  coordinateTracking: {
    time: number
    playerCoordinates: { playerId: string; x: number; y: number }[]
  }[]
  kills: {
    killerId: string
    victimId: string
    occurredAt: string
  }[]
  freezetimeEndedAt: string | null
  roundStartTime: number
  roundEndTime: number
  bombPlantTime: number | null
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
  const [selectedPerMapTab, setSelectedPerMapTab] = useState<string | null>(null) // Unified per-map selector
  const [selectedPlayerPosMap, setSelectedPlayerPosMap] = useState<string | null>(null)
  const [selectedPlayerPositions, setSelectedPlayerPositions] = useState<Set<string> | null>(null)
  const [selectedDefAbilityMap, setSelectedDefAbilityMap] = useState<string | null>(null)
  const [selectedDefAbilities, setSelectedDefAbilities] = useState<Set<string> | null>(null)
  const [selectedOffAbilityMap, setSelectedOffAbilityMap] = useState<string | null>(null)
  const [selectedOffAbilities, setSelectedOffAbilities] = useState<Set<string> | null>(null)
  const [selectedPostPlantMap, setSelectedPostPlantMap] = useState<string | null>(null)
  const [selectedPostPlantSite, setSelectedPostPlantSite] = useState<string | null>(null)
  const [selectedPostPlantPositions, setSelectedPostPlantPositions] = useState<Set<string> | null>(null)
  const [selectedMapAnalysisTab, setSelectedMapAnalysisTab] = useState<'positions' | 'allAbilities' | 'defAbility' | 'offAbility' | 'postPlant' | 'playback'>('offAbility')
  const [selectedAllAbilitySide, setSelectedAllAbilitySide] = useState<'defender' | 'attacker'>('defender')
  const [selectedAllAbilities, setSelectedAllAbilities] = useState<Set<string> | null>(null)
  const [selectedLeftSetupTab, setSelectedLeftSetupTab] = useState<'defensive' | 'offensive' | 'economy'>('defensive')
  // Playback state
  const [selectedPlaybackSide, setSelectedPlaybackSide] = useState<'attacker' | 'defender'>('attacker')
  const [isPlaybackPlaying, setIsPlaybackPlaying] = useState(false)
  const [playbackTime, setPlaybackTime] = useState(0) // Current playback time in ms (relative to round start)
  const [currentPlaybackRoundIdx, setCurrentPlaybackRoundIdx] = useState(0) // Which round we're playing
  const playbackIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastTickTimeRef = useRef<number>(0)
  const PLAYBACK_SPEED = 20 // 20x speed
  const TICK_INTERVAL_MS = 16 // ~60fps
  
  // Clean up playback interval on unmount
  useEffect(() => {
    return () => {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current)
      }
    }
  }, [])
  
  // Stop playback when map or tab changes
  useEffect(() => {
    setIsPlaybackPlaying(false)
    setPlaybackTime(0)
    setCurrentPlaybackRoundIdx(0)
    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current)
      playbackIntervalRef.current = null
    }
  }, [selectedPerMapTab, selectedMapAnalysisTab])
  
  const [customGameCount, setCustomGameCount] = useState<string>('10')
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
    
    // Clear previous report
    setScoutingReport(null)
    
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
    
    // Clear previous report and related state
    setValScoutingReport(null)
    setSelectedPerMapTab(null)
    setSelectedPlayerPosMap(null)
    setSelectedPlayerPositions(null)
    setSelectedAllAbilities(null)
    setSelectedDefAbilityMap(null)
    setSelectedDefAbilities(null)
    setSelectedOffAbilityMap(null)
    setSelectedOffAbilities(null)
    setSelectedPostPlantMap(null)
    setSelectedPostPlantSite(null)
    setSelectedPostPlantPositions(null)
    
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
      {/* Filters and Team Actions Row */}
      <div className={styles.filtersAndActionsRow}>
        {/* Filters Panel - Left Half */}
        <div className={styles.filtersHalf}>
          <div className={styles.filtersGrid}>
              {/* Leagues Column */}
              <div className={styles.column}>
                <label className={styles.label}>
                  Leagues
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
                          type="radio"
                          name="league"
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

              {/* Teams Column */}
              <div className={styles.column}>
                <div className={styles.teamsHeader}>
                  <label className={styles.label}>
                    Teams
                    <span className={styles.count}>({teams.length})</span>
                  </label>
                </div>
                {teamsError ? (
                  <div className={styles.error}>{teamsError}</div>
                ) : teamsLoading ? (
                  <div className={styles.placeholder}>Loading teams...</div>
                ) : teams.length === 0 ? (
                  <div className={styles.placeholder}>
                    {selectedLeagues.length === 0 
                      ? 'Select a league first' 
                      : 'No teams found'}
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
        </div>

        {/* Team Actions Panel - Right Half */}
        {selectedTeam && (
          <div className={styles.actionsHalf}>
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
              className={`${styles.scoutingButton} ${scoutingLoading ? styles.scoutingButtonLoading : ''} ${game === 'valorant' ? styles.scoutingButtonVal : ''}`}
              onClick={() => game === 'lol' ? handleGenerateScoutingReport() : handleGenerateValScoutingReport()}
              disabled={scoutingLoading || gamesLoading || games.length === 0}
            >
              {scoutingLoading ? 'Generating...' : `Full Report (${games.length} Games)`}
            </button>
            <button
                className={`${styles.scoutingButton} ${styles.scoutingButtonCustom} ${scoutingLoading ? styles.scoutingButtonLoading : ''} ${game === 'valorant' ? styles.scoutingButtonVal : ''}`}
                onClick={() => {
                  const count = parseInt(customGameCount, 10)
                  if (count > 0) {
                    game === 'lol' ? handleGenerateScoutingReport(count) : handleGenerateValScoutingReport(count)
                  }
                }}
                disabled={scoutingLoading || gamesLoading || games.length === 0 || !customGameCount || parseInt(customGameCount, 10) < 1}
              >
                <input
                  type="number"
                  min="1"
                  max={games.length}
                  value={customGameCount}
                  onChange={(e) => {
                    e.stopPropagation()
                    setCustomGameCount(e.target.value)
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className={styles.customGameInputInline}
                  placeholder="10"
                />
                <span>Recent Games</span>
              </button>
          </div>
        </div>
        )}
      </div>

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
                          formatter={(value, name) => {
                            if (typeof value !== 'number') return [value, name]
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
                          formatter={(value, name) => {
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
                              formatter={(value) => {
                                if (typeof value !== 'number') return [value, 'Gold Diff']
                                return [`${value >= 0 ? '+' : ''}${value.toLocaleString()}`, 'Gold Diff']
                              }}
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
              
              {/* Player Agent Preferences */}
              {valScoutingReport.agentStats.playerPreferences.length > 0 && (
                <div className={styles.valPlayerPrefs}>
                  <div className={styles.banSectionLabel}>Player Agent Preferences</div>
                  <div className={styles.valPlayerTable}>
                    <div className={styles.valPlayerTableHeader}>
                      <span className={styles.valPlayerColPlayer}>Player</span>
                      <span className={styles.valPlayerColAgentsExpanded}>Agent Breakdown</span>
                    </div>
                    {[...valScoutingReport.agentStats.playerPreferences]
                      .sort((a, b) => b.totalMapsPlayed - a.totalMapsPlayed)
                      .map((player) => (
                      <div key={player.playerId} className={styles.valPlayerRow}>
                        <span className={styles.valPlayerColPlayer}>
                          {player.playerName}
                          <span className={styles.valPlayerGamesCount}>({player.totalMapsPlayed} games)</span>
                        </span>
                        <div className={styles.valPlayerColAgentsExpanded}>
                          {player.agentPicks.map((agent) => (
                            <div key={agent.agentId} className={styles.valPlayerAgentChipExpanded}>
                              <Image
                                src={getAgentImagePath(agent.agentName)}
                                alt={agent.agentName}
                                width={24}
                                height={24}
                                className={styles.valPlayerAgentImg}
                                unoptimized
                              />
                              <span className={styles.valPlayerAgentName}>{agent.agentName}</span>
                              <span className={styles.valPlayerAgentPick}>{Math.round(agent.percentage)}% pick</span>
                              <span className={styles.valPlayerAgentWin}>{Math.round(agent.winPercentage)}% win</span>
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
          
          {/* Per Map Stats Section */}
          {(() => {
            // Collect all available maps from various sources
            const allMaps: { mapId: string; mapName: string; sampleSize: number }[] = []
            
            // From defensive setups
            valScoutingReport.defensiveSetups?.byMap.forEach(m => {
              if (!allMaps.find(x => x.mapId === m.mapId)) {
                allMaps.push({ mapId: m.mapId, mapName: m.mapName, sampleSize: m.totalRounds })
              }
            })
            
            // From offensive setups
            valScoutingReport.offensiveSetups?.byMap.forEach(m => {
              const existing = allMaps.find(x => x.mapId === m.mapId)
              if (existing) {
                existing.sampleSize += m.totalRounds
              } else {
                allMaps.push({ mapId: m.mapId, mapName: m.mapName, sampleSize: m.totalRounds })
              }
            })
            
            // From agent picks by map
            valScoutingReport.agentStats?.picksByMap.forEach(m => {
              const existing = allMaps.find(x => x.mapId === m.mapId)
              if (existing) {
                existing.sampleSize += m.gamesPlayed * 10 // Weight games more
              } else {
                allMaps.push({ mapId: m.mapId, mapName: m.mapName, sampleSize: m.gamesPlayed * 10 })
              }
            })
            
            if (allMaps.length === 0) return null
            
            // Sort alphabetically for display, but default to largest sample
            const sortedAlphabetically = [...allMaps].sort((a, b) => a.mapName.localeCompare(b.mapName))
            const largestSampleMap = [...allMaps].sort((a, b) => b.sampleSize - a.sampleSize)[0]
            const currentMapId = selectedPerMapTab || largestSampleMap?.mapId || sortedAlphabetically[0]?.mapId
            
            // Get data for current map from each source
            const defensiveMapData = valScoutingReport.defensiveSetups?.byMap.find(m => m.mapId === currentMapId)
            const offensiveMapData = valScoutingReport.offensiveSetups?.byMap.find(m => m.mapId === currentMapId)
            const agentPicksMapData = valScoutingReport.agentStats?.picksByMap.find(m => m.mapId === currentMapId)
            const economyDefBuyMapData = valScoutingReport.economySetups?.defensive.buy.byMap.find(m => m.mapId === currentMapId)
            const economyDefEcoMapData = valScoutingReport.economySetups?.defensive.eco.byMap.find(m => m.mapId === currentMapId)
            const economyOffBuyMapData = valScoutingReport.economySetups?.offensive.buy.byMap.find(m => m.mapId === currentMapId)
            const economyOffEcoMapData = valScoutingReport.economySetups?.offensive.eco.byMap.find(m => m.mapId === currentMapId)
            const playerPositionsMapData = valScoutingReport.playerPositions?.byMap.find(m => m.mapId === currentMapId)
            const lurkerMapData = valScoutingReport.lurkerStats?.byMap.find(m => m.mapId === currentMapId)
            const defAbilityMapData = valScoutingReport.abilityUsage?.defensive.find(m => m.mapId === currentMapId)
            const offAbilityMapData = valScoutingReport.abilityUsage?.offensive.find(m => m.mapId === currentMapId)
            const postPlantMapData = valScoutingReport.postPlant?.byMap.find(m => m.mapId === currentMapId)
            const playbackMapData = valScoutingReport.playbackData?.byMap.find(m => m.mapId === currentMapId)
            
            return (
              <div className={styles.valPerMapSection}>
                {/* Header with Map Selector */}
                <div className={styles.valPerMapHeader}>
                  <div className={styles.valPerMapTitle}>
                    Per Map Stats
                  </div>
                  <div className={styles.valPerMapSelector}>
                    {sortedAlphabetically.map((mapData) => (
                      <button
                        key={mapData.mapId}
                        className={`${styles.valPerMapBtn} ${mapData.mapId === currentMapId ? styles.valPerMapBtnActive : ''}`}
                        onClick={() => {
                          setSelectedPerMapTab(mapData.mapId)
                          // Reset selections to null so new map gets default first-item selection
                          setSelectedPlayerPositions(null)
                          setSelectedAllAbilities(null)
                          setSelectedDefAbilities(null)
                          setSelectedOffAbilities(null)
                          setSelectedPostPlantSite(null)
                          setSelectedPostPlantPositions(null)
                        }}
                      >
                        {mapData.mapName}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* 3-Column Map Scouting Layout */}
                <div className={styles.valMapScoutingLayout}>
                  {/* LEFT SIDEBAR */}
                  <div className={styles.valMapLeftSidebar}>
                    {/* Agent Picks */}
                    {agentPicksMapData && (
                      <div className={styles.valLeftAgentPicks}>
                        <div className={styles.valLeftAgentPicksHeader}>Agent Picks</div>
                        <div className={styles.valLeftAgentPicksTableHeader}>
                          <span>Agent</span>
                          <span>Pick</span>
                          <span>Win</span>
                        </div>
                        <div className={styles.valLeftAgentPicksTable}>
                          {agentPicksMapData.agentPicks.slice(0, 8).map((agent) => (
                            <div key={agent.agentId} className={styles.valLeftAgentRow}>
                              <div className={styles.valLeftAgentInfo}>
                                <Image
                                  src={getAgentImagePath(agent.agentName)}
                                  alt={agent.agentName}
                                  width={28}
                                  height={28}
                                  className={styles.valLeftAgentImg}
                                  unoptimized
                                />
                                <span className={styles.valLeftAgentName}>{agent.agentName}</span>
                              </div>
                              <span className={styles.valLeftAgentPick}>{Math.round(agent.percentage)}%</span>
                              <span className={styles.valLeftAgentWin}>{Math.round(agent.winPercentage)}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Setup Tabs Section */}
                    <div className={styles.valLeftSetupSection}>
                      <div className={styles.valLeftSetupTabs}>
                        <button
                          className={`${styles.valLeftSetupTab} ${selectedLeftSetupTab === 'defensive' ? styles.valLeftSetupTabActive : ''}`}
                          onClick={() => setSelectedLeftSetupTab('defensive')}
                        >
                          Defensive
                        </button>
                        <button
                          className={`${styles.valLeftSetupTab} ${selectedLeftSetupTab === 'offensive' ? styles.valLeftSetupTabActive : ''}`}
                          onClick={() => setSelectedLeftSetupTab('offensive')}
                        >
                          Offensive
                        </button>
                        <button
                          className={`${styles.valLeftSetupTab} ${selectedLeftSetupTab === 'economy' ? styles.valLeftSetupTabActive : ''}`}
                          onClick={() => setSelectedLeftSetupTab('economy')}
                        >
                          Economy
                        </button>
                      </div>
                      <div className={styles.valLeftSetupContent}>
                        {selectedLeftSetupTab === 'defensive' && defensiveMapData && (
                          <>
                            <div className={styles.valPerMapSampleSize} style={{ marginBottom: '0.5rem' }}>
                              {defensiveMapData.totalRounds} rounds
                            </div>
                            {defensiveMapData.formations.slice(0, 6).map((formation, idx) => (
                              <div key={idx} className={styles.valLeftFormationRow}>
                                <div className={styles.valLeftFormationChips}>
                                  {Object.entries(formation.superRegions)
                                    .sort((a, b) => a[0].localeCompare(b[0]))
                                    .map(([region, count]) => (
                                      <span key={region} className={styles.valLeftFormationChip}>
                                        {count}{shortenRegionName(region)}
                                      </span>
                                    ))}
                                </div>
                                <span className={styles.valLeftFormationPercent}>{Math.round(formation.percentage)}%</span>
                              </div>
                            ))}
                          </>
                        )}
                        {selectedLeftSetupTab === 'offensive' && offensiveMapData && (
                          <>
                            <div className={styles.valPerMapSampleSize} style={{ marginBottom: '0.5rem' }}>
                              {offensiveMapData.totalRounds} rounds
                            </div>
                            {offensiveMapData.formations.slice(0, 6).map((formation, idx) => (
                              <div key={idx} className={styles.valLeftFormationRow}>
                                <div className={styles.valLeftFormationChips}>
                                  {Object.entries(formation.superRegions)
                                    .sort((a, b) => a[0].localeCompare(b[0]))
                                    .map(([region, count]) => (
                                      <span key={region} className={styles.valLeftFormationChip}>
                                        {count}{shortenRegionName(region)}
                                      </span>
                                    ))}
                                </div>
                                <span className={styles.valLeftFormationPercent}>{Math.round(formation.percentage)}%</span>
                              </div>
                            ))}
                          </>
                        )}
                        {selectedLeftSetupTab === 'economy' && (
                          <>
                            {economyDefEcoMapData && (
                              <div style={{ marginBottom: '0.75rem' }}>
                                <div className={styles.valPerMapSampleSize} style={{ marginBottom: '0.25rem' }}>
                                  Def Eco ({economyDefEcoMapData.totalRounds} rounds)
                                </div>
                                {economyDefEcoMapData.formations.slice(0, 3).map((formation, idx) => (
                                  <div key={idx} className={styles.valLeftFormationRow}>
                                    <div className={styles.valLeftFormationChips}>
                                      {Object.entries(formation.superRegions)
                                        .sort((a, b) => a[0].localeCompare(b[0]))
                                        .map(([region, count]) => (
                                          <span key={region} className={styles.valLeftFormationChip}>
                                            {count}{shortenRegionName(region)}
                                          </span>
                                        ))}
                                    </div>
                                    <span className={styles.valLeftFormationPercent}>{Math.round(formation.percentage)}%</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {economyOffEcoMapData && (
                              <div>
                                <div className={styles.valPerMapSampleSize} style={{ marginBottom: '0.25rem' }}>
                                  Off Eco ({economyOffEcoMapData.totalRounds} rounds)
                                </div>
                                {economyOffEcoMapData.formations.slice(0, 3).map((formation, idx) => (
                                  <div key={idx} className={styles.valLeftFormationRow}>
                                    <div className={styles.valLeftFormationChips}>
                                      {Object.entries(formation.superRegions)
                                        .sort((a, b) => a[0].localeCompare(b[0]))
                                        .map(([region, count]) => (
                                          <span key={region} className={styles.valLeftFormationChip}>
                                            {count}{shortenRegionName(region)}
                                          </span>
                                        ))}
                                    </div>
                                    <span className={styles.valLeftFormationPercent}>{Math.round(formation.percentage)}%</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* CENTER MAP & RIGHT SIDEBAR */}
                  {(() => {
                    type TabId = 'positions' | 'allAbilities' | 'defAbility' | 'offAbility' | 'postPlant' | 'playback'
                    const abilityTabs: { id: TabId; label: string; available: boolean }[] = [
                      { id: 'offAbility', label: 'Attacker', available: !!offAbilityMapData },
                      { id: 'defAbility', label: 'Defender', available: !!defAbilityMapData },
                    ]
                    const locationTabs: { id: TabId; label: string; available: boolean }[] = [
                      { id: 'postPlant', label: 'Post Plant', available: !!postPlantMapData },
                      { id: 'positions', label: 'Defender', available: !!playerPositionsMapData },
                    ]
                    const playbackTabs: { id: TabId; label: string; available: boolean }[] = [
                      { id: 'playback', label: 'Playback', available: !!(playbackMapData && (playbackMapData.attacker.length > 0 || playbackMapData.defender.length > 0)) },
                    ]
                    const allTabs = [...abilityTabs, ...locationTabs, ...playbackTabs]
                    const tabs = allTabs.filter(t => t.available)
                    
                    if (tabs.length === 0) {
                      return (
                        <>
                          <div className={styles.valMapCenter}>
                            <ValorantMapPlayer
                              mode="static"
                              mapName={currentMapId}
                              staticPositions={[]}
                              mapSize={550}
                              dotSize="small"
                            />
                          </div>
                          <div className={styles.valMapRightSidebar} />
                        </>
                      )
                    }
                    
                    const activeTab = tabs.find(t => t.id === selectedMapAnalysisTab)?.id || tabs[0].id
                    
                    // 20 distinct colors for different abilities/players
                    const CLUSTER_COLORS = [
                      '#ec4899', // pink
                      '#8b5cf6', // violet
                      '#3b82f6', // blue
                      '#06b6d4', // cyan
                      '#10b981', // emerald
                      '#84cc16', // lime
                      '#eab308', // yellow
                      '#f97316', // orange
                      '#ef4444', // red
                      '#f43f5e', // rose
                      '#a855f7', // purple
                      '#6366f1', // indigo
                      '#0ea5e9', // sky
                      '#14b8a6', // teal
                      '#22c55e', // green
                      '#a3e635', // lime bright
                      '#fbbf24', // amber
                      '#fb923c', // orange light
                      '#f87171', // red light
                      '#c084fc', // purple light
                    ]
                    
                    let allClusters: { id: string; playerName: string; callout: string; percentage: number; positions: { x: number; y: number }[]; count: number; extra?: string }[] = []
                    let effectiveSelection: Set<string> = new Set()
                    let setSelection: (s: Set<string> | null) => void = () => {}
                    let selectedSet: Set<string> | null = null
                    
                    const isRealPlayer = (name: string) => !/^Player \d+$/i.test(name)
                    
                    if (activeTab === 'positions' && playerPositionsMapData) {
                      const filteredPlayers = playerPositionsMapData.players.filter(player => isRealPlayer(player.playerName))
                      
                      // Create individual cluster entries
                      const individualClusters = filteredPlayers.flatMap(player =>
                        player.clusters.filter(c => c.percentage >= 15 && c.count >= 2).map((c, idx) => ({
                          id: `${player.playerId}-${idx}`,
                          playerName: player.playerName,
                          callout: c.callout,
                          percentage: c.percentage,
                          positions: c.positions || [],
                          count: c.count,
                        }))
                      )
                      
                      // Create "(All)" entries for each player - combines all their positions
                      const allEntries = filteredPlayers.map(player => {
                        const allPositions = player.clusters.flatMap(c => c.positions || [])
                        return {
                          id: `${player.playerId}-all`,
                          playerName: `${player.playerName} (All)`,
                          callout: `${player.clusters.length} locations`,
                          percentage: 0, // Don't show percentage for "All"
                          positions: allPositions,
                          count: 0, // Hide count
                        }
                      }).filter(e => e.positions.length > 0)
                      
                      // Combine: Individual clusters first, then All entries at the bottom
                      allClusters = [
                        ...individualClusters.sort((a, b) => b.percentage - a.percentage),
                        ...allEntries.sort((a, b) => a.playerName.localeCompare(b.playerName)),
                      ]
                      selectedSet = selectedPlayerPositions
                      setSelection = setSelectedPlayerPositions
                    } else if (activeTab === 'defAbility' && defAbilityMapData) {
                      const filteredPlayers = defAbilityMapData.players.filter(player => isRealPlayer(player.playerName))
                      
                      // Create individual cluster entries
                      const individualClusters = filteredPlayers.flatMap(player =>
                        player.clusters.filter(c => c.percentage >= 15).map((c, idx) => ({
                          id: `def-${player.playerId}-${c.abilityId}-${c.agentName}-${idx}`,
                          playerName: `${c.agentName}: ${c.abilityId}`,
                          callout: c.callout,
                          percentage: c.percentage,
                          positions: c.positions || [],
                          count: c.count,
                        }))
                      )
                      
                      // Create "(All)" entries for each unique agent:ability combination
                      const allEntries = filteredPlayers.flatMap(player => {
                        // Group clusters by abilityId
                        const abilityGroups: { [key: string]: { agentName: string; abilityId: string; positions: { x: number; y: number }[] } } = {}
                        for (const c of player.clusters) {
                          const key = `${c.agentName}:${c.abilityId}`
                          if (!abilityGroups[key]) {
                            abilityGroups[key] = { agentName: c.agentName, abilityId: c.abilityId, positions: [] }
                          }
                          abilityGroups[key].positions.push(...(c.positions || []))
                        }
                        return Object.entries(abilityGroups).map(([key, data]) => ({
                          id: `def-${player.playerId}-${key}-all`,
                          playerName: `${data.agentName}: ${data.abilityId} (All)`,
                          callout: `${data.positions.length} locations`,
                          percentage: 0,
                          positions: data.positions,
                          count: 0,
                        }))
                      }).filter(e => e.positions.length > 0)
                      
                      allClusters = [
                        ...individualClusters.sort((a, b) => b.percentage - a.percentage),
                        ...allEntries.sort((a, b) => a.playerName.localeCompare(b.playerName)),
                      ]
                      selectedSet = selectedDefAbilities
                      setSelection = setSelectedDefAbilities
                    } else if (activeTab === 'offAbility' && offAbilityMapData) {
                      const filteredPlayers = offAbilityMapData.players.filter(player => isRealPlayer(player.playerName))
                      
                      // Create individual cluster entries
                      const individualClusters = filteredPlayers.flatMap(player =>
                        player.clusters.filter(c => c.count >= 2).map((c, idx) => ({
                          id: `off-${player.playerId}-${c.abilityId}-${c.agentName}-${c.callout}-${idx}`,
                          playerName: `${c.agentName}: ${c.abilityId}`,
                          callout: c.callout,
                          percentage: c.percentage,
                          positions: c.positions || [],
                          count: c.count,
                        }))
                      )
                      
                      // Create "(All)" entries for each unique agent:ability combination
                      const allEntries = filteredPlayers.flatMap(player => {
                        // Group clusters by abilityId
                        const abilityGroups: { [key: string]: { agentName: string; abilityId: string; positions: { x: number; y: number }[] } } = {}
                        for (const c of player.clusters) {
                          const key = `${c.agentName}:${c.abilityId}`
                          if (!abilityGroups[key]) {
                            abilityGroups[key] = { agentName: c.agentName, abilityId: c.abilityId, positions: [] }
                          }
                          abilityGroups[key].positions.push(...(c.positions || []))
                        }
                        return Object.entries(abilityGroups).map(([key, data]) => ({
                          id: `off-${player.playerId}-${key}-all`,
                          playerName: `${data.agentName}: ${data.abilityId} (All)`,
                          callout: `${data.positions.length} locations`,
                          percentage: 0,
                          positions: data.positions,
                          count: 0,
                        }))
                      }).filter(e => e.positions.length > 0)
                      
                      allClusters = [
                        ...individualClusters.sort((a, b) => b.count - a.count),
                        ...allEntries.sort((a, b) => a.playerName.localeCompare(b.playerName)),
                      ]
                      selectedSet = selectedOffAbilities
                      setSelection = setSelectedOffAbilities
                    } else if (activeTab === 'postPlant' && postPlantMapData) {
                      const sites = postPlantMapData.bySite
                      const site = selectedPostPlantSite || sites[0]?.site
                      const siteData = sites.find(s => s.site === site)
                      if (siteData) {
                        const filteredPlayers = siteData.players.filter(player => isRealPlayer(player.playerName))
                        
                        // Create individual cluster entries
                        const individualClusters = filteredPlayers.flatMap(player =>
                          player.clusters.filter(c => c.percentage >= 15 && c.count >= 2).map((c, idx) => ({
                            id: `postplant-${site}-${player.playerId}-${c.callout}-${idx}`,
                            playerName: player.playerName,
                            callout: c.callout,
                            percentage: c.percentage,
                            positions: c.positions || [],
                            count: c.count,
                          }))
                        )
                        
                        // Create "(All)" entries for each player - combines all their positions
                        const allEntries = filteredPlayers.map(player => {
                          const allPositions = player.clusters.flatMap(c => c.positions || [])
                          return {
                            id: `postplant-${site}-${player.playerId}-all`,
                            playerName: `${player.playerName} (All)`,
                            callout: `${player.clusters.length} locations`,
                            percentage: 0, // Don't show percentage for "All"
                            positions: allPositions,
                            count: 0, // Hide count
                          }
                        }).filter(e => e.positions.length > 0)
                        
                        // Combine: Individual clusters first, then All entries at the bottom
                        allClusters = [
                          ...individualClusters.sort((a, b) => b.percentage - a.percentage),
                          ...allEntries.sort((a, b) => a.playerName.localeCompare(b.playerName)),
                        ]
                      }
                      selectedSet = selectedPostPlantPositions
                      setSelection = setSelectedPostPlantPositions
                    }
                    
                    effectiveSelection = selectedSet === null 
                      ? (allClusters.length > 0 ? new Set([allClusters[0].id]) : new Set())
                      : selectedSet
                    
                    // Create a map of cluster id -> color (based on position in allClusters)
                    const clusterColorMap = new Map<string, string>()
                    allClusters.forEach((c, idx) => {
                      clusterColorMap.set(c.id, CLUSTER_COLORS[idx % CLUSTER_COLORS.length])
                    })
                    
                    // Calculate positions for regular tabs
                    let staticPositions: { id: string; label: string; x: number; y: number; percentage?: number; tooltip?: string; color?: string; agentId?: string; side?: 'attacker' | 'defender'; isDead?: boolean }[] = []
                    
                    // Get current round for playback mode
                    // Sort: most recent game first, then round 1 -> max within each game
                    const rawPlaybackRounds = playbackMapData 
                      ? (selectedPlaybackSide === 'attacker' ? playbackMapData.attacker : playbackMapData.defender)
                      : []
                    
                    // Sort by date (descending - most recent first), then by round number (ascending)
                    const playbackRounds = [...rawPlaybackRounds].sort((a, b) => {
                      // First sort by date (most recent first)
                      const dateCompare = new Date(b.date).getTime() - new Date(a.date).getTime()
                      if (dateCompare !== 0) return dateCompare
                      // If same date (same game), sort by round number ascending
                      return a.roundNumber - b.roundNumber
                    })
                    
                    const currentPlaybackRound = playbackRounds[currentPlaybackRoundIdx]
                    
                    if (activeTab === 'playback' && currentPlaybackRound) {
                      // Calculate playback positions for CURRENT round only with interpolation
                      const round = currentPlaybackRound
                      
                      // Start 10 seconds before freezetime end (show some buy phase)
                      const freezeTimeEnd = round.freezetimeEndedAt 
                        ? new Date(round.freezetimeEndedAt).getTime() 
                        : round.roundStartTime
                      const playbackStartTime = freezeTimeEnd - 10000 // 10 seconds before freeze end
                      const roundDuration = round.roundEndTime - playbackStartTime
                      // Cap targetTime to round end (during hold period, show last frame)
                      const targetTime = Math.min(playbackStartTime + playbackTime, round.roundEndTime)
                      
                      // Find snapshots for interpolation
                      let beforeSnapshot = round.coordinateTracking[0]
                      let afterSnapshot = round.coordinateTracking[0]
                      
                      for (let i = 0; i < round.coordinateTracking.length; i++) {
                        const snapshot = round.coordinateTracking[i]
                        if (snapshot.time <= targetTime) {
                          beforeSnapshot = snapshot
                          afterSnapshot = round.coordinateTracking[i + 1] || snapshot
                        } else {
                          afterSnapshot = snapshot
                          break
                        }
                      }
                      
                      // Calculate interpolation factor
                      const timeDiff = afterSnapshot.time - beforeSnapshot.time
                      const timeProgress = targetTime - beforeSnapshot.time
                      const t = timeDiff > 0 ? Math.max(0, Math.min(1, timeProgress / timeDiff)) : 0
                      
                      // Get kills that happened before this time
                      const deadPlayers = new Set<string>()
                      for (const kill of round.kills) {
                        const killTime = new Date(kill.occurredAt).getTime()
                        if (killTime <= targetTime) {
                          deadPlayers.add(kill.victimId)
                        }
                      }
                      
                      // Add interpolated positions for all players (both teams)
                      for (const beforeCoord of beforeSnapshot.playerCoordinates) {
                        const player = round.players.find(p => p.playerId === beforeCoord.playerId)
                        if (!player) continue
                        
                        const isDead = deadPlayers.has(beforeCoord.playerId)
                        
                        // Find matching coord in after snapshot for interpolation
                        const afterCoord = afterSnapshot.playerCoordinates.find(c => c.playerId === beforeCoord.playerId)
                        
                        const x = afterCoord ? beforeCoord.x + (afterCoord.x - beforeCoord.x) * t : beforeCoord.x
                        const y = afterCoord ? beforeCoord.y + (afterCoord.y - beforeCoord.y) * t : beforeCoord.y
                        
                        staticPositions.push({
                          id: `${round.roundId}-${beforeCoord.playerId}`,
                          label: player.playerName,
                          x,
                          y,
                          tooltip: `${player.playerName} (${player.agentId})${isDead ? ' - Dead' : ''}`,
                          agentId: player.agentId,
                          side: player.side,
                          isDead,
                        })
                      }
                      
                      // Check if round is over, advance to next
                      // Hold last frame for 1 real second before advancing (1s real time = PLAYBACK_SPEED * 1000ms game time)
                      const holdTimeMs = PLAYBACK_SPEED * 1000 // 1 real second at current speed
                      if (isPlaybackPlaying && playbackTime >= roundDuration + holdTimeMs) {
                        const nextIdx = currentPlaybackRoundIdx + 1
                        if (nextIdx < playbackRounds.length) {
                          setCurrentPlaybackRoundIdx(nextIdx)
                          setPlaybackTime(0)
                        } else {
                          // All rounds done, stop playback
                          setIsPlaybackPlaying(false)
                          if (playbackIntervalRef.current) {
                            clearInterval(playbackIntervalRef.current)
                            playbackIntervalRef.current = null
                          }
                        }
                      }
                    } else if (activeTab !== 'playback') {
                      staticPositions = allClusters
                        .filter(c => effectiveSelection.has(c.id))
                        .flatMap(c => c.positions.map((pos, idx) => ({
                          id: `${c.id}-pos-${idx}`,
                          label: c.playerName,
                          x: pos.x,
                          y: pos.y,
                          percentage: c.percentage,
                          tooltip: c.callout 
                            ? `${c.playerName}: ${c.callout} (${Math.round(c.percentage)}%)`
                            : `${c.playerName}`,
                          color: clusterColorMap.get(c.id),
                        })))
                    }
                    
                    // Calculate game clock for playback
                    let gameClockDisplay = ''
                    if (activeTab === 'playback' && currentPlaybackRound) {
                      const round = currentPlaybackRound
                      const elapsedMs = playbackTime
                      
                      // Start 10 seconds before freezetime end
                      const freezeTimeEnd = round.freezetimeEndedAt 
                        ? new Date(round.freezetimeEndedAt).getTime() 
                        : round.roundStartTime
                      const playbackStartTime = freezeTimeEnd - 10000
                      
                      // Time since combat actually started (freezetime end)
                      const timeSinceCombatStart = Math.max(0, elapsedMs - 10000) // Subtract the 10s pre-freeze
                      
                      // Check if bomb has been planted
                      const bombPlanted = round.bombPlantTime && 
                        (playbackStartTime + elapsedMs) >= round.bombPlantTime
                      
                      let remainingMs: number
                      if (bombPlanted && round.bombPlantTime) {
                        // Bomb planted - 40 second timer from plant time
                        const timeSincePlant = (playbackStartTime + elapsedMs) - round.bombPlantTime
                        remainingMs = Math.max(0, 40000 - timeSincePlant)
                      } else {
                        // Normal round - 110 second timer (1:50)
                        remainingMs = Math.max(0, 110000 - timeSinceCombatStart)
                      }
                      
                      const seconds = Math.floor(remainingMs / 1000)
                      const mins = Math.floor(seconds / 60)
                      const secs = seconds % 60
                      gameClockDisplay = `${mins}:${secs.toString().padStart(2, '0')}`
                    }
                    
                    return (
                      <>
                        <div className={styles.valMapCenter}>
                          <ValorantMapPlayer
                            mode="static"
                            mapName={currentMapId}
                            staticPositions={staticPositions}
                            mapSize={550}
                            dotSize="small"
                            roundIndicator={activeTab === 'playback' && currentPlaybackRound ? `R${currentPlaybackRound.roundNumber}` : undefined}
                            gameClock={activeTab === 'playback' && currentPlaybackRound ? gameClockDisplay : undefined}
                          />
                        </div>
                        
                        <div className={styles.valMapRightSidebar}>
                          <div className={styles.valRightTabGroups}>
                            {abilityTabs.some(t => t.available) && (
                              <div className={styles.valRightTabGroup}>
                                <div className={styles.valRightTabGroupLabel}>Ability Usage</div>
                                <div className={styles.valRightTabGroupBtns}>
                                  {abilityTabs.filter(t => t.available).map(tab => (
                                    <button
                                      key={tab.id}
                                      className={`${styles.valRightTab} ${activeTab === tab.id ? styles.valRightTabActive : ''}`}
                                      onClick={() => setSelectedMapAnalysisTab(tab.id)}
                                    >
                                      {tab.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                            {locationTabs.some(t => t.available) && (
                              <div className={styles.valRightTabGroup}>
                                <div className={styles.valRightTabGroupLabel}>Location Tracking</div>
                                <div className={styles.valRightTabGroupBtns}>
                                  {locationTabs.filter(t => t.available).map(tab => (
                                    <button
                                      key={tab.id}
                                      className={`${styles.valRightTab} ${activeTab === tab.id ? styles.valRightTabActive : ''}`}
                                      onClick={() => setSelectedMapAnalysisTab(tab.id)}
                                    >
                                      {tab.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                            </div>
                          {/* Playback tab on separate line */}
                          {playbackTabs.some(t => t.available) && (
                            <div className={styles.valRightTabGroupSecondRow}>
                              <div className={styles.valRightTabGroupLabel}>Round Playback</div>
                              <div className={styles.valRightTabGroupBtns}>
                                {playbackTabs.filter(t => t.available).map(tab => (
                                  <button
                                    key={tab.id}
                                    className={`${styles.valRightTab} ${activeTab === tab.id ? styles.valRightTabActive : ''}`}
                                    onClick={() => setSelectedMapAnalysisTab(tab.id)}
                                  >
                                    {tab.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {activeTab === 'postPlant' && postPlantMapData && (
                            <div className={styles.valRightSubTabs}>
                              {postPlantMapData.bySite.map(s => (
                                <button
                                  key={s.site}
                                  className={`${styles.valRightSubTab} ${(selectedPostPlantSite || postPlantMapData.bySite[0]?.site) === s.site ? styles.valRightSubTabActive : ''}`}
                                  onClick={() => { setSelectedPostPlantSite(s.site); setSelectedPostPlantPositions(null) }}
                                >
                                  {s.site} ({s.totalPlants})
                                </button>
                              ))}
                            </div>
                          )}
                          
                          {activeTab === 'playback' && playbackMapData ? (
                            <>
                              <div className={styles.valRightSubTabs}>
                                <button
                                  className={`${styles.valRightSubTab} ${selectedPlaybackSide === 'attacker' ? styles.valRightSubTabActive : ''}`}
                                  onClick={() => { 
                                    setSelectedPlaybackSide('attacker')
                                    setIsPlaybackPlaying(false)
                                    setPlaybackTime(0)
                                    setCurrentPlaybackRoundIdx(0)
                                    if (playbackIntervalRef.current) {
                                      clearInterval(playbackIntervalRef.current)
                                      playbackIntervalRef.current = null
                                    }
                                  }}
                                >
                                  Attacker ({playbackMapData.attacker.length})
                                </button>
                                <button
                                  className={`${styles.valRightSubTab} ${selectedPlaybackSide === 'defender' ? styles.valRightSubTabActive : ''}`}
                                  onClick={() => { 
                                    setSelectedPlaybackSide('defender')
                                    setIsPlaybackPlaying(false)
                                    setPlaybackTime(0)
                                    setCurrentPlaybackRoundIdx(0)
                                    if (playbackIntervalRef.current) {
                                      clearInterval(playbackIntervalRef.current)
                                      playbackIntervalRef.current = null
                                    }
                                  }}
                                >
                                  Defender ({playbackMapData.defender.length})
                                </button>
                              </div>
                              
                              {/* Current round info */}
                              {currentPlaybackRound && (
                                <div className={styles.valPlaybackCurrentRound}>
                                  <span className={styles.valPlaybackRoundInfo}>
                                    Round {currentPlaybackRoundIdx + 1}/{playbackRounds.length}: R{currentPlaybackRound.roundNumber} vs {currentPlaybackRound.opponent}
                                  </span>
                                  <span className={styles.valPlaybackRoundResult}>
                                    {currentPlaybackRound.isWin ? '✓ Win' : '✗ Loss'}
                                  </span>
                                </div>
                              )}
                              
                              <div className={styles.valPlaybackControls}>
                                <button
                                  className={styles.valPlaybackButton}
                                  onClick={() => {
                                    if (isPlaybackPlaying) {
                                      // Stop playback
                                      setIsPlaybackPlaying(false)
                                      if (playbackIntervalRef.current) {
                                        clearInterval(playbackIntervalRef.current)
                                        playbackIntervalRef.current = null
                                      }
                                    } else {
                                      // Start playback at 8x speed
                                      setIsPlaybackPlaying(true)
                                      lastTickTimeRef.current = performance.now()
                                      playbackIntervalRef.current = setInterval(() => {
                                        const now = performance.now()
                                        const realElapsed = now - lastTickTimeRef.current
                                        lastTickTimeRef.current = now
                                        // 8x speed
                                        const gameTimeElapsed = realElapsed * PLAYBACK_SPEED
                                        setPlaybackTime(prev => prev + gameTimeElapsed)
                                      }, TICK_INTERVAL_MS)
                                    }
                                  }}
                                >
                                  {isPlaybackPlaying ? 'Stop' : 'Start'}
                                </button>
                                
                                <button
                                  className={styles.valPlaybackButton}
                                  onClick={() => {
                                    // Skip to next round
                                    const nextIdx = currentPlaybackRoundIdx + 1
                                    if (nextIdx < playbackRounds.length) {
                                      setCurrentPlaybackRoundIdx(nextIdx)
                                      setPlaybackTime(0)
                                    }
                                  }}
                                  disabled={currentPlaybackRoundIdx >= playbackRounds.length - 1}
                                >
                                  Skip
                                </button>
                                
                                {currentPlaybackRound && (
                                  <div className={styles.valPlaybackTime}>
                                    {(playbackTime / 1000).toFixed(1)}s / {((currentPlaybackRound.roundEndTime - ((currentPlaybackRound.freezetimeEndedAt ? new Date(currentPlaybackRound.freezetimeEndedAt).getTime() : currentPlaybackRound.roundStartTime) - 10000)) / 1000).toFixed(0)}s
                                  </div>
                                )}
                              </div>
                              
                              <div className={styles.valPlaybackRoundLegend}>
                                <div className={styles.valPlaybackLegendTitle}>Rounds ({playbackRounds.length} total)</div>
                                {playbackRounds.map((round, idx) => {
                                  const isCurrentRound = idx === currentPlaybackRoundIdx
                                  // Check if this is a new game (different date than previous)
                                  const prevRound = idx > 0 ? playbackRounds[idx - 1] : null
                                  const isNewGame = !prevRound || prevRound.date !== round.date
                                  
                                  return (
                                    <div key={round.roundId}>
                                      {isNewGame && (
                                        <div className={styles.valPlaybackGameHeader}>
                                          vs {round.opponent} · {new Date(round.date).toLocaleDateString()}
                                        </div>
                                      )}
                                      <div 
                                        className={`${styles.valPlaybackRoundItem} ${isCurrentRound ? styles.valPlaybackRoundItemActive : ''}`}
                                      >
                                        <button
                                          className={styles.valPlaybackRoundPlayBtn}
                                          onClick={() => {
                                            setCurrentPlaybackRoundIdx(idx)
                                            setPlaybackTime(0)
                                            setIsPlaybackPlaying(true)
                                            lastTickTimeRef.current = performance.now()
                                            if (playbackIntervalRef.current) {
                                              clearInterval(playbackIntervalRef.current)
                                            }
                                            playbackIntervalRef.current = setInterval(() => {
                                              const now = performance.now()
                                              const realElapsed = now - lastTickTimeRef.current
                                              lastTickTimeRef.current = now
                                              const gameTimeElapsed = realElapsed * PLAYBACK_SPEED
                                              setPlaybackTime(prev => prev + gameTimeElapsed)
                                            }, TICK_INTERVAL_MS)
                                          }}
                                          title="Play this round"
                                        >
                                          ▶
                                        </button>
                                        <span className={styles.valPlaybackRoundLabel}>
                                          R{round.roundNumber} {round.isWin ? '✓' : '✗'}
                                        </span>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </>
                          ) : activeTab !== 'playback' && (
                            <>
                              <div className={styles.valRightTableHeader}>
                                <span>Ability</span>
                                <span>Location</span>
                                <span>%</span>
                              </div>
                              {activeTab === 'defAbility' && (
                                <div className={styles.valDisclaimerText}>
                                  Abilities used in freeze time or up to 25 seconds after round start
                                </div>
                              )}
                              
                              <div className={styles.valRightTableBody}>
                                {allClusters.map((c, idx) => {
                                  const clusterColor = CLUSTER_COLORS[idx % CLUSTER_COLORS.length]
                                  const isActive = effectiveSelection.has(c.id)
                                  return (
                                    <div
                                      key={c.id}
                                      className={`${styles.valRightTableRow} ${isActive ? styles.valRightTableRowActive : ''}`}
                                      style={isActive ? { 
                                        background: `${clusterColor}25`,
                                        borderLeft: `3px solid ${clusterColor}`
                                      } : undefined}
                                      onClick={() => {
                                        const newSet = new Set(effectiveSelection)
                                        if (newSet.has(c.id)) {
                                          newSet.delete(c.id)
                                        } else {
                                          newSet.add(c.id)
                                        }
                                        setSelection(newSet)
                                      }}
                                    >
                                      <div className={styles.valRightAbilityCell}>
                                        {c.playerName}{c.extra ? `: ${c.extra}` : ''}
                                      </div>
                                      <div className={styles.valRightLocationCell}>
                                        {c.callout || '-'}
                                      </div>
                                      <div className={styles.valRightPercentCell}>
                                        {c.percentage > 0 ? `${Math.round(c.percentage)}%` : (c.count > 0 ? c.count : '-')}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </>
                          )}
                        </div>
                      </>
                    )
                  })()}
                </div>
                
                {/* Lurker Tendencies */}
                {lurkerMapData && (() => {
                  const filteredPlayers = lurkerMapData.players
                    .filter(p => p.lurkPercentage >= 10)
                    .map(player => ({
                      ...player,
                      byPushSite: player.byPushSite.filter(ps => ps.pushSite !== 'Attacker Side'),
                    }))
                  
                  if (filteredPlayers.length === 0) return null
                  
                  return (
                    <div className={`${styles.valPerMapSubsection} ${styles.valPerMapSubsectionFull}`}>
                      <div className={styles.valPerMapSubsectionHeader}>
                        Lurker Tendencies <span className={styles.valPerMapSampleSize}>({lurkerMapData.totalAttackRounds} attack rounds)</span>
                      </div>
                      <div className={styles.valLurkerPlayers}>
                        {filteredPlayers.map((player) => (
                          <div key={player.playerId} className={styles.valLurkerPlayerRow}>
                            <div className={styles.valLurkerPlayerHeader}>
                              <span className={styles.valLurkerPlayerName}>{player.playerName}</span>
                              <span className={styles.valLurkerPlayerStats}>
                                Lurks {Math.round(player.lurkPercentage)}% ({player.lurkCount}/{player.totalAttackRounds})
                              </span>
                            </div>
                            
                            {player.byPushSite.length > 0 && (
                              <div className={styles.valLurkerByPush}>
                                {player.byPushSite.map((pushData) => (
                                  <div key={pushData.pushSite} className={styles.valLurkerPushRow}>
                                    <span className={styles.valLurkerPushLabel}>
                                      When team goes {pushData.pushSite}:
                                    </span>
                                    <div className={styles.valLurkerLocations}>
                                      {pushData.lurkLocations.slice(0, 3).map((loc, idx) => (
                                        <span key={idx} className={styles.valLurkerLocation}>
                                          {loc.superRegion} ({loc.count})
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}
              </div>
            )
          })()}
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
