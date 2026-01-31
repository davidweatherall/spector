import { NextRequest, NextResponse } from 'next/server'
import { getValorantAnalytics, ValorantAnalyticsOutput } from '../../../val-analytics'
import { aggregateValorantScoutingReport, ValorantScoutingReport } from '../../../val-analytics/scoutingReport'

/**
 * POST - Generate a Valorant scouting report for a team across multiple series
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { teamId, teamName, seriesIds } = body
    
    if (!teamId) {
      return NextResponse.json({ error: 'teamId is required' }, { status: 400 })
    }
    
    if (!seriesIds || !Array.isArray(seriesIds) || seriesIds.length === 0) {
      return NextResponse.json({ error: 'seriesIds array is required' }, { status: 400 })
    }
    
    console.log(`Generating Valorant scouting report for team ${teamName} (${teamId})`)
    console.log(`Analyzing ${seriesIds.length} series...`)
    
    // Collect analytics from all series
    const analyticsResults: { 
      seriesId: string
      analytics: ValorantAnalyticsOutput
      opponent: string
      date: string
    }[] = []
    
    for (const seriesInfo of seriesIds) {
      const { seriesId, opponent, date } = typeof seriesInfo === 'string' 
        ? { seriesId: seriesInfo, opponent: 'Unknown', date: '' }
        : seriesInfo
      
      const analytics = await getValorantAnalytics(seriesId)
      
      if (analytics) {
        analyticsResults.push({
          seriesId,
          analytics,
          opponent: opponent || 'Unknown',
          date: date || '',
        })
      } else {
        console.log(`No Valorant analytics found for series ${seriesId}`)
      }
    }
    
    if (analyticsResults.length === 0) {
      return NextResponse.json(
        { error: 'No analytics found for the specified series' },
        { status: 404 }
      )
    }
    
    // Aggregate into scouting report
    const report: ValorantScoutingReport = aggregateValorantScoutingReport(
      teamId,
      teamName || 'Unknown Team',
      analyticsResults
    )
    
    console.log(`Valorant scouting report generated for ${teamName}: ${report.seriesAnalyzed} series, ${report.mapsPlayed} maps`)
    
    return NextResponse.json({ report })
  } catch (error) {
    console.error('Error generating Valorant scouting report:', error)
    return NextResponse.json(
      { error: 'Failed to generate Valorant scouting report' },
      { status: 500 }
    )
  }
}
