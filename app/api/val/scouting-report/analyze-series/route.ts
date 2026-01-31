import { NextRequest, NextResponse } from 'next/server'
import { getValorantAnalytics, runAllValorantAnalytics } from '../../../../val-analytics'
import { readJSON } from '../../../../storage'
import { ValorantStreamlinedSeries } from '../../../../utils/valorantSeriesConverter'

/**
 * POST - Analyze a single Valorant series (trigger conversion if needed)
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
    let analytics = await getValorantAnalytics(seriesId)
    let cacheHit = !!analytics
    
    if (!analytics) {
      // First, check if converted data already exists
      const convertedKey = `val/converted/series_${seriesId}.json`
      let convertedData = await readJSON<ValorantStreamlinedSeries>(convertedKey)
      
      if (convertedData) {
        // Converted data exists, just run analytics
        console.log(`Converted Valorant data exists for ${seriesId}, running analytics only`)
        analytics = await runAllValorantAnalytics(seriesId, convertedData)
        cacheHit = true // Mark as cache hit since we skipped conversion
      } else {
        // Need to convert and generate analytics
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
        const convertResponse = await fetch(`${baseUrl}/api/val/series/${seriesId}/convert`)
        
        if (!convertResponse.ok) {
          return NextResponse.json(
            { error: `Failed to convert Valorant series ${seriesId}` },
            { status: 500 }
          )
        }
        
        const convertResult = await convertResponse.json()
        
        // If convert returned cached data, analytics might not exist
        if (convertResult.cached) {
          // Check if analytics exist now
          analytics = await getValorantAnalytics(seriesId)
          
          // If still no analytics but we have converted data, run analytics
          if (!analytics) {
            convertedData = await readJSON<ValorantStreamlinedSeries>(convertedKey)
            
            if (convertedData) {
              console.log(`Running Valorant analytics for cached conversion: ${seriesId}`)
              analytics = await runAllValorantAnalytics(seriesId, convertedData)
            }
          }
          cacheHit = true
        } else {
          // Fresh conversion - analytics should have been generated
          analytics = await getValorantAnalytics(seriesId)
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
    console.error('Error analyzing Valorant series:', error)
    return NextResponse.json(
      { error: 'Failed to analyze Valorant series' },
      { status: 500 }
    )
  }
}
