'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useGridData, Tournament, Team } from '../contexts/GridDataContext'
import styles from './TournamentSelector.module.css'

interface TournamentSelectorProps {
  game: 'lol' | 'valorant'
}

export default function TournamentSelector({ game }: TournamentSelectorProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  
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
    } else {
      setSelectedTeam(team)
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
          <div className={styles.gamesPanelHeader}>
            <h3 className={styles.gamesPanelTitle}>
              {selectedTeam.name}
              {games.length > 0 && (
                <span className={styles.gamesCount}>{games.length} Games</span>
              )}
            </h3>
            <button
              className={`${styles.fetchGamesButton} ${accentClass}`}
              onClick={fetchGames}
              disabled={gamesLoading}
            >
              {gamesLoading ? 'Loading...' : games.length > 0 ? 'Refetch Games' : 'Fetch Games'}
            </button>
          </div>
          
          {gamesLoading ? (
            <div className={styles.gamesLoading}>Loading games...</div>
          ) : gamesError ? (
            <div className={styles.error}>{gamesError}</div>
          ) : games.length === 0 ? (
            <div className={styles.placeholder}>Click "Fetch Games" to load</div>
          ) : (
            <div className={styles.gamesList}>
              {games.map((gameItem) => (
                <Link 
                  key={gameItem.id} 
                  href={`/${game === 'lol' ? 'lol' : 'val'}/series/${gameItem.id}`}
                  className={styles.gameRow}
                >
                  <div className={styles.gameDate}>{formatDate(gameItem.date)}</div>
                  <div className={styles.gameMatchup}>
                    <span className={styles.gameTeam}>{selectedTeam.name}</span>
                    <span className={styles.gameVs}>vs</span>
                    <span className={styles.gameOpponent}>{gameItem.opponent.name}</span>
                  </div>
                  <div className={styles.gameTournament}>{gameItem.tournament}</div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
