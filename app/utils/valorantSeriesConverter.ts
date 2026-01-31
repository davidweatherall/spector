/**
 * Converts GRID API Valorant data into streamlined JSON format
 */

// ============================================================================
// OUTPUT TYPES - Streamlined Valorant format
// ============================================================================

export interface ValorantStreamlinedSeries {
  seriesId: string
  teams: ValorantTeam[]
  mapVeto: MapVetoAction[]
  games: ValorantGame[]
}

export interface ValorantTeam {
  id: string
  name: string
  players: ValorantPlayer[]
}

export interface ValorantPlayer {
  id: string
  name: string
}

export interface GamePlayer {
  id: string
  name: string
  teamId: string
  characterId: string  // e.g. 'viper', 'fade'
  characterName: string // e.g. 'Viper', 'Fade'
}

export interface MapVetoAction {
  sequenceNumber: number
  occurredAt: string
  action: 'ban' | 'pick' | 'decider'
  mapId: string
  teamId: string | null
  teamName: string | null
}

export interface ValorantGame {
  gameNumber: number
  mapId: string
  startedAt: string | null
  winnerTeamId: string | null
  players: GamePlayer[]
  rounds: ValorantRound[]
}

export interface ValorantRound {
  roundNumber: number
  winnerTeamId: string
  winnerTeamName: string
  winType: string // 'opponentEliminated', 'bombExploded', 'bombDefused', 'timeExpired'
  freezetimeEndedAt?: string // Timestamp when buy phase ended and combat started
  purchases: RoundPurchase[]
  abilityUsages: AbilityUsage[]
  kills: PlayerKill[]
  bombPlant?: BombPlant
  bombDefuse?: BombDefuse
  coordinateTracking: CoordinateSnapshot[]
}

export interface RoundPurchase {
  playerId: string
  playerName: string
  teamId: string
  items: string[] // Items purchased this round
}

export interface AbilityUsage {
  playerId: string
  playerName: string
  abilityId: string
  position: {
    x: number
    y: number
  }
  occurredAt: string
}

export interface CoordinateSnapshot {
  time: number // timestamp in ms
  playerCoordinates: PlayerCoordinate[]
}

export interface PlayerCoordinate {
  playerId: string
  x: number
  y: number
}

export interface PlayerKill {
  killerId: string
  killerName: string
  victimId: string
  victimName: string
  killerPosition: {
    x: number
    y: number
  }
  victimPosition: {
    x: number
    y: number
  }
  occurredAt: string
}

export interface BombPlant {
  playerId: string
  playerName: string
  position: {
    x: number
    y: number
  }
  occurredAt: string
}

export interface BombDefuse {
  playerId: string
  playerName: string
  occurredAt: string
}

// ============================================================================
// EVENT PARSING TYPES
// ============================================================================

interface ValorantEventBatch {
  id?: string
  occurredAt: string
  seriesId: string
  sequenceNumber?: number
  events: ValorantEvent[]
}

interface ValorantEvent {
  id?: string
  type: string
  action?: string
  actor?: {
    type: string
    id: string
    state?: {
      id: string
      name?: string
      side?: string
      round?: {
        won?: boolean
        winType?: string
      }
    }
  }
  target?: {
    type: string
    id: string
    state?: {
      id?: string
      sequenceNumber?: number
    }
  }
  seriesState?: SeriesState
}

interface SeriesState {
  id: string
  games: GameState[]
}

interface GameState {
  id: string
  sequenceNumber?: number
  teams: TeamState[]
}

interface TeamState {
  id: string
  name?: string
  side?: string
  players?: PlayerState[]
}

interface PlayerState {
  id: string
  name: string
  position?: {
    x: number
    y: number
  }
  inventory?: {
    items: ItemState[]
  }
  character?: {
    id: string
    name: string
  }
}

interface ItemState {
  name: string
}

// Items to ignore when tracking purchases
const IGNORED_ITEMS = new Set(['Classic', 'Spike', 'Melee'])

// ============================================================================
// INTERNAL STATE TRACKING
// ============================================================================

interface LastRoundItems {
  [playerName: string]: string[]
}

