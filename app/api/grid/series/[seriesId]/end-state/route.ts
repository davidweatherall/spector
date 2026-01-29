import { NextRequest, NextResponse } from 'next/server'

// Disable Next.js caching
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// Permanent cache for end-state data
const endStateCache = new Map<string, unknown>()

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

    // Check cache first
    const cached = endStateCache.get(seriesId)
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

    // Cache permanently
    endStateCache.set(seriesId, data)

    return NextResponse.json({ data, cached: false })
  } catch (error) {
    console.error('Error fetching end-state:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch end-state' },
      { status: 500 }
    )
  }
}
