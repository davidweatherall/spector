'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import Image from 'next/image'
import styles from './ValorantMapPlayer.module.css'
import { getMapCoordinateConfig, getMapCoordinateConfigFromBounds, getMapBounds } from '../utils/valorantMapData'

interface PlayerCoordinate {
  playerId: string
  x: number
  y: number
}

interface CoordinateSnapshot {
  time: number
  playerCoordinates: PlayerCoordinate[]
}

interface ValorantPlayer {
  id: string
  name: string
  teamId: string
  characterId?: string // e.g. 'viper', 'fade' - for agent image
}

interface PlayerKill {
  killerId: string
  killerName: string
  victimId: string
  victimName: string
  occurredAt: string
}

interface CoordinateBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

interface ValorantMapPlayerProps {
  mapName: string
  coordinateTracking: CoordinateSnapshot[]
  players: ValorantPlayer[]
  team1Id: string // First team ID (for color assignment)
  roundNumber: number
  kills?: PlayerKill[] // Kill events for this round
}

export default function ValorantMapPlayer({
  mapName,
  coordinateTracking,
  players,
  team1Id,
  roundNumber,
  kills = [],
}: ValorantMapPlayerProps) {
  const [currentTime, setCurrentTime] = useState(0) // Time offset from start in ms
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  // 'callouts' uses bounds from map callouts, 'api' uses Valorant API multipliers, 'auto' uses round data bounds
  const [coordMode, setCoordMode] = useState<'callouts' | 'api' | 'auto'>('callouts')
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastTickTimeRef = useRef<number>(0) // Track real time for accurate playback
  const progressBarRef = useRef<HTMLDivElement>(null)

  // Get map configs from the valorantMapData utility
  const apiConfig = useMemo(() => getMapCoordinateConfig(mapName), [mapName])
  const calloutConfig = useMemo(() => getMapCoordinateConfigFromBounds(mapName), [mapName])
  const mapBounds = useMemo(() => getMapBounds(mapName), [mapName])
  const mapImagePath = `/val-map/${mapName.toLowerCase()}.png`

  // Calculate time bounds from coordinate tracking
  const timeBounds = useMemo(() => {
    if (!coordinateTracking || coordinateTracking.length === 0) {
      return { startTime: 0, endTime: 0, duration: 0 }
    }
    const startTime = coordinateTracking[0].time
    const endTime = coordinateTracking[coordinateTracking.length - 1].time
    return {
      startTime,
      endTime,
      duration: endTime - startTime,
    }
  }, [coordinateTracking])

  // Determine which players are dead at the current time
  const deadPlayers = useMemo(() => {
    const absoluteTime = timeBounds.startTime + currentTime
    const dead = new Set<string>()
    
    for (const kill of kills) {
      const killTime = new Date(kill.occurredAt).getTime()
      if (killTime <= absoluteTime) {
        dead.add(kill.victimId)
      }
    }
    
    return dead
  }, [kills, currentTime, timeBounds.startTime])

  // Check if a player is dead
  const isPlayerDead = useCallback((playerId: string): boolean => {
    return deadPlayers.has(playerId)
  }, [deadPlayers])

  // Calculate bounds from all coordinate data in this round
  const coordinateBounds = useMemo((): CoordinateBounds => {
    let minX = Infinity, maxX = -Infinity
    let minY = Infinity, maxY = -Infinity

    for (const snapshot of coordinateTracking) {
      for (const coord of snapshot.playerCoordinates) {
        minX = Math.min(minX, coord.x)
        maxX = Math.max(maxX, coord.x)
        minY = Math.min(minY, coord.y)
        maxY = Math.max(maxY, coord.y)
      }
    }

    // Add 10% padding to bounds
    const xPadding = (maxX - minX) * 0.1
    const yPadding = (maxY - minY) * 0.1

    return {
      minX: minX - xPadding,
      maxX: maxX + xPadding,
      minY: minY - yPadding,
      maxY: maxY + yPadding,
    }
  }, [coordinateTracking])

  // Get interpolated coordinates for the current time
  const getCurrentCoordinates = useCallback((): PlayerCoordinate[] => {
    if (!coordinateTracking || coordinateTracking.length === 0) return []
    
    const absoluteTime = timeBounds.startTime + currentTime
    
    // Find the snapshots before and after current time
    let beforeSnapshot: CoordinateSnapshot | null = null
    let afterSnapshot: CoordinateSnapshot | null = null
    
    for (let i = 0; i < coordinateTracking.length; i++) {
      const snapshot = coordinateTracking[i]
      if (snapshot.time <= absoluteTime) {
        beforeSnapshot = snapshot
      } else {
        afterSnapshot = snapshot
        break
      }
    }
    
    // If no before snapshot, return first snapshot's coords
    if (!beforeSnapshot) {
      return coordinateTracking[0].playerCoordinates
    }
    
    // If no after snapshot or times are equal, return the before snapshot as-is
    if (!afterSnapshot || beforeSnapshot.time === afterSnapshot.time) {
      return beforeSnapshot.playerCoordinates
    }
    
    // Calculate interpolation factor (0 to 1)
    const timeDiff = afterSnapshot.time - beforeSnapshot.time
    const timeProgress = absoluteTime - beforeSnapshot.time
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
          x: beforeCoord.x + (afterCoord.x - beforeCoord.x) * t,
          y: beforeCoord.y + (afterCoord.y - beforeCoord.y) * t,
        })
      } else {
        // Player not in after snapshot, use before position
        interpolatedCoords.push(beforeCoord)
      }
    }
    
    return interpolatedCoords
  }, [coordinateTracking, currentTime, timeBounds.startTime])

  // Get player info by ID
  const getPlayerInfo = useCallback((playerId: string): ValorantPlayer | undefined => {
    return players.find(p => p.id === playerId)
  }, [players])

  // Get team side for a player
  const getPlayerSide = useCallback((playerId: string): 'team1' | 'team2' => {
    const player = getPlayerInfo(playerId)
    if (!player) return 'team1'
    return player.teamId === team1Id ? 'team1' : 'team2'
  }, [getPlayerInfo, team1Id])

  // Convert using a config (API or callout-based multipliers)
  const convertWithConfig = useCallback((x: number, y: number, config: typeof apiConfig): { xPercent: number; yPercent: number } => {
    const normalizedX = x * config.xMultiplier + config.xScalarToAdd
    const normalizedY = y * config.yMultiplier + config.yScalarToAdd
    return {
      xPercent: normalizedX * 100,
      yPercent: normalizedY * 100,
    }
  }, [])

  // Convert using auto-calculated bounds from round data
  const convertWithAutoBounds = useCallback((x: number, y: number): { xPercent: number; yPercent: number } => {
    const { minX, maxX, minY, maxY } = coordinateBounds
    const rangeX = maxX - minX
    const rangeY = maxY - minY

    // Normalize to 0-1, then to percentage (5%-95% range)
    const normalizedX = rangeX > 0 ? (x - minX) / rangeX : 0.5
    const normalizedY = rangeY > 0 ? (y - minY) / rangeY : 0.5

    return {
      xPercent: 5 + normalizedX * 90, // Map to 5%-95% range
      yPercent: 5 + (1 - normalizedY) * 90, // Flip Y axis, map to 5%-95% range
    }
  }, [coordinateBounds])

  // Main conversion function - choose method based on mode
  const convertToPercent = useCallback((x: number, y: number): { xPercent: number; yPercent: number } => {
    switch (coordMode) {
      case 'api':
        return convertWithConfig(x, y, apiConfig)
      case 'callouts':
        return convertWithConfig(x, y, calloutConfig)
      case 'auto':
        return convertWithAutoBounds(x, y)
      default:
        return convertWithConfig(x, y, calloutConfig)
    }
  }, [coordMode, apiConfig, calloutConfig, convertWithConfig, convertWithAutoBounds])

  // Playback interval - advance time based on real elapsed time
  const TICK_INTERVAL_MS = 16 // ~60fps for smooth animation

  useEffect(() => {
    if (isPlaying && timeBounds.duration > 0) {
      lastTickTimeRef.current = performance.now()
      
      intervalRef.current = setInterval(() => {
        const now = performance.now()
        const realElapsed = now - lastTickTimeRef.current
        lastTickTimeRef.current = now
        
        // Convert real elapsed time to game time based on playback speed
        const gameTimeElapsed = realElapsed * playbackSpeed
        
        setCurrentTime(prev => {
          const next = prev + gameTimeElapsed
          if (next >= timeBounds.duration) {
            setIsPlaying(false)
            return timeBounds.duration
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
  }, [isPlaying, playbackSpeed, timeBounds.duration])

  // Handle play/pause
  const togglePlay = () => {
    if (currentTime >= timeBounds.duration) {
      setCurrentTime(0)
    }
    setIsPlaying(!isPlaying)
  }

  // Handle progress bar click
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || timeBounds.duration === 0) return
    
    const rect = progressBarRef.current.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const percentage = clickX / rect.width
    const newTime = percentage * timeBounds.duration
    setCurrentTime(Math.max(0, Math.min(newTime, timeBounds.duration)))
  }

  // Format time as MM:SS
  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000)
    const mins = Math.floor(totalSeconds / 60)
    const secs = totalSeconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const currentCoordinates = getCurrentCoordinates()
  const progressPercentage = timeBounds.duration > 0 
    ? (currentTime / timeBounds.duration) * 100 
    : 0

  if (!coordinateTracking || coordinateTracking.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.noData}>No coordinate data for Round {roundNumber}</div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.roundLabel}>Round {roundNumber}</span>
        <span className={styles.snapshotInfo}>
          {formatTime(currentTime)} / {formatTime(timeBounds.duration)}
        </span>
      </div>

      {/* Map Container */}
      <div className={styles.mapWrapper}>
        <div className={styles.mapContainer}>
          <Image
            src={mapImagePath}
            alt={mapName}
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
            const { xPercent, yPercent } = convertToPercent(coord.x, coord.y)
            const isDead = isPlayerDead(coord.playerId)
            const agentImagePath = playerInfo.characterId 
              ? `/agents/${playerInfo.characterId.toLowerCase()}.png`
              : null
            
            return (
              <div
                key={coord.playerId}
                className={`${styles.playerIcon} ${styles[side]}`}
                style={{
                  left: `${xPercent}%`,
                  top: `${yPercent}%`,
                  opacity: isDead ? 0.5 : 1,
                }}
                title={`${playerInfo.name}${isDead ? ' (Dead)' : ''} (${coord.x.toFixed(0)}, ${coord.y.toFixed(0)})`}
              >
                {agentImagePath ? (
                  <Image
                    src={agentImagePath}
                    alt={playerInfo.characterId || playerInfo.name}
                    width={24}
                    height={24}
                    className={styles.agentImage}
                  />
                ) : (
                  <span className={styles.playerInitial}>
                    {playerInfo.name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
            )
          })}
        </div>
        
        {/* Progress Bar */}
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
        
        {/* Controls */}
        <div className={styles.controls}>
          <button 
            className={styles.playButton} 
            onClick={togglePlay}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>
          
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

          <div className={styles.speedControl} style={{ marginLeft: '0.5rem' }}>
            <span className={styles.speedLabel}>Mode:</span>
            {(['callouts', 'api', 'auto'] as const).map(mode => (
              <button
                key={mode}
                className={`${styles.speedButton} ${coordMode === mode ? styles.active : ''}`}
                onClick={() => setCoordMode(mode)}
                title={mode === 'callouts' ? 'Use callout locations from map data' : mode === 'api' ? 'Use Valorant API multipliers' : 'Use bounds from round data'}
              >
                {mode === 'callouts' ? 'Map' : mode === 'api' ? 'API' : 'Auto'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className={styles.legend}>
        {players.filter((p, i, arr) => arr.findIndex(x => x.teamId === p.teamId) === i).map((team) => {
          const teamPlayers = players.filter(p => p.teamId === team.teamId)
          const side = team.teamId === team1Id ? 'team1' : 'team2'
          return (
            <div key={team.teamId} className={styles.legendSection}>
              <span className={`${styles.legendDot} ${styles[side]}`} />
              <span>{teamPlayers.map(p => p.name).join(', ')}</span>
            </div>
          )
        })}
      </div>

      {/* Debug info */}
      <div style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', marginTop: '0.5rem' }}>
        {coordinateTracking.length} snapshots | Mode: {coordMode}
      </div>
    </div>
  )
}