interface GameDataCollector {
  gameNumber: number
  mapId: string
  startedAt: string | null
  winnerTeamId: string | null
  players: GamePlayer[]
  rounds: ValorantRound[]
  lastRoundItems: LastRoundItems
  currentRoundPurchases: RoundPurchase[]
  currentRoundAbilities: AbilityUsage[]
  currentRoundKills: PlayerKill[]
  currentRoundBombPlant: BombPlant | null
  currentRoundBombDefuse: BombDefuse | null
  currentRoundFreezetimeEndedAt: string | null
  currentRoundCoordinates: CoordinateSnapshot[]
  inRoundPhase: boolean // Track if we're between round-started-freezetime and team-won-round
}

// ============================================================================
// PARSER
// ============================================================================

function parseValorantEventsFile(content: string): ValorantEventBatch[] {
  const lines = content.split('\n').filter(line => line.trim())
  const batches: ValorantEventBatch[] = []
  
  for (const line of lines) {
    try {
      const batch = JSON.parse(line) as ValorantEventBatch
      batches.push(batch)
    } catch (e) {
      // Skip invalid lines
    }
  }
  
  return batches
}

// ============================================================================
// CONVERTER FUNCTIONS
// ============================================================================

/**
 * Convert Valorant GRID events data into streamlined format
 */
export function convertValorantSeriesData(
  eventsContent: string
): ValorantStreamlinedSeries {
  const eventBatches = parseValorantEventsFile(eventsContent)
  
  if (eventBatches.length === 0) {
    throw new Error('No valid event batches found')
  }
  
  const seriesId = eventBatches[0].seriesId
  
  // Extract map veto actions
  const mapVeto = extractMapVeto(eventBatches)
  
  // Extract teams from events
  const teams = extractTeams(eventBatches, mapVeto)
  
  // Extract game data with rounds and purchases
  const games = extractGamesWithRounds(eventBatches, mapVeto)
  
  return {
    seriesId,
    teams,
    mapVeto,
    games,
  }
}

/**
 * Extract map veto actions from event batches
 */
function extractMapVeto(batches: ValorantEventBatch[]): MapVetoAction[] {
  const vetoActions: MapVetoAction[] = []
  let sequenceCounter = 0
  
  for (const batch of batches) {
    for (const event of batch.events) {
      if (event.type === 'team-banned-map') {
        sequenceCounter++
        vetoActions.push({
          sequenceNumber: sequenceCounter,
          occurredAt: batch.occurredAt,
          action: 'ban',
          mapId: event.target?.id || 'unknown',
          teamId: event.actor?.id || null,
          teamName: event.actor?.state?.name || null,
        })
      } else if (event.type === 'team-picked-map') {
        sequenceCounter++
        vetoActions.push({
          sequenceNumber: sequenceCounter,
          occurredAt: batch.occurredAt,
          action: 'pick',
          mapId: event.target?.id || 'unknown',
          teamId: event.actor?.id || null,
          teamName: event.actor?.state?.name || null,
        })
      } else if (event.type === 'series-picked-map') {
        sequenceCounter++
        vetoActions.push({
          sequenceNumber: sequenceCounter,
          occurredAt: batch.occurredAt,
          action: 'decider',
          mapId: event.target?.id || 'unknown',
          teamId: null,
          teamName: null,
        })
      }
    }
  }
  
  // Sort by time
  vetoActions.sort((a, b) => {
    const timeA = new Date(a.occurredAt).getTime()
    const timeB = new Date(b.occurredAt).getTime()
    return timeA - timeB
  })
  
  // Re-sequence
  vetoActions.forEach((action, index) => {
    action.sequenceNumber = index + 1
  })
  
  return vetoActions
}

/**
 * Extract teams from events
 */
