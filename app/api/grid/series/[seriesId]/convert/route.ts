import { NextRequest, NextResponse } from 'next/server'
import { convertSeriesData, StreamlinedSeries } from '../../../../../utils/seriesConverter'
import { readJSON, storeJSON } from '../../../../../storage'
import { runAllAnalytics } from '../../../../../analytics'

// Disable all Next.js caching for this route
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

const API_KEY = process.env.GRID_ESPORTS_API_KEY
const BASE_URL = 'https://api.grid.gg/file-download'

// Storage keys
const getConvertedKey = (seriesId: string) => `converted/series_${seriesId}.json`

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ seriesId: string }> }
) {
  const { seriesId } = await params

  if (!API_KEY) {
    return NextResponse.json(
      { error: 'API key not configured' },
      { status: 500 }
    )
  }

  try {
    const convertedKey = getConvertedKey(seriesId)
    
    // Check if already converted in blob storage
    const cached = await readJSON<StreamlinedSeries>(convertedKey)
    if (cached) {
      return NextResponse.json({
        data: cached,
        cached: true
      })
    }

    // Fetch end-state
    const endStateRes = await fetch(`${BASE_URL}/end-state/grid/series/${seriesId}`, {
      headers: {
        'Accept': 'application/json',
        'x-api-key': API_KEY
      },
      cache: 'no-store'
    })

    if (!endStateRes.ok) {
      return NextResponse.json(
        { error: `Failed to fetch end-state: ${endStateRes.status}` },
        { status: endStateRes.status }
      )
    }

    const endStateData = await endStateRes.json()

    // Fetch events ZIP
    const eventsRes = await fetch(`${BASE_URL}/events/grid/series/${seriesId}`, {
      headers: {
        'Accept': 'application/zip',
        'x-api-key': API_KEY
      },
      cache: 'no-store'
    })

    if (!eventsRes.ok) {
      return NextResponse.json(
        { error: `Failed to fetch events: ${eventsRes.status}` },
        { status: eventsRes.status }
      )
    }

    // Get events zip and extract in memory
    const eventsBuffer = await eventsRes.arrayBuffer()
    
    // Extract zip using AdmZip (in memory)
    const AdmZip = (await import('adm-zip')).default
    const zip = new AdmZip(Buffer.from(eventsBuffer))
    const zipEntries = zip.getEntries()
    
    // Find the JSONL file
    const jsonlEntry = zipEntries.find(entry => entry.entryName.endsWith('.jsonl'))
    
    if (!jsonlEntry) {
      return NextResponse.json(
        { error: 'No JSONL file found in events archive' },
        { status: 500 }
      )
    }
    
    const eventsContent = jsonlEntry.getData().toString('utf-8')
    
    // Convert the data
    const streamlined = convertSeriesData(endStateData, eventsContent)
    
    // Save converted data to blob storage
    await storeJSON(convertedKey, streamlined)
    
    // Run analytics on the converted data
    const analytics = await runAllAnalytics(seriesId, streamlined)
    
    return NextResponse.json({
      data: streamlined,
      analytics,
      cached: false
    })
  } catch (error) {
    console.error('Error converting series:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to convert series' },
      { status: 500 }
    )
  }
}
