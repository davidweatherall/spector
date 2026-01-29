/**
 * Converts GRID API data (end-state + events) into streamlined JSON format
 */

import { SeriesEndStateResponse, GameState as EndStateGame, parseDuration } from '../types/seriesEndState'
import { EventBatch, BaseEventBatch, parseEventsFile } from '../types/seriesEvents'

// ============================================================================
// OUTPUT TYPES - Streamlined format
// ============================================================================

export interface StreamlinedSeries {
  teams: StreamlinedTeam[]
  games: StreamlinedGame[]
}

export interface StreamlinedTeam {
  name: string
  id: string
  players: StreamlinedPlayer[]
}

export interface StreamlinedPlayer {
  name: string
  id: string
}

export interface StreamlinedGame {
  id: string
  blueSideTeamId: string
  winnerTeamId: string | null
  gameLength: number // in seconds
  startTime: string // ISO 8601
  players: GamePlayer[]
  draftingActions: DraftingAction[]
  events: GameEvent[]
  coordinateTracking: CoordinateSnapshot[]
}

export interface GamePlayer {
  id: string
  name: string
  champName: string
  teamId: string
}

export interface DraftingAction {
  teamId: string
  champName: string
  action: 'ban' | 'pick'
}

export type GameEvent =
  | PurchaseItemEvent
  | AcquireItemEvent
  | LostItemEvent
  | SoldItemEvent
  | LevelUpEvent
  | KillBTierMonsterEvent
  | KillATierMonsterEvent
  | KillSTierMonsterEvent
  | KillEvent
  | DestroyTowerEvent
  | DestroyInhibitorEvent

export interface PurchaseItemEvent {
  type: 'purchase-item'
  playerId: string
  itemName: string
  time: number
}

export interface AcquireItemEvent {
  type: 'acquire-item'
  playerId: string
  itemName: string
  time: number
}

export interface LostItemEvent {
  type: 'lost-item'
  playerId: string
  itemName: string
  time: number
}

export interface SoldItemEvent {
  type: 'sold-item'
  playerId: string
  itemName: string
  time: number
}

export interface LevelUpEvent {
  type: 'level-up'
  playerId: string
  newLevel: number
  time: number
}

export interface KillBTierMonsterEvent {
  type: 'kill-btier-monster'
  playerId: string
  monsterName: string
  time: number
}

export interface KillATierMonsterEvent {
  type: 'kill-atier-monster'
  playerId: string
  monsterName: string
  time: number
}

export interface KillSTierMonsterEvent {
  type: 'kill-stier-monster'
  playerId: string
  monsterName: string
  time: number
}

export interface KillEvent {
  type: 'kill'
  playerId: string
  targetId: string
  assistPlayerIds: string[]
  time: number
}

export interface DestroyTowerEvent {
  type: 'destroy-tower'
  playerId: string
  towerName: string
  time: number
}

export interface DestroyInhibitorEvent {
  type: 'destroy-inhibitor'
  playerId: string
  inhibitorName: string
  time: number
}

export interface CoordinateSnapshot {
  time: number
  playerCoordinates: PlayerCoordinate[]
}

export interface PlayerCoordinate {
  playerId: string
  x: number
  y: number
  gold: number
  worth: number
}

// ============================================================================
// SINGLE-PASS GAME DATA - Collected during event processing
// ============================================================================

interface GameDataCollector {
  events: GameEvent[]
  coordinates: Map<number, CoordinateSnapshot>
  players: GamePlayer[]
  gameLength: number
  itemIdToName: Map<string, string>
}

// ============================================================================
// CONVERTER FUNCTIONS
// ============================================================================

/**
 * Convert GRID end-state and events data into streamlined format
 */
export function convertSeriesData(
  endState: SeriesEndStateResponse,
  eventsContent: string
): StreamlinedSeries {
  const eventBatches = parseEventsFile(eventsContent)
  
  // Extract teams from end-state
  const teams = extractTeams(endState)
  
  // Single-pass extraction of all game data from events
  const gameDataMap = extractAllGameData(eventBatches)
  
  // Convert each game (filter out games that weren't started/played)
  const games = endState.seriesState.games
    .filter(game => game.started === true)
    .map((game) => {
      const gameData = gameDataMap.get(game.sequenceNumber)
      return convertGame(game, gameData)
    })
  
  return { teams, games }
}

