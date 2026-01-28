/**
 * TypeScript types for GRID Esports Series End-State data
 * These types represent the structure from the GRID file-download end-state endpoint
 */

// ============================================================================
// Core Primitives
// ============================================================================

export interface Coordinates {
  __typename?: 'Coordinates'
  x: number
  y: number
}

export interface Bounds {
  __typename?: 'Bounds'
  min: Coordinates
  max: Coordinates
}

export interface ClockState {
  __typename?: 'ClockState'
  id: string
  type: 'gameClock' | 'npcRespawnClock'
  currentSeconds: number
  ticking?: boolean
  ticksBackwards?: boolean
}

// ============================================================================
// Draft Types
// ============================================================================

export interface Draftable {
  __typename?: 'Draftable'
  id: string
  name: string
  type: 'character' | string
}

export interface Drafter {
  __typename?: 'Drafter'
  id: string
  type: 'team' | 'player' | string
}

export interface DraftAction {
  __typename?: 'DraftAction'
  id: string
  sequenceNumber: string
  type: 'ban' | 'pick'
  draftable: Draftable
  drafter: Drafter
}

// ============================================================================
// Map Types
// ============================================================================

export interface MapState {
  __typename?: 'MapState'
  id: string
  name: string
  bounds: Bounds
}

// ============================================================================
// Non-Player Character Types
// ============================================================================

export type NPCType = 'STierNPC' | 'ATierNPC' | 'BTierNPC' | string

export type NPCSide = 'neutral' | 'blue' | 'red' | string

export type NPCId = 
  | 'baron'
  | 'elderDragon'
  | 'riftHerald'
  | 'infernalDrake'
  | 'mountainDrake'
  | 'cloudDrake'
  | 'oceanDrake'
  | 'hextechDrake'
  | 'chemtechDrake'
  | 'voidGrub1'
  | 'voidGrub2'
  | 'voidGrub3'
  | 'riftScuttlerTop'
  | 'riftScuttlerBot'
  | 'thornboundAtakhan'
  | string

export interface NonPlayerCharacterState {
  __typename?: 'NonPlayerCharacterState'
  id: NPCId
  type: NPCType
  alive: boolean
  side: NPCSide
  position: Coordinates
  respawnClock: ClockState
}

// ============================================================================
// Item & Inventory Types
// ============================================================================

export interface Item {
  name: string
}

export interface Inventory {
  items: Item[]
}

// ============================================================================
// Unit Kill Types
// ============================================================================

export interface UnitKill {
  __typename?: 'UnitKill'
  id: string
  unitName: 'minion' | 'ward' | 'monster' | string
  count: number
}

// ============================================================================
// Character Types
// ============================================================================

export interface Character {
  name: string
}

// ============================================================================
// Player Types (in-game)
// ============================================================================

export interface GamePlayer {
  id: string
  name: string
  alive: boolean
  character: Character
  
  // Combat stats
  kills: number
  deaths: number
  killAssistsReceived: number
  firstKill: boolean
  damageDealt: number
  damageTaken: number
  
  // Economy
  totalMoneyEarned: number
  inventory: Inventory
  
  // Experience & Vision
  experiencePoints: number
  visionScore: number
  
  // Positioning
  forwardPercentage: number
  
  // Objectives
  structuresDestroyed: number
  unitKills: UnitKill[]
}

// ============================================================================
// Kill Assist Types
// ============================================================================

export interface KillAssistsReceivedFromPlayer {
  id: string
  playerId: string
  killAssistsReceived: number
}

// ============================================================================
// Baron Power Play Types
// ============================================================================

export interface BaronPowerPlay {
  __typename?: 'LolBaronPowerPlay'
  id: string
  value: number
}

// ============================================================================
// Team Types (in-game)
// ============================================================================

export type TeamSide = 'blue' | 'red'

export interface GameTeam {
  id: string
  name: string
  side: TeamSide
  
  // Score & Results
  score: number
  won: boolean
  selfkills: number
  
  // Economy
  netWorth: number
  totalMoneyEarned: number
  
  // Vision
  visionScore: number
  visionScorePerMinute: number
  
  // Players
  players: GamePlayer[]
  
  // Objectives
  baronPowerPlays: BaronPowerPlay[]
  