function extractTeams(batches: ValorantEventBatch[], mapVeto: MapVetoAction[]): ValorantTeam[] {
  const teamMap = new Map<string, ValorantTeam>()
  
  // First get from map veto
  for (const action of mapVeto) {
    if (action.teamId && action.teamName && !teamMap.has(action.teamId)) {
      teamMap.set(action.teamId, {
        id: action.teamId,
        name: action.teamName,
        players: [],
      })
    }
  }
  
  // Then get players from game events
  for (const batch of batches) {
    for (const event of batch.events) {
      const games = event.seriesState?.games
      if (!games || games.length === 0) continue
      
      // Use the latest game
      const game = games[games.length - 1]
      
      for (const team of game.teams || []) {
        if (!team.id) continue
        
        let existingTeam = teamMap.get(team.id)
        if (!existingTeam) {
          existingTeam = {
            id: team.id,
            name: team.name || team.id,
            players: [],
          }
          teamMap.set(team.id, existingTeam)
        } else if (team.name && !existingTeam.name) {
          existingTeam.name = team.name
        }
        
        // Add players if we have them
        for (const player of team.players || []) {
          if (!existingTeam.players.some(p => p.id === player.id)) {
            existingTeam.players.push({
              id: player.id,
              name: player.name,
            })
          }
        }
      }
    }
  }
  
  return Array.from(teamMap.values())
}

/**
 * Extract all player coordinates from an event's seriesState
 */
function extractAllPlayerCoordinates(event: ValorantEvent): PlayerCoordinate[] {
  const coordinates: PlayerCoordinate[] = []
  
  const games = event.seriesState?.games
  if (!games || games.length === 0) return coordinates
  
  // Use the latest game
  const game = games[games.length - 1]
  
  for (const team of game.teams || []) {
    for (const player of team.players || []) {
      if (player.position) {
        coordinates.push({
          playerId: player.id,
          x: player.position.x,
          y: player.position.y,
        })
      }
    }
  }
  
  return coordinates
}

/**
 * Extract games with round data, item purchases, ability usages, and coordinate tracking
 */
