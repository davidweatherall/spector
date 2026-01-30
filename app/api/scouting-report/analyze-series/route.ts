import { NextRequest, NextResponse } from 'next/server'
import { getAnalytics, runAllAnalytics } from '../../../analytics'
import { readJSON } from '../../../storage'
import { StreamlinedSeries } from '../../../utils/seriesConverter'

/**
 * POST - Analyze a single series (trigger conversion if needed)
 * Returns whether it was a cache hit and the analytics
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { seriesId } = body
    
    if (!seriesId) {
      return NextResponse.json({ error: 'seriesId is required' }, { status: 400 })
    }
    
    // Check if analytics already exist (cache hit)
    let analytics = await getAnalytics(seriesId)
    let cacheHit = !!analytics
    
    // Check if analytics have all required data (e.g., classWinRate was added later)
    const hasClassWinRate = analytics?.results?.some((r: any) => r.name === 'classWinRate')
    if (analytics && !hasClassWinRate) {
      console.log(`Analytics for ${seriesId} missing classWinRate, will re-run`)
      analytics = null // Force re-run
      cacheHit = false
    }
    
    if (!analytics) {
      // First, check if converted data already exists (skip conversion API call)
      const convertedKey = `converted/series_${seriesId}.json`
      let convertedData = await readJSON<StreamlinedSeries>(convertedKey)
      
      if (convertedData) {
        // Converted data exists, just run analytics
        console.log(`Converted data exists for ${seriesId}, running analytics only`)
        analytics = await runAllAnalytics(seriesId, convertedData)
        cacheHit = true // Mark as cache hit since we skipped conversion
      } else {
        // Need to convert and generate analytics
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
        const convertResponse = await fetch(`${baseUrl}/api/grid/series/${seriesId}/convert`)
        
        if (!convertResponse.ok) {
          return NextResponse.json(
            { error: `Failed to convert series ${seriesId}` },
            { status: 500 }
          )
        }
        
        const convertResult = await convertResponse.json()
        
        // If convert returned cached data, analytics might not exist
        // The convert endpoint only runs analytics on fresh conversions
        if (convertResult.cached) {
          // Check if analytics exist now
          analytics = await getAnalytics(seriesId)
          
          // If still no analytics but we have converted data, run analytics
          if (!analytics) {
            convertedData = await readJSON<StreamlinedSeries>(convertedKey)
            
            if (convertedData) {
              console.log(`Running analytics for cached conversion: ${seriesId}`)
              analytics = await runAllAnalytics(seriesId, convertedData)
            }
          }
          cacheHit = true
        } else {
          // Fresh conversion - analytics should have been generated
          analytics = await getAnalytics(seriesId)
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      seriesId,
      cacheHit,
      hasAnalytics: !!analytics,
    })
  } catch (error) {
    console.error('Error analyzing series:', error)
    return NextResponse.json(
      { error: 'Failed to analyze series' },
      { status: 500 }
    )
  }
}
