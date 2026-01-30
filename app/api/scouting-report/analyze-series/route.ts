import { NextRequest, NextResponse } from 'next/server'
import { getAnalytics } from '../../../analytics'

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
    
    if (!analytics) {
      // Need to convert and generate analytics
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
      const convertResponse = await fetch(`${baseUrl}/api/grid/series/${seriesId}/convert`)
      
      if (!convertResponse.ok) {
        return NextResponse.json(
          { error: `Failed to convert series ${seriesId}` },
          { status: 500 }
        )
      }
      
      // Now get the analytics that were generated
      analytics = await getAnalytics(seriesId)
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
