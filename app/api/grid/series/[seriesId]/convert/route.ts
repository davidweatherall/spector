import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { convertSeriesData, StreamlinedSeries } from '../../../../../utils/seriesConverter'

// Disable all Next.js caching for this route
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

const API_KEY = process.env.GRID_ESPORTS_API_KEY
const BASE_URL = 'https://api.grid.gg/file-download'
const DATA_DIR = path.join(process.cwd(), 'data')
const CONVERTED_DIR = path.join(DATA_DIR, 'converted')

// Ensure directories exist
async function ensureDir(dir: string) {
  try {
    await fs.access(dir)
  } catch {
    await fs.mkdir(dir, { recursive: true })
  }
}

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
    await ensureDir(CONVERTED_DIR)
    
    // Check if already converted
    const convertedPath = path.join(CONVERTED_DIR, `series_${seriesId}.json`)
    try {
      const existing = await fs.readFile(convertedPath, 'utf-8')
      return NextResponse.json({
        data: JSON.parse(existing) as StreamlinedSeries,
        cached: true
      })
    } catch {
      // Not cached, need to convert
    }

    // Fetch end-state (disable cache for large responses)
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

    // Fetch events (disable cache - files are too large for Next.js cache)
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

    // Get events zip and extract
    const eventsBuffer = await eventsRes.arrayBuffer()
    const eventsDir = path.join(DATA_DIR, 'events', `events_${seriesId}`)
    await ensureDir(eventsDir)
    
    // Save zip temporarily
    const zipPath = path.join(eventsDir, `events_${seriesId}.zip`)
    await fs.writeFile(zipPath, Buffer.from(eventsBuffer))
    
    // Extract zip using AdmZip
    const AdmZip = (await import('adm-zip')).default
    const zip = new AdmZip(zipPath)
    zip.extractAllTo(eventsDir, true)
    
    // Find the JSONL file
    const files = await fs.readdir(eventsDir)
    const jsonlFile = files.find(f => f.endsWith('.jsonl'))
    
    if (!jsonlFile) {
      return NextResponse.json(
        { error: 'No JSONL file found in events archive' },
        { status: 500 }
      )
    }
    
    const eventsContent = await fs.readFile(path.join(eventsDir, jsonlFile), 'utf-8')
    
    // Convert the data
    const streamlined = convertSeriesData(endStateData, eventsContent)
    
    // Save converted data
    await fs.writeFile(convertedPath, JSON.stringify(streamlined, null, 2))
    
    return NextResponse.json({
      data: streamlined,
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
