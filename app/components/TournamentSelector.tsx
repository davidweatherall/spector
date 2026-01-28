'use client'

import { useEffect } from 'react'
import { useGridData, Tournament } from '../contexts/GridDataContext'
import styles from './TournamentSelector.module.css'

interface TournamentSelectorProps {
  game: 'lol' | 'valorant'
}

export default function TournamentSelector({ game }: TournamentSelectorProps) {
  const {
    lolData,
    lolLoading,
    lolError,
    fetchLolData,
    selectedLolLeague,
    setSelectedLolLeague,
    selectedLolTournaments,
    toggleLolTournament,
    valData,
    valLoading,
    valError,
    fetchValData,
    selectedValLeague,
    setSelectedValLeague,
    selectedValTournaments,
    toggleValTournament,
  } = useGridData()

  const data = game === 'lol' ? lolData : valData
  const loading = game === 'lol' ? lolLoading : valLoading
  const error = game === 'lol' ? lolError : valError
  const selectedLeague = game === 'lol' ? selectedLolLeague : selectedValLeague
  const setSelectedLeague = game === 'lol' ? setSelectedLolLeague : setSelectedValLeague
  const selectedTournaments = game === 'lol' ? selectedLolTournaments : selectedValTournaments
  const toggleTournament = game === 'lol' ? toggleLolTournament : toggleValTournament
  const fetchData = game === 'lol' ? fetchLolData : fetchValData

  useEffect(() => {
    if (!data && !loading && !error) {
      fetchData()
    }
  }, [data, loading, error, fetchData])

  const handleLeagueChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const league = e.target.value
    setSelectedLeague(league === '' ? null : league)
  }

  const handleTournamentToggle = (tournament: Tournament) => {
    toggleTournament(tournament)
  }

  const isSelected = (tournament: Tournament) => {
    return selectedTournaments.some(t => t.id === tournament.id)
  }

  const accentClass = game === 'lol' ? styles.lolAccent : styles.valAccent
  const tournamentsForLeague = selectedLeague && data 
    ? data.tournamentsByLeague[selectedLeague] || []
    : []

  return (
    <div className={styles.container}>
      {/* League Selector */}
      <div className={styles.field}>
        <label className={styles.label}>Select League</label>
        <div className={`${styles.selectWrapper} ${accentClass}`}>
          <select
            className={styles.select}
            value={selectedLeague || ''}
            onChange={handleLeagueChange}
            disabled={loading}
          >
            <option value="">
              {loading ? 'Loading leagues...' : 'Choose a league'}
            </option>
            {data?.leagues.map((league) => (
              <option key={league} value={league}>
                {league}
              </option>
            ))}
          </select>
          <div className={styles.selectArrow}>
            <svg width="12" height="8" viewBox="0 0 12 8" fill="currentColor">
              <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"/>
            </svg>
          </div>
        </div>
      </div>

      {/* Tournament Multi-Select */}
      {selectedLeague && tournamentsForLeague.length > 0 && (
        <div className={styles.field}>
          <label className={styles.label}>
            Select Tournaments 
            <span className={styles.selectedCount}>
              ({selectedTournaments.length} selected)
            </span>
          </label>
          <div className={`${styles.checkboxList} ${accentClass}`}>
            {tournamentsForLeague.map((tournament) => (
              <label 
                key={tournament.id} 
                className={`${styles.checkboxItem} ${isSelected(tournament) ? styles.checked : ''}`}
              >
                <input
                  type="checkbox"
                  checked={isSelected(tournament)}
                  onChange={() => handleTournamentToggle(tournament)}
                  className={styles.checkbox}
                />
                <span className={styles.checkboxCustom}>
                  {isSelected(tournament) && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </span>
                <span className={styles.checkboxLabel}>
                  {tournament.name}
                  {tournament.isLive && (
                    <span className={styles.liveBadge}>LIVE</span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}
    </div>
  )
}
