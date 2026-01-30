'use client'

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'

// Types
export interface Tournament {
  id: string
  name: string
  league: string
  startDate?: string
  endDate?: string
  isLive: boolean
}

export interface Team {
  id: string
  name: string
}

export interface Game {
  id: string
  date: string | null
  tournament: string
  opponent: Team
  isHome: boolean
}

interface TournamentsData {
  tournaments: Tournament[]
  leagues: string[]
  tournamentsByLeague: Record<string, Tournament[]>
}

interface GridDataContextType {
  // LoL data
  lolData: TournamentsData | null
  lolLoading: boolean
  lolError: string | null
  fetchLolData: () => Promise<void>
  selectedLolLeagues: string[]
  setSelectedLolLeagues: (leagues: string[]) => void
  toggleLolLeague: (league: string) => void
  selectedLolTournaments: Tournament[]
  setSelectedLolTournaments: (tournaments: Tournament[]) => void
  toggleLolTournament: (tournament: Tournament) => void
  lolTeams: Team[]
  lolTeamsLoading: boolean
  lolTeamsError: string | null
  fetchLolTeams: () => Promise<void>
  selectedLolTeam: Team | null
  setSelectedLolTeam: (team: Team | null) => void
  lolGames: Game[]
  lolGamesLoading: boolean
  lolGamesError: string | null
  fetchLolGames: () => Promise<void>

  // Valorant data
  valData: TournamentsData | null
  valLoading: boolean
  valError: string | null
  fetchValData: () => Promise<void>
  selectedValLeagues: string[]
  setSelectedValLeagues: (leagues: string[]) => void
  toggleValLeague: (league: string) => void
  selectedValTournaments: Tournament[]
  setSelectedValTournaments: (tournaments: Tournament[]) => void
  toggleValTournament: (tournament: Tournament) => void
  valTeams: Team[]
  valTeamsLoading: boolean
  valTeamsError: string | null
  fetchValTeams: () => Promise<void>
  selectedValTeam: Team | null
  setSelectedValTeam: (team: Team | null) => void
  valGames: Game[]
  valGamesLoading: boolean
  valGamesError: string | null
  fetchValGames: () => Promise<void>
}

const GridDataContext = createContext<GridDataContextType | undefined>(undefined)

// Helper to find the most recent tournament
function getMostRecentTournament(tournaments: Tournament[]): Tournament | null {
  if (tournaments.length === 0) return null
  
  // Prioritize live tournaments first
  const liveTournaments = tournaments.filter(t => t.isLive)
  if (liveTournaments.length > 0) {
    return liveTournaments.reduce((latest, current) => {
      if (!latest.startDate) return current
      if (!current.startDate) return latest
      return new Date(current.startDate) > new Date(latest.startDate) ? current : latest
    })
  }
  
  return tournaments.reduce((latest, current) => {
    if (!latest.startDate) return current
    if (!current.startDate) return latest
    return new Date(current.startDate) > new Date(latest.startDate) ? current : latest
  })
}

interface GridDataProviderProps {
  children: ReactNode
}

