/**
 * Valorant map data utilities
 * Imports map data from staticData/valorantMap.json and provides typed access
 */

import valorantMapsRaw from '../../staticData/valorantMap.json'

// ============================================================================
// TYPES
// ============================================================================

export interface ValorantMapCallout {
  regionName: string
  superRegion: string
  superRegionName: string
  location: {
    x: number
    y: number
    z: number
  }
  scale3D: {
    x: number
    y: number
    z: number
  } | null
  rotation: number | null
}

export interface ValorantMapData {
  uuid: string
  displayName: string
  narrativeDescription: string | null
  tacticalDescription: string | null
  coordinates: string | null
  displayIcon: string | null
  listViewIcon: string | null
  listViewIconTall: string | null
  splash: string | null
  stylizedBackgroundImage: string | null
  premierBackgroundImage: string | null
  assetPath: string
  mapUrl: string
  xMultiplier: number
  yMultiplier: number
  xScalarToAdd: number
  yScalarToAdd: number
  callouts: ValorantMapCallout[] | null
}

export interface MapCoordinateConfig {
  xMultiplier: number
  yMultiplier: number
  xScalarToAdd: number
  yScalarToAdd: number
}

export interface MapBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

// ============================================================================
// DATA
// ============================================================================

// Cast the raw JSON to our typed array
export const valorantMaps: ValorantMapData[] = valorantMapsRaw as ValorantMapData[]

// Create a lookup by display name (lowercase for easy matching)
const mapsByName = new Map<string, ValorantMapData>()
for (const map of valorantMaps) {
  mapsByName.set(map.displayName.toLowerCase(), map)
}

// Pre-calculate bounds from callouts for each map
const mapBoundsCache = new Map<string, MapBounds>()

function calculateMapBoundsFromCallouts(map: ValorantMapData): MapBounds {
  const callouts = map.callouts || []
  
  if (callouts.length === 0) {
    // Fallback bounds if no callouts
    return { minX: -10000, maxX: 10000, minY: -10000, maxY: 10000 }
  }
  
  let minX = Infinity, maxX = -Infinity
  let minY = Infinity, maxY = -Infinity
  
  for (const callout of callouts) {
    minX = Math.min(minX, callout.location.x)
    maxX = Math.max(maxX, callout.location.x)
    minY = Math.min(minY, callout.location.y)
    maxY = Math.max(maxY, callout.location.y)
  }
  
  // Add 15% padding to bounds
  const xPadding = (maxX - minX) * 0.15
  const yPadding = (maxY - minY) * 0.15
  
  return {
    minX: minX - xPadding,
    maxX: maxX + xPadding,
    minY: minY - yPadding,
    maxY: maxY + yPadding,
  }
}

// ============================================================================
// FUNCTIONS
// ============================================================================

/**
 * Get map data by name (case-insensitive)
 */
export function getMapByName(mapName: string): ValorantMapData | undefined {
  return mapsByName.get(mapName.toLowerCase())
}

/**
 * Get the bounds for a map based on callout locations
 */
export function getMapBounds(mapName: string): MapBounds {
  const lowerName = mapName.toLowerCase()
  
  // Check cache first
  if (mapBoundsCache.has(lowerName)) {
    return mapBoundsCache.get(lowerName)!
  }
  
  const map = getMapByName(mapName)
  if (map) {
    const bounds = calculateMapBoundsFromCallouts(map)
    mapBoundsCache.set(lowerName, bounds)
    return bounds
  }
  
  // Default bounds for unknown maps
  return { minX: -10000, maxX: 10000, minY: -10000, maxY: 10000 }
}

/**
 * Get coordinate config for a map by name
 * Returns default config if map not found
 */
export function getMapCoordinateConfig(mapName: string): MapCoordinateConfig {
  const map = getMapByName(mapName)
  
  if (map) {
    return {
      xMultiplier: map.xMultiplier,
      yMultiplier: map.yMultiplier,
      xScalarToAdd: map.xScalarToAdd,
      yScalarToAdd: map.yScalarToAdd,
    }
  }
  
  // Default config for unknown maps
  return {
    xMultiplier: 0.00007,
    yMultiplier: -0.00007,
    xScalarToAdd: 0.5,
    yScalarToAdd: 0.5,
  }
}

/**
 * Calculate multipliers from bounds that will map coordinates to 5%-95% range
 */
export function calculateMultipliersFromBounds(bounds: MapBounds): MapCoordinateConfig {
  const rangeX = bounds.maxX - bounds.minX
  const rangeY = bounds.maxY - bounds.minY
  
  // We want to map:
  // minX -> 0.05 (5%)
  // maxX -> 0.95 (95%)
  // minY -> 0.95 (95%, because Y is typically flipped)
  // maxY -> 0.05 (5%)
  
  const xMultiplier = rangeX > 0 ? 0.9 / rangeX : 0.00007
  const yMultiplier = rangeY > 0 ? -0.9 / rangeY : -0.00007 // Negative to flip Y
  
  const xScalarToAdd = 0.05 - bounds.minX * xMultiplier
  const yScalarToAdd = 0.95 - bounds.minY * yMultiplier
  
  return { xMultiplier, yMultiplier, xScalarToAdd, yScalarToAdd }
}

/**
 * Get coordinate config calculated from callout bounds (more reliable than API multipliers)
 */
export function getMapCoordinateConfigFromBounds(mapName: string): MapCoordinateConfig {
  const bounds = getMapBounds(mapName)
  return calculateMultipliersFromBounds(bounds)
}

/**
 * Convert game coordinates to normalized 0-1 range using map config
 */
export function gameToNormalized(
  x: number,
  y: number,
  config: MapCoordinateConfig
): { normalizedX: number; normalizedY: number } {
  return {
    normalizedX: x * config.xMultiplier + config.xScalarToAdd,
    normalizedY: y * config.yMultiplier + config.yScalarToAdd,
  }
}

/**
 * Convert game coordinates to percentage for CSS positioning
 */
export function gameToPercent(
  x: number,
  y: number,
  config: MapCoordinateConfig
): { xPercent: number; yPercent: number } {
  const { normalizedX, normalizedY } = gameToNormalized(x, y, config)
  return {
    xPercent: normalizedX * 100,
    yPercent: normalizedY * 100,
  }
}