  // Kill tracking
  killAssistsReceivedFromPlayer: KillAssistsReceivedFromPlayer[]
  
  // Weapon stats (for other games, may be empty for LoL)
  weaponKills: unknown[]
  weaponTeamkills: unknown[]
}

// ============================================================================
// Game Types
// ============================================================================

export interface GameState {
  sequenceNumber: number
  started: boolean
  startedAt: string // ISO 8601 date string
  paused: boolean
  segments: unknown[]
  
  // Map
  map: MapState
  
  // Draft
  draftActions: DraftAction[]
  
  // NPCs
  nonPlayerCharacters: NonPlayerCharacterState[]
  
  // Teams
  teams: GameTeam[]
}

// ============================================================================
// Series Team Types (summary level)
// ============================================================================

export interface SeriesTeam {
  id?: string
  name: string
  score: number
  won: boolean
}

// ============================================================================
// Title Types
// ============================================================================

export interface Title {
  __typename?: 'Title'
  nameShortened: 'lol' | 'val' | string
}

// ============================================================================
// Series State (Top Level)
// ============================================================================

export interface SeriesState {
  id: string
  
  // Status
  started: boolean
  startedAt: string // ISO 8601 date string
  updatedAt: string // ISO 8601 date string
  valid: boolean
  version: string
  
  // Format & Duration
  format: 'best-of-1' | 'best-of-3' | 'best-of-5' | string
  duration: string // ISO 8601 duration (e.g., "PT2H33M57.052S")
  
  // Clock
  clock: {
    currentSeconds: number
  }
  
  // Game title
  title: Title
  
  // Teams (summary)
  teams: SeriesTeam[]
  
  // Games (detailed)
  games: GameState[]
}

// ============================================================================
// API Response Wrapper
// ============================================================================

export interface SeriesEndStateResponse {
  seriesState: SeriesState
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Parse ISO 8601 duration to components
 */
export function parseDuration(isoDuration: string): {
  hours: number
  minutes: number
  seconds: number
  totalSeconds: number
} {
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?/)
  if (!match) {
    return { hours: 0, minutes: 0, seconds: 0, totalSeconds: 0 }
  }
  
  const hours = match[1] ? parseInt(match[1]) : 0
  const minutes = match[2] ? parseInt(match[2]) : 0
  const seconds = match[3] ? parseFloat(match[3]) : 0
  
  return {
    hours,
    minutes,
    seconds: Math.floor(seconds),
    totalSeconds: hours * 3600 + minutes * 60 + seconds,
  }
}

/**
 * Format ISO 8601 duration to human-readable string
 */
export function formatDuration(isoDuration: string): string {
  const { hours, minutes, seconds } = parseDuration(isoDuration)
  
  const parts: string[] = []
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  if (seconds > 0) parts.push(`${seconds}s`)
  
  return parts.join(' ') || '0s'
}

/**
 * Get all bans from a game's draft actions
 */
export function getBans(game: GameState): DraftAction[] {
  return game.draftActions.filter(action => action.type === 'ban')
}

/**
 * Get all picks from a game's draft actions
 */
export function getPicks(game: GameState): DraftAction[] {
  return game.draftActions.filter(action => action.type === 'pick')
}

/**
 * Get bans for a specific team
 */
export function getTeamBans(game: GameState, teamId: string): DraftAction[] {
  return game.draftActions.filter(
    action => action.type === 'ban' && action.drafter.id === teamId
  )
}

/**
 * Get picks for a specific team
 */
export function getTeamPicks(game: GameState, teamId: string): DraftAction[] {
  return game.draftActions.filter(
    action => action.type === 'pick' && action.drafter.id === teamId
  )
}

/**
 * Get the winning team from a game
 */
export function getWinningTeam(game: GameState): GameTeam | undefined {
  return game.teams.find(team => team.won)
}

/**
 * Get a player's KDA string
 */
export function getPlayerKDA(player: GamePlayer): string {
  return `${player.kills}/${player.deaths}/${player.killAssistsReceived}`
}

/**
 * Calculate a player's KDA ratio
 */
export function calculateKDARatio(player: GamePlayer): number {
  const deaths = player.deaths === 0 ? 1 : player.deaths
  return (player.kills + player.killAssistsReceived) / deaths
}
