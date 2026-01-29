'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import styles from './InteractivePlayer.module.css'
import { getChampionImagePath } from '../utils/championMapping'

// Map dimensions - Summoner's Rift is 16000x16000 units
const MAP_MAX_COORDINATE = 16000

interface PlayerCoordinate {
  playerId: string
  x: number
  y: number
}

interface CoordinateSnapshot {
  time: number
  playerCoordinates: PlayerCoordinate[]
}

interface GamePlayer {
  id: string
  name: string
  champName: string
  teamId: string
}

interface InteractivePlayerProps {
  coordinateTracking: CoordinateSnapshot[]
  players: GamePlayer[]
  gameLength: number
  blueSideTeamId: string
}

export default function InteractivePlayer({
  coordinateTracking,
  players,
  gameLength,
  blueSideTeamId
}: InteractivePlayerProps) {
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const progressBarRef = useRef<HTMLDivElement>(null)

  // Get interpolated coordinates for the current time
  const getCurrentCoordinates = useCallback((): PlayerCoordinate[] => {
    if (!coordinateTracking || coordinateTracking.length === 0) return []
    
    // Find the snapshots before and after current time
    let beforeSnapshot: CoordinateSnapshot | null = null
    let afterSnapshot: CoordinateSnapshot | null = null
    
    for (let i = 0; i < coordinateTracking.length; i++) {
      const snapshot = coordinateTracking[i]
      if (snapshot.time <= currentTime) {
        beforeSnapshot = snapshot
      } else {
        afterSnapshot = snapshot
        break
      }
    }
    
    // If no before snapshot, return empty
    if (!beforeSnapshot) return []
    
    // If no after snapshot or times are equal, return the before snapshot as-is
    if (!afterSnapshot || beforeSnapshot.time === afterSnapshot.time) {
      return beforeSnapshot.playerCoordinates
    }
    
    // Calculate interpolation factor (0 to 1)
    const timeDiff = afterSnapshot.time - beforeSnapshot.time
    const timeProgress = currentTime - beforeSnapshot.time
    const t = Math.max(0, Math.min(1, timeProgress / timeDiff))
    
    // Interpolate each player's position
    const interpolatedCoords: PlayerCoordinate[] = []
    
    for (const beforeCoord of beforeSnapshot.playerCoordinates) {
      // Find matching player in after snapshot
      const afterCoord = afterSnapshot.playerCoordinates.find(
        c => c.playerId === beforeCoord.playerId
      )
      
      if (afterCoord) {
        // Linear interpolation: before + (after - before) * t
        interpolatedCoords.push({
          playerId: beforeCoord.playerId,
          x: Math.round(beforeCoord.x + (afterCoord.x - beforeCoord.x) * t),
          y: Math.round(beforeCoord.y + (afterCoord.y - beforeCoord.y) * t)
        })
      } else {
        // Player not in after snapshot, use before position
        interpolatedCoords.push(beforeCoord)
      }
    }
    
    return interpolatedCoords
  }, [coordinateTracking, currentTime])

  // Get player info by ID
  const getPlayerInfo = useCallback((playerId: string): GamePlayer | undefined => {
    return players.find(p => p.id === playerId)
  }, [players])

  // Get team side for a player
  const getPlayerSide = useCallback((playerId: string): 'blue' | 'red' => {
    const player = getPlayerInfo(playerId)
    if (!player) return 'blue'
    return player.teamId === blueSideTeamId ? 'blue' : 'red'
  }, [getPlayerInfo, blueSideTeamId])

  // Start/stop playback - 100ms intervals for smooth interpolation
  const TICK_INTERVAL_MS = 100
  const TIME_INCREMENT = 0.1 // seconds per tick
  
  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setCurrentTime(prev => {
          const next = prev + TIME_INCREMENT * playbackSpeed
          if (next >= gameLength) {
            setIsPlaying(false)
            return gameLength
          }
          return next
        })
      }, TICK_INTERVAL_MS)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isPlaying, playbackSpeed, gameLength])

  // Handle play/pause
  const togglePlay = () => {
    if (currentTime >= gameLength) {
      setCurrentTime(0)
    }
    setIsPlaying(!isPlaying)
  }

  // Handle progress bar click
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current) return
    
    const rect = progressBarRef.current.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const percentage = clickX / rect.width
    const newTime = Math.floor(percentage * gameLength)
    setCurrentTime(Math.max(0, Math.min(newTime, gameLength)))
  }

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const currentCoordinates = getCurrentCoordinates()
  const progressPercentage = gameLength > 0 ? (currentTime / gameLength) * 100 : 0

  return (
    <div className={styles.container}>
      {/* Map Container */}
      <div className={styles.mapWrapper}>
        <div className={styles.mapContainer}>
        <Image
          src="/map.png"
          alt="Summoner's Rift"
          width={512}
          height={512}
          className={styles.mapImage}
          priority
        />
        
        {/* Player Icons */}
        {currentCoordinates.map(coord => {
          const playerInfo = getPlayerInfo(coord.playerId)
          if (!playerInfo) return null
          
          const side = getPlayerSide(coord.playerId)
          // Convert game coordinates to percentage (flip Y axis since map Y is inverted)
          const xPercent = (coord.x / MAP_MAX_COORDINATE) * 100
          const yPercent = (1 - coord.y / MAP_MAX_COORDINATE) * 100
          
          return (
            <div
              key={coord.playerId}
              className={`${styles.playerIcon} ${styles[side]}`}
              style={{
                left: `${xPercent}%`,
                top: `${yPercent}%`
              }}
              title={`${playerInfo.name} (${playerInfo.champName})`}
            >
              <Image
                src={getChampionImagePath(playerInfo.champName)}
                alt={playerInfo.champName}
                width={24}
                height={24}
                className={styles.championImage}
                unoptimized
              />
            </div>
          )
        })}
        </div>
        
        {/* Progress Bar - Below Map */}
        <div 
          ref={progressBarRef}
          className={styles.progressBar}
          onClick={handleProgressClick}
        >
          <div 
            className={styles.progressFill}
            style={{ width: `${progressPercentage}%` }}
          />
          <div 
            className={styles.progressHandle}
            style={{ left: `${progressPercentage}%` }}
          />
        </div>
        
        {/* Controls - Below Progress Bar */}
        <div className={styles.controls}>
          <button 
            className={styles.playButton} 
            onClick={togglePlay}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>
          
          <span className={styles.timeDisplay}>
            {formatTime(currentTime)} / {formatTime(gameLength)}
          </span>
          
          <div className={styles.speedControl}>
            <span className={styles.speedLabel}>Speed:</span>
            {[0.5, 1, 2, 4, 8].map(speed => (
              <button
                key={speed}
                className={`${styles.speedButton} ${playbackSpeed === speed ? styles.active : ''}`}
                onClick={() => setPlaybackSpeed(speed)}
              >
                {speed}x
              </button>
            ))}
          </div>
          
          <button 
            className={styles.debugButton}
            onClick={() => {
              const coords = getCurrentCoordinates()
              const coordsWithInfo = coords.map(c => {
                const player = getPlayerInfo(c.playerId)
                return {
                  playerId: c.playerId,
                  playerName: player?.name,
                  champion: player?.champName,
                  x: c.x,
                  y: c.y
                }
              })
              console.log(`[${formatTime(currentTime)}] Player Coordinates:`, coordsWithInfo)
            }}
            title="Log coordinates to console"
          >
            Log Coords
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className={styles.legend}>
        <div className={styles.legendSection}>
          <span className={`${styles.legendDot} ${styles.blue}`} />
          <span>Blue Side</span>
        </div>
        <div className={styles.legendSection}>
          <span className={`${styles.legendDot} ${styles.red}`} />
          <span>Red Side</span>
        </div>
      </div>
    </div>
  )
}
