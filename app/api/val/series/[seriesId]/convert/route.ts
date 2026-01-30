import { NextRequest, NextResponse } from 'next/server'
import { readJSON, storeJSON } from '../../../../../storage'
import { convertValorantSeriesData, ValorantStreamlinedSeries } from '../../../../../utils/valorantSeriesConverter'

// Disable Next.js caching for large file downloads
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// Storage key for converted Valorant data
const getConvertedKey = (seriesId: string) => `val/converted/series_${seriesId}.json`

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ seriesId: string }> }
) {
  const { seriesId } = await params

  try {
    const convertedKey = getConvertedKey(seriesId)

    // Check if already converted
    const cached = await readJSON<ValorantStreamlinedSeries>(convertedKey)
    if (cached) {
      console.log(`Returning cached Valorant conversion for series ${seriesId}`)
      return NextResponse.json({ data: cached, cached: true })
    }

    const apiKey = process.env.GRID_ESPORTS_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
    }

    // Fetch events from GRID API
    console.log(`Fetching Valorant events for series ${seriesId}...`)
    
    const eventsResponse = await fetch(
      `https://api.grid.gg/file-download/events/grid/series/${seriesId}`,
      {
        headers: {
          'Accept': 'application/zip',
          'x-api-key': apiKey,
        },
        redirect: 'follow',
        cache: 'no-store', // Disable Next.js cache for large files
      }
    )

    if (!eventsResponse.ok) {
      throw new Error(`Failed to fetch events: ${eventsResponse.status}`)
    }

    // Get the zip file
    const zipBuffer = await eventsResponse.arrayBuffer()
    
    // Extract JSONL from zip using JSZip
    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(zipBuffer)
    
    // Find the JSONL file
    let eventsContent = ''
    for (const [filename, file] of Object.entries(zip.files)) {
      if (filename.endsWith('.jsonl')) {
        eventsContent = await file.async('string')
        break
      }
    }

    if (!eventsContent) {
      throw new Error('No JSONL file found in events zip')
    }

    console.log(`Converting Valorant series ${seriesId}...`)
    
    // Convert the data
    const streamlined = convertValorantSeriesData(eventsContent)

    // Cache the result
    await storeJSON(convertedKey, streamlined)
    console.log(`Valorant series ${seriesId} converted and cached`)

    return NextResponse.json({ data: streamlined, cached: false })
  } catch (error) {
    console.error(`Error converting Valorant series ${seriesId}:`, error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Conversion failed' },
      { status: 500 }
    )
  }
}
