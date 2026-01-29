/**
 * GRID Esports Series Events Types
 * 
 * The events are stored in a JSONL file.
 * To parse: fileContent.split('\n').filter(Boolean).map(line => JSON.parse(line))
 */

// ============================================================================
// BASE EVENT BATCH - Top level structure (each line in JSONL)
// ============================================================================

export interface BaseEventBatch {
  id: string
  correlationId: string
  occurredAt: string
  seriesId: string
  sequenceNumber: number
  events: BaseGameEvent[]
}

// ============================================================================
// BASE GAME EVENT - Generic event structure
// ============================================================================

export interface BaseGameEvent {
  id: string
  includesFullState: boolean
  type: string
  actor: EventActor
  target: EventTarget
  seriesState?: EventSeriesState
}

// ============================================================================
// ACTOR / TARGET
// ============================================================================

export interface EventActor {
  type: string
  id: string
  stateDelta?: unknown
  state?: unknown
}

export interface EventTarget {
  type: string
  id: string
  stateDelta?: unknown
  state?: unknown
}

// ============================================================================
// SERIES STATE (for events)
// ============================================================================

export interface EventSeriesState {
  id: string
  games: EventGameState[]
}

// ============================================================================
// GAME STATE (for events)
// ============================================================================

export interface EventGameState {
  clock: Clock
  teams: TeamState[]
}

// ============================================================================
// TEAM STATE
// ============================================================================

export interface TeamState {
  id: string
  money: number
  loadoutValue: number
  netWorth: number
  deaths: number
  players: PlayerState[]
  totalMoneyEarned: number
}

// ============================================================================
// PLAYER STATE
// ============================================================================

export interface PlayerState {
  id: string
  name: string
  money: number
  loadoutValue: number
  netWorth: number
  position: Position
  totalMoneyEarned: number
}

// ============================================================================
// SUPPORTING TYPES
// ============================================================================

export interface Clock {
  currentSeconds: number
}

export interface Position {
  x: number
  y: number
}

// ============================================================================
// SPECIFIC EVENT TYPES
// ============================================================================

// player-purchased-item
export interface PlayerPurchasedItemGameEvent extends BaseGameEvent {
  type: 'player-purchased-item'
  actor: {
    type: 'player'
    id: string
    stateDelta: PlayerPurchasedItemStateDelta
    state: unknown
  }
}

export interface PlayerPurchasedItemEventBatch extends BaseEventBatch {
  events: PlayerPurchasedItemGameEvent[]
}

export interface PlayerPurchasedItemStateDelta {
  game: {
    id: string
    money: number
    loadoutValue: number
    netWorth: number
    inventory: {
      items: EventItem[]
    }
  }
}

export interface EventItem {
  id: string
  statePath: StatePath[]
  name: string
  quantity: number
  equipped: number
  stashed: number
}

export interface StatePath {
  id: string
}

// player-acquired-item
export interface PlayerAcquiredItemGameEvent extends BaseGameEvent {
  type: 'player-acquired-item'
  actor: {
    type: 'player'
    id: string
    stateDelta: PlayerAcquiredItemStateDelta
    state: unknown
  }
}

export interface PlayerAcquiredItemEventBatch extends BaseEventBatch {
  events: PlayerAcquiredItemGameEvent[]
}

export interface PlayerAcquiredItemStateDelta {
  id: string
  game: {
    id: string
    loadoutValue: number
    netWorth: number
    inventory: {
      items: EventItem[]
    }
  }
}

// player-lost-item
export interface PlayerLostItemGameEvent extends BaseGameEvent {
  type: 'player-lost-item'
  actor: {
    type: 'player'
    id: string
    stateDelta: PlayerLostItemStateDelta
    state: unknown
  }
}

export interface PlayerLostItemEventBatch extends BaseEventBatch {
  events: PlayerLostItemGameEvent[]
}

export interface PlayerLostItemStateDelta {
  id: string
  game: {
    id: string
    loadoutValue: number
    netWorth: number
    inventory: {
      items: LostItem[]
    }
  }
}

export interface LostItem {
  id: string
  statePath: StatePath[]
}

// player-completed-increaseLevel
export interface PlayerCompletedIncreaseLevelGameEvent extends BaseGameEvent {
  type: 'player-completed-increaseLevel'
  actor: {
    type: 'player'
    id: string
    target: {
      state: {
        completionCount: number; // their new level is completionCount + 1.
      }
    }
  }
}

export interface PlayerCompletedIncreaseLevelEventBatch extends BaseEventBatch {
  events: PlayerCompletedIncreaseLevelGameEvent[]
}

export interface PlayerCompletedIncreaseLevelStateDelta {
  id: string
  series: {
    id: string
    objectives: Objective[]
  }
  game: {
    id: string
    objectives: Objective[]
  }
}

export interface Objective {
  id: string
  type: string
  completionCount: number
}

// player-killed-BTierNPC
export interface PlayerKilledBTierNPCGameEvent extends BaseGameEvent {
  type: 'player-killed-BTierNPC'
  actor: {
    type: 'player'
    id: string
    stateDelta: {
      id: string
    }
    state: PlayerKilledNPCActorState
  }
  action: 'killed'
  target: {
    type: 'BTierNPC'
    id: string
    stateDelta: NPCStateDelta
    state: NPCState
  }
}

export interface PlayerKilledBTierNPCEventBatch extends BaseEventBatch {
  events: PlayerKilledBTierNPCGameEvent[]
}