function extractGamesWithRounds(
  batches: ValorantEventBatch[],
  mapVeto: MapVetoAction[]
): ValorantGame[] {
  const games: ValorantGame[] = []
  const pickedMaps = mapVeto.filter(v => v.action === 'pick' || v.action === 'decider')
  
  let currentGame: GameDataCollector | null = null
  let gameIndex = 0
  
  for (const batch of batches) {
    for (const event of batch.events) {
      // New game started - reset state
      if (event.type === 'series-started-game') {
        // Save previous game if exists
        if (currentGame) {
          games.push({
            gameNumber: currentGame.gameNumber,
            mapId: currentGame.mapId,
            startedAt: currentGame.startedAt,
            winnerTeamId: currentGame.winnerTeamId,
            players: currentGame.players,
            rounds: currentGame.rounds,
          })
        }
        
        // Extract player characters from seriesState
        const gamePlayers: GamePlayer[] = []
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const seriesState = (event.actor as any)?.state || event.seriesState
        if (seriesState?.games?.length > 0) {
          const latestGame = seriesState.games[seriesState.games.length - 1]
          if (latestGame?.teams) {
            for (const team of latestGame.teams) {
              if (team?.players) {
                for (const player of team.players) {
                  if (player?.character) {
                    gamePlayers.push({
                      id: player.id,
                      name: player.name,
                      teamId: team.id,
                      characterId: player.character.id || player.character.name?.toLowerCase() || 'unknown',
                      characterName: player.character.name || player.character.id || 'Unknown',
                    })
                  }
                }
              }
            }
          }
        }
        
        // Start new game
        const mapId = pickedMaps[gameIndex]?.mapId || 'unknown'
        currentGame = {
          gameNumber: gameIndex + 1,
          mapId,
          startedAt: batch.occurredAt,
          winnerTeamId: null,
          players: gamePlayers,
          rounds: [],
          lastRoundItems: {},
          currentRoundPurchases: [],
          currentRoundAbilities: [],
          currentRoundKills: [],
          currentRoundBombPlant: null,
          currentRoundBombDefuse: null,
          currentRoundFreezetimeEndedAt: null,
          currentRoundCoordinates: [],
          inRoundPhase: false,
        }
        gameIndex++
        continue
      }
      
      if (!currentGame) continue
      
      // Round started freezetime - start tracking coordinates, abilities, kills, and bomb events
      if (event.type === 'round-started-freezetime') {
        // Reset abilities, kills, bomb events, and coordinates for this round (tracking starts now)
        currentGame.currentRoundAbilities = []
        currentGame.currentRoundKills = []
        currentGame.currentRoundBombPlant = null
        currentGame.currentRoundBombDefuse = null
        currentGame.currentRoundFreezetimeEndedAt = null
        currentGame.currentRoundCoordinates = []
        currentGame.inRoundPhase = true
        
        // Capture initial coordinates at start of freezetime
        const coords = extractAllPlayerCoordinates(event)
        if (coords.length > 0) {
          currentGame.currentRoundCoordinates.push({
            time: new Date(batch.occurredAt).getTime(),
            playerCoordinates: coords,
          })
        }
        continue
      }
      
      // Round ended freezetime (buy phase ended) - capture purchases and timestamp
      // This is the last moment players can buy items
      if (event.type === 'round-ended-freezetime') {
        const currentInventories = extractPlayerInventories(event)
        const purchases = calculatePurchases(
          currentInventories,
          currentGame.lastRoundItems
        )
        currentGame.currentRoundPurchases = purchases
        currentGame.currentRoundFreezetimeEndedAt = batch.occurredAt
        continue
      }
      
      // During round phase, track coordinates for every event
      if (currentGame.inRoundPhase && event.seriesState) {
        const coords = extractAllPlayerCoordinates(event)
        if (coords.length > 0) {
          currentGame.currentRoundCoordinates.push({
            time: new Date(batch.occurredAt).getTime(),
            playerCoordinates: coords,
          })
        }
      }
      
      // Player used ability - track it with position (during round phase)
      if (event.type === 'player-used-ability' && currentGame.inRoundPhase) {
        const playerId = event.actor?.id || ''
        const abilityId = event.target?.id || ''
        
        // Find player position from seriesState
        const playerInfo = findPlayerInSeriesState(event, playerId)
        
        currentGame.currentRoundAbilities.push({
          playerId,
          playerName: playerInfo?.name || playerId,
          abilityId,
          position: {
            x: playerInfo?.position?.x || 0,
            y: playerInfo?.position?.y || 0,
          },
          occurredAt: batch.occurredAt,
        })
        continue
      }
      
      // Player killed player - track kills with positions (during round phase)
      if (event.type === 'player-killed-player' && currentGame.inRoundPhase) {
        const killerId = event.actor?.id || ''
        const victimId = event.target?.id || ''
        
        // Find both players' positions from seriesState
        const killerInfo = findPlayerInSeriesState(event, killerId)
        const victimInfo = findPlayerInSeriesState(event, victimId)
        
        currentGame.currentRoundKills.push({
          killerId,
          killerName: killerInfo?.name || killerId,
          victimId,
          victimName: victimInfo?.name || victimId,
          killerPosition: {
            x: killerInfo?.position?.x || 0,
            y: killerInfo?.position?.y || 0,
          },
          victimPosition: {
            x: victimInfo?.position?.x || 0,
            y: victimInfo?.position?.y || 0,
          },
          occurredAt: batch.occurredAt,
        })
        continue
      }
      
      // Bomb planted - track who planted and where
      if (event.type === 'player-completed-plantBomb' && currentGame.inRoundPhase) {
        const playerId = event.actor?.id || ''
        const playerInfo = findPlayerInSeriesState(event, playerId)
        // Position can also be in actor.state.game.position
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const actorState = event.actor as any
        const position = actorState?.state?.game?.position || playerInfo?.position
        
        currentGame.currentRoundBombPlant = {
          playerId,
          playerName: playerInfo?.name || playerId,
          position: {
            x: position?.x || 0,
            y: position?.y || 0,
          },
          occurredAt: batch.occurredAt,
        }
        continue
      }
      
      // Bomb defused - track who defused
      if (event.type === 'player-completed-defuseBomb' && currentGame.inRoundPhase) {
        const playerId = event.actor?.id || ''
        const playerInfo = findPlayerInSeriesState(event, playerId)
        
        currentGame.currentRoundBombDefuse = {
          playerId,
          playerName: playerInfo?.name || playerId,
          occurredAt: batch.occurredAt,
        }
        continue
      }
      
      // Team won round - record round result, end combat phase
      if (event.type === 'team-won-round') {
        const winnerTeamId = event.actor?.id || ''
        const winnerTeamName = event.actor?.state?.name || ''
        const winType = event.actor?.state?.round?.winType || 'unknown'
        const roundNumber = event.target?.state?.sequenceNumber || currentGame.rounds.length + 1
        
        currentGame.rounds.push({
          roundNumber,
          winnerTeamId,
          winnerTeamName,
          winType,
          freezetimeEndedAt: currentGame.currentRoundFreezetimeEndedAt || undefined,
          purchases: currentGame.currentRoundPurchases,
          abilityUsages: currentGame.currentRoundAbilities,
          kills: currentGame.currentRoundKills,
          bombPlant: currentGame.currentRoundBombPlant || undefined,
          bombDefuse: currentGame.currentRoundBombDefuse || undefined,
          coordinateTracking: currentGame.currentRoundCoordinates,
        })
        
        // Reset for next round
        currentGame.currentRoundPurchases = []
        currentGame.currentRoundAbilities = []
        currentGame.currentRoundKills = []
        currentGame.currentRoundBombPlant = null
        currentGame.currentRoundBombDefuse = null
        currentGame.currentRoundFreezetimeEndedAt = null
        currentGame.currentRoundCoordinates = []
        currentGame.inRoundPhase = false
        continue
      }
      
      // Game ended round - update lastRoundItems with end-of-round inventories
      if (event.type === 'game-ended-round') {
        const endInventories = extractPlayerInventories(event)
        currentGame.lastRoundItems = endInventories
        continue
      }
      
      // Team won game
      if (event.type === 'team-won-game') {
        if (currentGame) {
          currentGame.winnerTeamId = event.actor?.id || null
        }
        continue
      }
    }
  }
  
  // Don't forget the last game
  if (currentGame) {
    games.push({
      gameNumber: currentGame.gameNumber,
      mapId: currentGame.mapId,
      startedAt: currentGame.startedAt,
      winnerTeamId: currentGame.winnerTeamId,
      players: currentGame.players,
      rounds: currentGame.rounds,
    })
  }
  
  return games
}

