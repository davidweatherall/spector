import { NextRequest, NextResponse } from 'next/server'
import { readJSON, storeJSON } from '../../../../../storage'

// Disable Next.js caching
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// Storage key generator
const getEndStateKey = (seriesId: string) => `cache/end-state_${seriesId}.json`

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ seriesId: string }> }
) {
  const { seriesId } = await params

  try {
    const apiKey = process.env.GRID_ESPORTS_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key not configured' },
        { status: 500 }
      )
    }

    const cacheKey = getEndStateKey(seriesId)

    // Check blob storage cache first
    const cached = await readJSON<unknown>(cacheKey)
    if (cached) {
      return NextResponse.json({ data: cached, cached: true })
    }

    // Fetch end-state from GRID API
    const response = await fetch(
      `https://api.grid.gg/file-download/end-state/grid/series/${seriesId}`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'x-api-key': apiKey,
        },
        cache: 'no-store',
      }
    )

    if (!response.ok) {
      throw new Error(`GRID API error: ${response.status}`)
    }

    const data = await response.json()

    // Cache in blob storage
    await storeJSON(cacheKey, data)

    return NextResponse.json({ data, cached: false })
  } catch (error) {
    console.error('Error fetching end-state:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch end-state' },
      { status: 500 }
    )
  }
}
