import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

// Track which series events have been downloaded
const downloadedSeries = new Set<string>()

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

    // Define the save path
    const dataDir = path.join(process.cwd(), 'data', 'events')
    const zipPath = path.join(dataDir, `events_${seriesId}.zip`)

    // Check if already downloaded
    if (downloadedSeries.has(seriesId) || existsSync(zipPath)) {
      downloadedSeries.add(seriesId)
      return NextResponse.json({ 
        downloaded: true, 
        path: zipPath,
        cached: true 
      })
    }

    // Fetch events zip from GRID API
    const response = await fetch(
      `https://api.grid.gg/file-download/events/grid/series/${seriesId}`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/zip',
          'x-api-key': apiKey,
        },
      }
    )

    if (!response.ok) {
      throw new Error(`GRID API error: ${response.status}`)
    }

    // Get the zip as a buffer
    const buffer = await response.arrayBuffer()

    // Ensure directory exists
    await mkdir(dataDir, { recursive: true })

    // Save the zip file
    await writeFile(zipPath, Buffer.from(buffer))

    // Mark as downloaded
    downloadedSeries.add(seriesId)

    return NextResponse.json({ 
      downloaded: true, 
      path: zipPath,
      size: buffer.byteLength,
      cached: false 
    })
  } catch (error) {
    console.error('Error downloading events:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to download events' },
      { status: 500 }
    )
  }
}