/**
 * Extract teams and players from end-state
 */
function extractTeams(endState: SeriesEndStateResponse): StreamlinedTeam[] {
  // Get unique teams from series teams and game teams
  const teamMap = new Map<string, StreamlinedTeam>()
  
  // First, get team names from series level
  const seriesTeams = endState.seriesState.teams
  
  // Then get detailed player info from games
  for (const game of endState.seriesState.games) {
    for (const team of game.teams) {
      if (!teamMap.has(team.id)) {
        teamMap.set(team.id, {
          id: team.id,
          name: team.name,
          players: team.players.map(player => ({
            id: player.id,
            name: player.name
          }))
        })
      }
    }
  }
  
  // Fallback to series teams if no game data
  if (teamMap.size === 0) {
    for (let i = 0; i < seriesTeams.length; i++) {
      const team = seriesTeams[i]
      teamMap.set(team.id || String(i), {
        id: team.id || String(i),
        name: team.name,
        players: []
      })
    }
  }
  
  return Array.from(teamMap.values())
}

/**
 * Single-pass extraction of all game data from event batches
 * Tracks game boundaries using series-started-game, game-started-gameClock and team-won-game events
 */
function extractAllGameData(batches: BaseEventBatch[]): Map<number, GameDataCollector> {
  const gameDataMap = new Map<number, GameDataCollector>()
  
  let currentGameNumber = 0
  let isTracking = false
  let currentGameData: GameDataCollector | null = null
  let pendingGameData: GameDataCollector | null = null // Holds data before game clock starts
  
  for (const batch of batches) {
    for (const event of batch.events) {
      // series-started-game fires before game-started-gameClock
      // This is where we get player/champion data for the upcoming game
      if (event.type === 'series-started-game') {
        currentGameNumber++
        pendingGameData = {
          events: [],
          coordinates: new Map(),
          players: [],
          gameLength: 0,
          itemIdToName: new Map()
        }
        gameDataMap.set(currentGameNumber, pendingGameData)
        
        // Extract players from this event
        extractPlayersFromEvent(event, pendingGameData, currentGameNumber)
        continue
      }
      
      // game-started-gameClock fires when the actual game clock starts
      // This is when we start tracking events and coordinates
      if (event.type === 'game-started-gameClock') {
        if (pendingGameData) {
          currentGameData = pendingGameData
          pendingGameData = null
        } else {
          // Fallback if we somehow missed series-started-game
          currentGameNumber++
          currentGameData = {
            events: [],
            coordinates: new Map(),
            players: [],
            gameLength: 0,
            itemIdToName: new Map()
          }
          gameDataMap.set(currentGameNumber, currentGameData)
        }
        isTracking = true
        continue
      }
      
      // Check for game end
      if (event.type === 'team-won-game' && isTracking && currentGameData) {
        // Record final game length from the last known time
        isTracking = false
        currentGameData = null
        continue
      }
      
      // Skip if we're not tracking a game
      if (!isTracking || !currentGameData) continue
      
      // Get current time for this game
      const time = getEventTimeForGame(event, currentGameNumber)
      
      // Update game length
      if (time > currentGameData.gameLength) {
        currentGameData.gameLength = time
      }
      
      // Extract coordinates from this event
      extractCoordinatesFromEvent(event, currentGameData, currentGameNumber, time)
      
      // Process game events
      processGameEvent(event, currentGameData, time)
    }
  }
  
  // Sort events for each game
  Array.from(gameDataMap.values()).forEach(gameData => {
    gameData.events.sort((a: GameEvent, b: GameEvent) => a.time - b.time)
  })
  
  return gameDataMap
}

/**
 * Extract players from a game start event
 */
