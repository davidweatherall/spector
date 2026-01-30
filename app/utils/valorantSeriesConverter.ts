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
  rounds: ValorantRound[]
}

export interface ValorantRound {
  roundNumber: number
  winnerTeamId: string
  winnerTeamName: string
  winType: string // 'opponentEliminated', 'bombExploded', 'bombDefused', 'timeExpired'
  purchases: RoundPurchase[]
}

export interface RoundPurchase {
  playerId: string
  playerName: string
  teamId: string
  items: string[] // Items purchased this round
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
  inventory?: {
    items: ItemState[]
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
  rounds: ValorantRound[]
  lastRoundItems: LastRoundItems
  currentRoundPurchases: RoundPurchase[]
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
 * Extract games with round data and item purchases
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
            rounds: currentGame.rounds,
          })
        }
        
        // Start new game
        const mapId = pickedMaps[gameIndex]?.mapId || 'unknown'
        currentGame = {
          gameNumber: gameIndex + 1,
          mapId,
          startedAt: batch.occurredAt,
          winnerTeamId: null,
          rounds: [],
          lastRoundItems: {},
          currentRoundPurchases: [],
        }
        gameIndex++
        continue
      }
      
      if (!currentGame) continue
      
      // Round ended freezetime (buy phase ended) - capture purchases
      if (event.type === 'round-ended-freezetime') {
        const currentInventories = extractPlayerInventories(event)
        const purchases = calculatePurchases(
          currentInventories,
          currentGame.lastRoundItems
        )
        currentGame.currentRoundPurchases = purchases
        continue
      }
      
      // Team won round - record round result
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
          purchases: currentGame.currentRoundPurchases,
        })
        
        // Reset purchases for next round
        currentGame.currentRoundPurchases = []
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
      rounds: currentGame.rounds,
    })
  }
  
  return games
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
