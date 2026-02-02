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
  // Custom adjustments to fine-tune positioning for our map images (optional)
  // Offsets are added to final position (e.g., xOffset: -5 shifts left 5%)
  // Scale adjusts spread around center (e.g., xScale: 0.9 pulls positions 10% toward center)
  // Rotate: degrees to rotate the map container (e.g., 180 for 180deg rotation)
  xOffset?: number
  yOffset?: number
  xScale?: number
  yScale?: number
  rotate?: number
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

export interface MapAdjustment {
  xOffset: number  // Shifts all positions (percentage points)
  yOffset: number
  xScale: number   // Scales positions around center (1.0 = no change, 0.9 = 10% closer to center)
  yScale: number
  rotate: number   // Degrees to rotate map container (0 = no rotation, 180 = flip)
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
 * Get custom position adjustments for a map (for fine-tuning positioning)
 * Returns default values (no adjustment) if no custom values are set
 */
export function getMapAdjustment(mapName: string): MapAdjustment {
  const map = getMapByName(mapName)
  // Handle rotate being boolean (false) or number
  const rotateValue = typeof map?.rotate === 'number' ? map.rotate : 0
  return {
    xOffset: map?.xOffset ?? 0,
    yOffset: map?.yOffset ?? 0,
    xScale: map?.xScale ?? 1.0,
    yScale: map?.yScale ?? 1.0,
    rotate: rotateValue,
  }
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
 * The raw API values don't work with our map images directly because they're
 * calibrated for Valorant's official minimap images.
 * 
 * This function calculates corrected values by:
 * 1. Computing where each callout SHOULD be (using bounds-based calculation)
 * 2. Finding the average correction needed across all callouts
 * 3. Keeping the API multipliers but adjusting scalars
 */
export function getMapCoordinateConfig(mapName: string): MapCoordinateConfig {
  const map = getMapByName(mapName)
  
  if (map && map.callouts && map.callouts.length > 0) {
    // Get the bounds-based config (which we know works)
    const boundsConfig = getMapCoordinateConfigFromBounds(mapName)
    const callouts = map.callouts
    
    // Calculate the scale factor between API multipliers and bounds multipliers
    // This tells us how much to scale the API results
    const xScaleFactor = boundsConfig.xMultiplier / map.xMultiplier
    const yScaleFactor = boundsConfig.yMultiplier / map.yMultiplier
    
    // Use scaled API multipliers that match the bounds range
    const scaledXMultiplier = map.xMultiplier * xScaleFactor
    const scaledYMultiplier = map.yMultiplier * yScaleFactor
    
    // Calculate centroid of all callouts
    let sumX = 0, sumY = 0
    for (const callout of callouts) {
      sumX += callout.location.x
      sumY += callout.location.y
    }
    const centroidX = sumX / callouts.length
    const centroidY = sumY / callouts.length
    
    // Where should centroid be according to bounds-based calculation?
    const expectedX = centroidX * boundsConfig.xMultiplier + boundsConfig.xScalarToAdd
    const expectedY = centroidY * boundsConfig.yMultiplier + boundsConfig.yScalarToAdd
    
    // Calculate scalar that places centroid correctly with scaled multipliers
    const correctedXScalar = expectedX - centroidX * scaledXMultiplier
    const correctedYScalar = expectedY - centroidY * scaledYMultiplier
    
    return {
      xMultiplier: scaledXMultiplier,
      yMultiplier: scaledYMultiplier,
      xScalarToAdd: correctedXScalar,
      yScalarToAdd: correctedYScalar,
    }
  }
  
  // Fallback to bounds-based config
  return getMapCoordinateConfigFromBounds(mapName)
}

/**
 * Calculate multipliers from bounds that will map coordinates to 0%-100% range
 */
export function calculateMultipliersFromBounds(bounds: MapBounds): MapCoordinateConfig {
  const rangeX = bounds.maxX - bounds.minX
  const rangeY = bounds.maxY - bounds.minY
  
  // Map to full 0%-100% range
  // minX -> 0%, maxX -> 100%
  // minY -> 100%, maxY -> 0% (Y is flipped)
  
  const xMultiplier = rangeX > 0 ? 1.0 / rangeX : 0.00007
  const yMultiplier = rangeY > 0 ? -1.0 / rangeY : -0.00007 // Negative to flip Y
  
  const xScalarToAdd = 0 - bounds.minX * xMultiplier
  const yScalarToAdd = 1 - bounds.minY * yMultiplier
  
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

/**
 * Find the closest callout to given coordinates
 * Returns the callout name as "SuperRegionName: RegionName" or null if no callouts
 */
export function getClosestCallout(
  mapName: string,
  x: number,
  y: number
): string | null {
  const callout = getClosestCalloutData(mapName, x, y)
  if (!callout) return null
  return `${callout.superRegionName}: ${callout.regionName}`
}

/**
 * Find the closest callout to given coordinates
 * Returns the full callout data object or null if no callouts
 */
export function getClosestCalloutData(
  mapName: string,
  x: number,
  y: number
): ValorantMapCallout | null {
  const map = getMapByName(mapName)
  if (!map || !map.callouts || map.callouts.length === 0) {
    return null
  }
  
  let closestCallout = map.callouts[0]
  let closestDistance = Infinity
  
  for (const callout of map.callouts) {
    const dx = callout.location.x - x
    const dy = callout.location.y - y
    const distance = Math.sqrt(dx * dx + dy * dy)
    
    if (distance < closestDistance) {
      closestDistance = distance
      closestCallout = callout
    }
  }
  
  return closestCallout
}
