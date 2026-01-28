/**
 * Champion name to image ID mapping utility
 * Uses the staticData/champion.json to map GRID champion names to image file names
 */

import championData from '../../staticData/champion.json'

interface ChampionInfo {
  id: string
  name: string
  key: string
}

// Create a map from champion name to champion ID (for image lookup)
const championNameToId = new Map<string, string>()

// Build the mapping from the champion data
Object.values(championData.data as Record<string, ChampionInfo>).forEach((champ) => {
  // Map by exact name
  championNameToId.set(champ.name.toLowerCase(), champ.id)
  // Also map by ID in case GRID uses that
  championNameToId.set(champ.id.toLowerCase(), champ.id)
})

/**
 * Get the champion image ID from a champion name
 * @param championName - The champion name from GRID API
 * @returns The champion ID to use for the image path
 */
export function getChampionImageId(championName: string): string {
  const normalized = championName.toLowerCase().trim()
  return championNameToId.get(normalized) || championName.replace(/['\s]/g, '')
}

/**
 * Get the champion image path
 * @param championName - The champion name from GRID API
 * @returns The path to the champion image
 */
export function getChampionImagePath(championName: string): string {
  const imageId = getChampionImageId(championName)
  return `/champion/${imageId}.png`
}

/**
 * Check if a champion exists in the mapping
 * @param championName - The champion name to check
 * @returns Whether the champion exists
 */
export function championExists(championName: string): boolean {
  const normalized = championName.toLowerCase().trim()
  return championNameToId.has(normalized)
}
