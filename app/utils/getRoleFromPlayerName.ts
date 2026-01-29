import positions from '../../positions/positions.json'

export type PlayerRole = 'top' | 'jungle' | 'mid' | 'bot' | 'support'

const positionsMap = positions as Record<string, string>

/**
 * Get the role for a player by their name
 * @param name - The player's name
 * @returns The player's role, or null if not found
 */
export function getRoleFromPlayerName(name: string): PlayerRole | null {
  const role = positionsMap[name]
  if (role && ['top', 'jungle', 'mid', 'bot', 'support'].includes(role)) {
    return role as PlayerRole
  }
  return null
}

/**
 * Check if a player has a specific role
 */
export function playerHasRole(name: string, role: PlayerRole): boolean {
  return getRoleFromPlayerName(name) === role
}