function extractPlayersFromEvent(
  event: { actor: { state?: unknown } },
  gameData: GameDataCollector,
  gameNumber: number
): void {
  const actorState = event.actor.state as {
    games?: Array<{
      teams?: Array<{
        id: string
        players?: Array<{
          id: string
          name: string
          character?: { name: string }
        }>
      }>
    }>
  }
  
  // Use gameNumber - 1 as index (game 1 = index 0)
  const gameIndex = gameNumber - 1
  const games = actorState?.games || []
  const gameState = games[gameIndex] || games[games.length - 1]
  
  if (gameState?.teams) {
    for (const team of gameState.teams) {
      for (const player of team.players || []) {
        if (player.character?.name) {
          gameData.players.push({
            id: player.id,
            name: player.name,
            champName: player.character.name,
            teamId: team.id
          })
        }
      }
    }
  }
}

/**
 * Extract coordinates from an event for a specific game
 * Note: seriesState.games contains only the current game at index 0
 */
function extractCoordinatesFromEvent(
  event: { seriesState?: { games?: Array<{ sequenceNumber?: number, clock?: { currentSeconds: number }, teams?: Array<{ players?: Array<{ id: string, position?: { x: number, y: number }, money: number, totalMoneyEarned: number }> }> }> } },
  gameData: GameDataCollector,
  gameNumber: number,
  time: number
): void {
  if (!event.seriesState?.games || time === 0) return
  
  // Skip if we already have this timestamp
  if (gameData.coordinates.has(time)) return
  
  // The current game is always at index 0
  const gameState = event.seriesState.games[0]
  
  // Verify this is the correct game
  if (gameState?.sequenceNumber !== undefined && gameState.sequenceNumber !== gameNumber) return
  
  if (!gameState?.teams) return
  
  const playerCoordinates: PlayerCoordinate[] = []
  
  for (const team of gameState.teams) {
    if (!team.players) continue
    
    for (const player of team.players) {
      if (player.position) {
        playerCoordinates.push({
          playerId: player.id,
          x: player.position.x,
          y: player.position.y,
          gold: player.money || 0,
          worth: player.totalMoneyEarned || 0,
        })
      }
    }
  }
  
  if (playerCoordinates.length > 0) {
    gameData.coordinates.set(time, { time, playerCoordinates })
  }
}

/**
 * Process a game event and add to collector
 */
