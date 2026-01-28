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
  selectedLolLeague: string | null
  setSelectedLolLeague: (league: string | null) => void
  selectedLolTournaments: Tournament[]
  setSelectedLolTournaments: (tournaments: Tournament[]) => void
  toggleLolTournament: (tournament: Tournament) => void

  // Valorant data
  valData: TournamentsData | null
  valLoading: boolean
  valError: string | null
  fetchValData: () => Promise<void>
  selectedValLeague: string | null
  setSelectedValLeague: (league: string | null) => void
  selectedValTournaments: Tournament[]
  setSelectedValTournaments: (tournaments: Tournament[]) => void
  toggleValTournament: (tournament: Tournament) => void
}

const GridDataContext = createContext<GridDataContextType | undefined>(undefined)

// Helper to find the most recent tournament
function getMostRecentTournament(tournaments: Tournament[]): Tournament | null {
  if (tournaments.length === 0) return null
  
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
  const [selectedLolLeague, setSelectedLolLeagueState] = useState<string | null>(null)
  const [selectedLolTournaments, setSelectedLolTournaments] = useState<Tournament[]>([])

  // Valorant state
  const [valData, setValData] = useState<TournamentsData | null>(null)
  const [valLoading, setValLoading] = useState(false)
  const [valError, setValError] = useState<string | null>(null)
  const [selectedValLeague, setSelectedValLeagueState] = useState<string | null>(null)
  const [selectedValTournaments, setSelectedValTournaments] = useState<Tournament[]>([])

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

  // Set league and auto-select most recent tournament
  const setSelectedLolLeague = useCallback((league: string | null) => {
    setSelectedLolLeagueState(league)
    if (league && lolData) {
      const tournaments = lolData.tournamentsByLeague[league] || []
      const mostRecent = getMostRecentTournament(tournaments)
      setSelectedLolTournaments(mostRecent ? [mostRecent] : [])
    } else {
      setSelectedLolTournaments([])
    }
  }, [lolData])

  const setSelectedValLeague = useCallback((league: string | null) => {
    setSelectedValLeagueState(league)
    if (league && valData) {
      const tournaments = valData.tournamentsByLeague[league] || []
      const mostRecent = getMostRecentTournament(tournaments)
      setSelectedValTournaments(mostRecent ? [mostRecent] : [])
    } else {
      setSelectedValTournaments([])
    }
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
    selectedLolLeague,
    setSelectedLolLeague,
    selectedLolTournaments,
    setSelectedLolTournaments,
    toggleLolTournament,

    valData,
    valLoading,
    valError,
    fetchValData,
    selectedValLeague,
    setSelectedValLeague,
    selectedValTournaments,
    setSelectedValTournaments,
    toggleValTournament,
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