/**
 * Find a player in the seriesState by their ID
 */
function findPlayerInSeriesState(
  event: ValorantEvent,
  playerId: string
): PlayerState | null {
  const games = event.seriesState?.games
  if (!games || games.length === 0) return null
  
  // Use the latest game
  const game = games[games.length - 1]
  
  for (const team of game.teams || []) {
    for (const player of team.players || []) {
      if (player.id === playerId) {
        return player
      }
    }
  }
  
  return null
}

/**
 * Extract player inventories from event's seriesState
 */
function extractPlayerInventories(event: ValorantEvent): LastRoundItems {
  const inventories: LastRoundItems = {}
  
  const games = event.seriesState?.games
  if (!games || games.length === 0) return inventories
  
  // Use the latest game (games[games.length - 1])
  const game = games[games.length - 1]
  
  for (const team of game.teams || []) {
    for (const player of team.players || []) {
      const items: string[] = []
      
      for (const item of player.inventory?.items || []) {
        // Filter out ignored items
        if (!IGNORED_ITEMS.has(item.name)) {
          items.push(item.name)
        }
      }
      
      inventories[player.name] = items
    }
  }
  
  return inventories
}

/**
 * Calculate purchases by comparing current inventory to last round's inventory
 */
function calculatePurchases(
  currentInventories: LastRoundItems,
  lastRoundItems: LastRoundItems
): RoundPurchase[] {
  const purchases: RoundPurchase[] = []
  
  for (const [playerName, currentItems] of Object.entries(currentInventories)) {
    const previousItems = lastRoundItems[playerName] || []
    
    // Find new items (in current but not in previous)
    const newItems = currentItems.filter(item => !previousItems.includes(item))
    
    if (newItems.length > 0) {
      purchases.push({
        playerId: '', // We'll need to map this from team data
        playerName,
        teamId: '', // We'll need to map this from team data
        items: newItems,
      })
    }
  }
  
  return purchases
}
