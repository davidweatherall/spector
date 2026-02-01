import { NextRequest, NextResponse } from 'next/server'
import { readJSON, storeJSON } from '../../../../../storage'
import { convertValorantSeriesData, convertValorantSeriesDataFromLines, ValorantStreamlinedSeries } from '../../../../../utils/valorantSeriesConverter'
import { runAllValorantAnalytics } from '../../../../../val-analytics'

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
  const { searchParams } = new URL(request.url)
  const forceRefresh = searchParams.get('refresh') === 'true'

  try {
    const convertedKey = getConvertedKey(seriesId)

    // Check if already converted (unless forcing refresh)
    if (!forceRefresh) {
      const cached = await readJSON<ValorantStreamlinedSeries>(convertedKey)
      if (cached) {
        console.log(`Returning cached Valorant conversion for series ${seriesId}`)
        return NextResponse.json({ data: cached, cached: true })
      }
    } else {
      console.log(`Forcing refresh for series ${seriesId}`)
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
    let jsonlFileName = ''
    let jsonlFile: import('jszip').JSZipObject | null = null
    
    for (const [filename, file] of Object.entries(zip.files)) {
      if (filename.endsWith('.jsonl')) {
        jsonlFileName = filename
        jsonlFile = file
        
        // Check uncompressed size to warn about large files
        // @ts-expect-error - _data exists on JSZip file objects
        const uncompressedSize = file._data?.uncompressedSize || 0
        console.log(`JSONL file: ${filename}, uncompressed size: ${(uncompressedSize / 1024 / 1024).toFixed(2)} MB`)
        break
      }
    }

    if (!jsonlFile) {
      throw new Error('No JSONL file found in events zip')
    }
    
    // For very large files, use streaming to process line by line
    console.log(`Extracting ${jsonlFileName} using streaming...`)
    
    // Get the file as an array buffer and process in chunks
    const uint8Array = await jsonlFile.async('uint8array')
    const decoder = new TextDecoder('utf-8')
    
    // Process in chunks to build lines array
    const lines: string[] = []
    let currentLine = ''
    const CHUNK_SIZE = 10 * 1024 * 1024 // 10MB chunks
    
    for (let offset = 0; offset < uint8Array.length; offset += CHUNK_SIZE) {
      const chunk = uint8Array.slice(offset, Math.min(offset + CHUNK_SIZE, uint8Array.length))
      const text = decoder.decode(chunk, { stream: offset + CHUNK_SIZE < uint8Array.length })
      
      const parts = (currentLine + text).split('\n')
      currentLine = parts.pop() || '' // Last part might be incomplete
      
      for (const line of parts) {
        if (line.trim()) {
          lines.push(line)
        }
      }
    }
    
    // Don't forget the last line
    if (currentLine.trim()) {
      lines.push(currentLine)
    }
    
    console.log(`Extracted ${jsonlFileName}: ${lines.length} lines`)
    
    // Build content from lines (only for the converter which expects a string)
    // But limit to first 50000 lines for very large files to prevent memory issues
    const MAX_LINES = 50000
    const limitedLines = lines.slice(0, MAX_LINES)
    if (lines.length > MAX_LINES) {
      console.warn(`File has ${lines.length} lines, limiting to first ${MAX_LINES} to prevent memory issues`)
    }

    console.log(`Converting Valorant series ${seriesId} from ${limitedLines.length} lines...`)
    
    // Convert the data directly from lines (avoids joining into a huge string)
    const streamlined = convertValorantSeriesDataFromLines(limitedLines)

    // Cache the result
    await storeJSON(convertedKey, streamlined)
    console.log(`Valorant series ${seriesId} converted and cached`)

    // Run Valorant analytics
    console.log(`Running Valorant analytics for series ${seriesId}...`)
    await runAllValorantAnalytics(seriesId, streamlined)
    console.log(`Valorant analytics complete for series ${seriesId}`)

    return NextResponse.json({ data: streamlined, cached: false })
  } catch (error) {
    console.error(`Error converting Valorant series ${seriesId}:`, error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Conversion failed' },
      { status: 500 }
    )
  }
}