export interface PlayerKilledNPCActorState {
  id: string
  name: string
  teamId: string
  side: 'blue' | 'red'
  game: {
    id: string
    name: string
    money: number
    loadoutValue: number
    netWorth: number
    position: Position
    totalMoneyEarned: number
  }
}

export interface NPCStateDelta {
  id: string
  alive: boolean
}

export interface NPCState {
  id: string
  type: string
  alive: boolean
}

// player-sold-item (player-!purchased-item)
export interface PlayerSoldItemGameEvent extends BaseGameEvent {
  type: 'player-sold-item'
  actor: {
    type: 'player'
    id: string
    stateDelta: PlayerSoldItemStateDelta
    state: unknown
  }
}

export interface PlayerSoldItemEventBatch extends BaseEventBatch {
  events: PlayerSoldItemGameEvent[]
}

export interface PlayerSoldItemStateDelta {
  id: string
  series?: {
    id: string
  }
  game: {
    id: string
    money?: number
    loadoutValue?: number
    netWorth?: number
    inventory: {
      items: LostItem[]
    }
  }
}

// player-killed-ATierNPC
export interface PlayerKilledATierNPCGameEvent extends BaseGameEvent {
  type: 'player-killed-ATierNPC'
  actor: {
    type: 'player'
    id: string
    stateDelta: {
      id: string
    }
    state: PlayerKilledNPCActorState
  }
  action: 'killed'
  target: {
    type: 'ATierNPC'
    id: string
    stateDelta: NPCStateDelta
    state: NPCState
  }
}

export interface PlayerKilledATierNPCEventBatch extends BaseEventBatch {
  events: PlayerKilledATierNPCGameEvent[]
}

// player-killed-player
export interface PlayerKilledPlayerGameEvent extends BaseGameEvent {
  type: 'player-killed-player'
  actor: {
    type: 'player'
    id: string
    stateDelta: PlayerKilledPlayerActorStateDelta
    state: unknown
  }
  action: 'killed'
  target: {
    type: 'player'
    id: string
    stateDelta: PlayerKilledPlayerTargetStateDelta
    state: unknown
  }
}

export interface PlayerKilledPlayerEventBatch extends BaseEventBatch {
  events: PlayerKilledPlayerGameEvent[]
}

export interface PlayerKilledPlayerActorStateDelta {
  id: string
  series: {
    id: string
    kills: number
    killAssistsReceived: number
    killAssistsReceivedFromPlayer: KillAssist[]
    weaponKills: Record<string, number>
  }
  game: {
    id: string
    kills: number
    killAssistsReceived: number
    killAssistsReceivedFromPlayer: KillAssist[]
    weaponKills: Record<string, number>
  }
}

export interface KillAssist {
  playerId: string
}

export interface PlayerKilledPlayerTargetStateDelta {
  id: string
  series: {
    id: string
    deaths: number
  }
  game: {
    id: string
    respawnClock: RespawnClock
  }
}

export interface RespawnClock {
  id: string
  type: string
  ticking: boolean
  ticksBackwards: boolean
  currentSeconds: number
}

// player-destroyed-tower
export interface PlayerDestroyedTowerGameEvent extends BaseGameEvent {
  type: 'player-destroyed-tower'
  actor: {
    type: 'player'
    id: string
    stateDelta?: unknown
    state: {
      id: string
      name: string
    }
  }
  action: 'destroyed'
  target: {
    type: 'tower'
    id: string
    stateDelta?: unknown
    state?: unknown
  }
}

export interface PlayerDestroyedTowerEventBatch extends BaseEventBatch {
  events: PlayerDestroyedTowerGameEvent[]
}

// player-killed-STierNPC
export interface PlayerKilledSTierNPCGameEvent extends BaseGameEvent {
  type: 'player-killed-STierNPC'
  actor: {
    type: 'player'
    id: string
    stateDelta: {
      id: string
    }
    state?: unknown
  }
  action?: 'killed'
  target: {
    type: 'STierNPC'
    id: string
    stateDelta?: NPCStateDelta
    state?: NPCState
  }
}

export interface PlayerKilledSTierNPCEventBatch extends BaseEventBatch {
  events: PlayerKilledSTierNPCGameEvent[]
}

// player-destroyed-fortifier
export interface PlayerDestroyedFortifierGameEvent extends BaseGameEvent {
  type: 'player-destroyed-fortifier'
  actor: {
    type: 'player'
    id: string
    stateDelta?: unknown
    state?: unknown
  }
  action: 'destroyed'
  target: {
    type: 'fortifier'
    id: string
    stateDelta?: unknown
    state?: unknown
  }
}

export interface PlayerDestroyedFortifierEventBatch extends BaseEventBatch {
  events: PlayerDestroyedFortifierGameEvent[]
}

// ============================================================================
// EVENT BATCH UNION TYPE
// ============================================================================

export type EventBatch = 
  | PlayerPurchasedItemEventBatch
  | PlayerAcquiredItemEventBatch
  | PlayerLostItemEventBatch
  | PlayerCompletedIncreaseLevelEventBatch
  | PlayerKilledBTierNPCEventBatch
  | PlayerSoldItemEventBatch
  | PlayerKilledATierNPCEventBatch
  | PlayerKilledPlayerEventBatch
  | PlayerDestroyedTowerEventBatch
  | PlayerKilledSTierNPCEventBatch
  | PlayerDestroyedFortifierEventBatch
  // Add more event batch types here as they are defined

// ============================================================================
// UTILITY FUNCTION
// ============================================================================

export function parseEventsFile(fileContent: string): EventBatch[] {
  return fileContent
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line) as EventBatch)
}