function processGameEvent(
  event: { type: string, actor: { id: string, stateDelta?: unknown }, target: { id: string, state?: unknown } },
  gameData: GameDataCollector,
  time: number
): void {
  switch (event.type) {
    case 'player-purchased-item': {
      const stateDelta = event.actor.stateDelta as { game?: { inventory?: { items?: Array<{ id?: string, name?: string }> } } }
      const items = stateDelta?.game?.inventory?.items || []
      for (const item of items) {
        if (item.name) {
          if (item.id) {
            gameData.itemIdToName.set(item.id, item.name)
          }
          gameData.events.push({
            type: 'purchase-item',
            playerId: event.actor.id,
            itemName: item.name,
            time
          })
        }
      }
      break
    }
    
    case 'player-acquired-item': {
      const stateDelta = event.actor.stateDelta as { game?: { inventory?: { items?: Array<{ id?: string, name?: string }> } } }
      const items = stateDelta?.game?.inventory?.items || []
      for (const item of items) {
        if (item.name) {
          if (item.id) {
            gameData.itemIdToName.set(item.id, item.name)
          }
          gameData.events.push({
            type: 'acquire-item',
            playerId: event.actor.id,
            itemName: item.name,
            time
          })
        }
      }
      break
    }
    
    case 'player-lost-item': {
      const stateDelta = event.actor.stateDelta as { game?: { inventory?: { items?: Array<{ id: string }> } } }
      const items = stateDelta?.game?.inventory?.items || []
      for (const item of items) {
        const itemName = gameData.itemIdToName.get(item.id) || item.id
        gameData.events.push({
          type: 'lost-item',
          playerId: event.actor.id,
          itemName,
          time
        })
      }
      break
    }
    
    case 'player-sold-item': {
      const stateDelta = event.actor.stateDelta as { game?: { inventory?: { items?: Array<{ id: string }> } } }
      const items = stateDelta?.game?.inventory?.items || []
      for (const item of items) {
        const itemName = gameData.itemIdToName.get(item.id) || item.id
        gameData.events.push({
          type: 'sold-item',
          playerId: event.actor.id,
          itemName,
          time
        })
      }
      break
    }
    
    case 'player-completed-increaseLevel': {
      const targetState = event.target.state as { completionCount?: number }
      if (targetState?.completionCount !== undefined) {
        const newLevel = targetState.completionCount + 1
        gameData.events.push({
          type: 'level-up',
          playerId: event.actor.id,
          newLevel,
          time
        })
      }
      break
    }
    
    case 'player-killed-BTierNPC': {
      gameData.events.push({
        type: 'kill-btier-monster',
        playerId: event.actor.id,
        monsterName: event.target.id,
        time
      })
      break
    }
    
    case 'player-killed-ATierNPC': {
      gameData.events.push({
        type: 'kill-atier-monster',
        playerId: event.actor.id,
        monsterName: event.target.id,
        time
      })
      break
    }
    
    case 'player-killed-STierNPC': {
      gameData.events.push({
        type: 'kill-stier-monster',
        playerId: event.actor.id,
        monsterName: event.target.id,
        time
      })
      break
    }
    
    case 'player-killed-player': {
      const stateDelta = event.actor.stateDelta as { 
        game?: { killAssistsReceivedFromPlayer?: Array<{ playerId: string }> } 
      }
      const assists = stateDelta?.game?.killAssistsReceivedFromPlayer || []
      gameData.events.push({
        type: 'kill',
        playerId: event.actor.id,
        targetId: event.target.id,
        assistPlayerIds: assists.map(a => a.playerId),
        time
      })
      break
    }
    
    case 'player-destroyed-tower': {
      gameData.events.push({
        type: 'destroy-tower',
        playerId: event.actor.id,
        towerName: event.target.id,
        time
      })
      break
    }
    
    case 'player-destroyed-fortifier': {
      gameData.events.push({
        type: 'destroy-inhibitor',
        playerId: event.actor.id,
        inhibitorName: event.target.id,
        time
      })
      break
    }
  }
}

/**
 * Get event time for a specific game number
 * Note: seriesState.games contains only the current game at index 0,
 * with sequenceNumber indicating which game it is
 */
function getEventTimeForGame(
  event: { seriesState?: { games?: Array<{ sequenceNumber?: number, clock?: { currentSeconds: number } }> } },
  gameNumber: number
): number {
  // The current game is always at index 0 in the games array
  // Verify it matches the expected game number via sequenceNumber
  const currentGame = event.seriesState?.games?.[0]
  if (currentGame?.clock?.currentSeconds !== undefined) {
    // Only return time if this event is for the correct game
    if (currentGame.sequenceNumber === undefined || currentGame.sequenceNumber === gameNumber) {
      return currentGame.clock.currentSeconds
    }
  }
  return 0
}

/**
 * Convert a single game from end-state + pre-extracted game data
 */
function convertGame(
  game: EndStateGame,
  gameData: GameDataCollector | undefined
): StreamlinedGame {
  // Find blue side team
  const blueTeam = game.teams.find(t => t.side === 'blue')
  const blueSideTeamId = blueTeam?.id || ''
  
  // Find winner
  const winnerTeam = game.teams.find(t => t.won)
  const winnerTeamId = winnerTeam?.id || null
  
  // Convert draft actions
  const draftingActions = game.draftActions.map(action => ({
    teamId: action.drafter.id,
    champName: action.draftable.name,
    action: action.type
  }))
  
  // Get data from single-pass extraction
  const events = gameData?.events || []
  const gameLength = gameData?.gameLength || 0
  const players = gameData?.players || []
  const coordinateTracking = gameData 
    ? Array.from(gameData.coordinates.values()).sort((a, b) => a.time - b.time)
    : []
  
  return {
    id: String(game.sequenceNumber),
    blueSideTeamId,
    winnerTeamId,
    gameLength,
    startTime: game.startedAt,
    players,
    draftingActions,
    events,
    coordinateTracking
  }
}