export function GridDataProvider({ children }: GridDataProviderProps) {
  // LoL state
  const [lolData, setLolData] = useState<TournamentsData | null>(null)
  const [lolLoading, setLolLoading] = useState(false)
  const [lolError, setLolError] = useState<string | null>(null)
  const [selectedLolLeagues, setSelectedLolLeaguesState] = useState<string[]>([])
  const [selectedLolTournaments, setSelectedLolTournaments] = useState<Tournament[]>([])
  const [lolTeams, setLolTeams] = useState<Team[]>([])
  const [lolTeamsLoading, setLolTeamsLoading] = useState(false)
  const [lolTeamsError, setLolTeamsError] = useState<string | null>(null)
  const [selectedLolTeam, setSelectedLolTeam] = useState<Team | null>(null)
  const [lolGames, setLolGames] = useState<Game[]>([])
  const [lolGamesLoading, setLolGamesLoading] = useState(false)
  const [lolGamesError, setLolGamesError] = useState<string | null>(null)

  // Valorant state
  const [valData, setValData] = useState<TournamentsData | null>(null)
  const [valLoading, setValLoading] = useState(false)
  const [valError, setValError] = useState<string | null>(null)
  const [selectedValLeagues, setSelectedValLeaguesState] = useState<string[]>([])
  const [selectedValTournaments, setSelectedValTournaments] = useState<Tournament[]>([])
  const [valTeams, setValTeams] = useState<Team[]>([])
  const [valTeamsLoading, setValTeamsLoading] = useState(false)
  const [valTeamsError, setValTeamsError] = useState<string | null>(null)
  const [selectedValTeam, setSelectedValTeam] = useState<Team | null>(null)
  const [valGames, setValGames] = useState<Game[]>([])
  const [valGamesLoading, setValGamesLoading] = useState(false)
  const [valGamesError, setValGamesError] = useState<string | null>(null)

  // Fetch LoL data
  const fetchLolData = useCallback(async () => {
    setLolLoading(true)
    setLolError(null)

    try {
      const response = await fetch('/api/grid/tournaments?game=lol')
      
      if (!response.ok) {
        throw new Error('Failed to fetch tournaments')
      }

      const data: TournamentsData = await response.json()
      setLolData(data)
    } catch (error) {
      setLolError(error instanceof Error ? error.message : 'Failed to fetch tournaments')
    } finally {
      setLolLoading(false)
    }
  }, [])

  // Fetch Valorant data
  const fetchValData = useCallback(async () => {
    setValLoading(true)
    setValError(null)

    try {
      const response = await fetch('/api/grid/tournaments?game=valorant')
      
      if (!response.ok) {
        throw new Error('Failed to fetch tournaments')
      }

      const data: TournamentsData = await response.json()
      setValData(data)
    } catch (error) {
      setValError(error instanceof Error ? error.message : 'Failed to fetch tournaments')
    } finally {
      setValLoading(false)
    }
  }, [])

  // Fetch LoL teams from selected tournaments
  const fetchLolTeams = useCallback(async () => {
    if (selectedLolTournaments.length === 0) return

    setLolTeamsLoading(true)
    setLolTeamsError(null)

    try {
      const tournamentIds = selectedLolTournaments.map(t => t.id)
      const response = await fetch('/api/grid/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentIds }),
      })

      if (!response.ok) {
        throw new Error('Failed to fetch teams')
      }

      const data = await response.json()
      
      if (data.error) {
        throw new Error(data.error)
      }
      
      setLolTeams(data.teams || [])
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch teams'
      setLolTeamsError(message.includes('rate limit') 
        ? 'Rate limit reached. Please wait a minute and try again.' 
        : message)
    } finally {
      setLolTeamsLoading(false)
    }
  }, [selectedLolTournaments])

  // Fetch Valorant teams from selected tournaments
  const fetchValTeams = useCallback(async () => {
    if (selectedValTournaments.length === 0) return

    setValTeamsLoading(true)
    setValTeamsError(null)

    try {
      const tournamentIds = selectedValTournaments.map(t => t.id)
      const response = await fetch('/api/grid/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentIds, game: 'valorant' }),
      })

      if (!response.ok) {
        throw new Error('Failed to fetch teams')
      }

      const data = await response.json()
      
      if (data.error) {
        throw new Error(data.error)
      }
      
      setValTeams(data.teams || [])
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch teams'
      setValTeamsError(message.includes('rate limit') 
        ? 'Rate limit reached. Please wait a minute and try again.' 
        : message)
    } finally {
      setValTeamsLoading(false)
    }
  }, [selectedValTournaments])

  // Fetch LoL games for selected team
  const fetchLolGames = useCallback(async () => {
    if (!selectedLolTeam || selectedLolTournaments.length === 0) return

    setLolGamesLoading(true)
    setLolGamesError(null)

    try {
      const tournamentIds = selectedLolTournaments.map(t => t.id)
      const response = await fetch('/api/grid/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          teamId: selectedLolTeam.id,
          teamName: selectedLolTeam.name,
          tournamentIds,
        }),
      })

      const data = await response.json()
      
      if (data.error) {
        throw new Error(data.error)
      }
      
      setLolGames(data.games || [])
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch games'
      setLolGamesError(message.includes('rate limit') 
        ? 'Rate limit reached. Please wait and try again.' 
        : message)
    } finally {
      setLolGamesLoading(false)
    }
  }, [selectedLolTeam, selectedLolTournaments])

  // Fetch Valorant games for selected team
  const fetchValGames = useCallback(async () => {
    if (!selectedValTeam || selectedValTournaments.length === 0) return

    setValGamesLoading(true)
    setValGamesError(null)

    try {
      const tournamentIds = selectedValTournaments.map(t => t.id)
      const response = await fetch('/api/grid/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          teamId: selectedValTeam.id,
          teamName: selectedValTeam.name,
          tournamentIds,
          game: 'valorant',
        }),
      })

      const data = await response.json()
      
      if (data.error) {
        throw new Error(data.error)
      }
      
      setValGames(data.games || [])
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch games'
      setValGamesError(message.includes('rate limit') 
        ? 'Rate limit reached. Please wait and try again.' 
        : message)
    } finally {
      setValGamesLoading(false)
    }
  }, [selectedValTeam, selectedValTournaments])

  // Set leagues and auto-select all tournaments from each
  const setSelectedLolLeagues = useCallback((leagues: string[]) => {
    setSelectedLolLeaguesState(leagues)
    setLolTeams([]) // Clear teams when leagues change
    
    if (leagues.length > 0 && lolData) {
      const tournaments: Tournament[] = []
      for (const league of leagues) {
        const leagueTournaments = lolData.tournamentsByLeague[league] || []
        tournaments.push(...leagueTournaments)
      }
      setSelectedLolTournaments(tournaments)
    } else {
      setSelectedLolTournaments([])
    }
  }, [lolData])

  const setSelectedValLeagues = useCallback((leagues: string[]) => {
    setSelectedValLeaguesState(leagues)
    setValTeams([]) // Clear teams when leagues change
    
    if (leagues.length > 0 && valData) {
      const tournaments: Tournament[] = []
      for (const league of leagues) {
        const leagueTournaments = valData.tournamentsByLeague[league] || []
        tournaments.push(...leagueTournaments)
      }
      setSelectedValTournaments(tournaments)
    } else {
      setSelectedValTournaments([])
    }
  }, [valData])

  // Toggle league selection
  const toggleLolLeague = useCallback((league: string) => {
    setSelectedLolLeaguesState(prev => {
      const isSelected = prev.includes(league)
      const newLeagues = isSelected
        ? prev.filter(l => l !== league)
        : [...prev, league]
      
      // Update tournaments - select all from each league
      setLolTeams([])
      if (newLeagues.length > 0 && lolData) {
        const tournaments: Tournament[] = []
        for (const l of newLeagues) {
          const leagueTournaments = lolData.tournamentsByLeague[l] || []
          tournaments.push(...leagueTournaments)
        }
        setSelectedLolTournaments(tournaments)
      } else {
        setSelectedLolTournaments([])
      }
      
      return newLeagues
    })
  }, [lolData])

  const toggleValLeague = useCallback((league: string) => {
    setSelectedValLeaguesState(prev => {
      const isSelected = prev.includes(league)
      const newLeagues = isSelected
        ? prev.filter(l => l !== league)
        : [...prev, league]
      
      // Update tournaments - select all from each league
      setValTeams([])
      if (newLeagues.length > 0 && valData) {
        const tournaments: Tournament[] = []
        for (const l of newLeagues) {
          const leagueTournaments = valData.tournamentsByLeague[l] || []
          tournaments.push(...leagueTournaments)
        }
        setSelectedValTournaments(tournaments)
      } else {
        setSelectedValTournaments([])
      }
      
      return newLeagues
    })
  }, [valData])

  // Toggle tournament selection
  const toggleLolTournament = useCallback((tournament: Tournament) => {
    setSelectedLolTournaments(prev => {
      const isSelected = prev.some(t => t.id === tournament.id)
      if (isSelected) {
        return prev.filter(t => t.id !== tournament.id)
      } else {
        return [...prev, tournament]
      }
    })
  }, [])

  const toggleValTournament = useCallback((tournament: Tournament) => {
    setSelectedValTournaments(prev => {
      const isSelected = prev.some(t => t.id === tournament.id)
      if (isSelected) {
        return prev.filter(t => t.id !== tournament.id)
      } else {
        return [...prev, tournament]
      }
    })
  }, [])

  const value: GridDataContextType = {
    lolData,
    lolLoading,
    lolError,
    fetchLolData,
    selectedLolLeagues,
    setSelectedLolLeagues,
    toggleLolLeague,
    selectedLolTournaments,
    setSelectedLolTournaments,
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
    setSelectedValLeagues,
    toggleValLeague,
    selectedValTournaments,
    setSelectedValTournaments,
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
  }

  return (
    <GridDataContext.Provider value={value}>
      {children}
    </GridDataContext.Provider>
  )
}

export function useGridData() {
  const context = useContext(GridDataContext)
  if (context === undefined) {
    throw new Error('useGridData must be used within a GridDataProvider')
  }
  return context
}
