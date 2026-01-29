import { NextRequest, NextResponse } from 'next/server'
import { readJSON, storeJSON } from '../../../storage'

const GRID_API_URL = 'https://api-op.grid.gg/central-data/graphql'

// Storage keys
const getTournamentsKey = (titleId: string) => `cache/tournaments_${titleId}.json`

interface Tournament {
  id: string
  name: string
  startDate?: string
  endDate?: string
}

interface TournamentWithLeague extends Tournament {
  league: string
  isLive: boolean
}

interface TournamentEdge {
  node: Tournament
  cursor: string
}

interface TournamentsResponse {
  data: {
    tournaments: {
      edges: TournamentEdge[]
      pageInfo: {
        hasNextPage: boolean
        endCursor: string | null
      }
    }
  }
  errors?: { message: string }[]
}

interface TournamentsData {
  tournaments: TournamentWithLeague[]
  leagues: string[]
  tournamentsByLeague: Record<string, TournamentWithLeague[]>
  totalCount: number
}

// Extract league name from tournament name (before the ' - ')
function extractLeague(tournamentName: string): string {
  const match = tournamentName.match(/^([^-]+?)(?:\s*-|$)/)
  if (match) {
    return match[1].trim()
  }
  return tournamentName.trim()
}

// Fetch a single page of tournaments
async function fetchTournamentsPage(
  apiKey: string,
  titleId: string,
  afterCursor: string | null = null
): Promise<TournamentsResponse> {
  const query = `
    query GetTournaments($titleId: ID!, $after: String) {
      tournaments(filter: { titleId: $titleId }, first: 50, after: $after) {
        edges {
          node {
            id
            name
            startDate
            endDate
          }
          cursor
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `

  const response = await fetch(GRID_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      query,
      variables: { titleId, after: afterCursor },
    }),
  })

  if (!response.ok) {
    throw new Error(`GRID API error: ${response.status}`)
  }

  return response.json()
}

// Fetch all tournaments with pagination
async function fetchAllTournaments(
  apiKey: string,
  titleId: string
): Promise<Tournament[]> {
  const allTournaments: Tournament[] = []
  let afterCursor: string | null = null
  let hasNextPage = true

  while (hasNextPage) {
    const result = await fetchTournamentsPage(apiKey, titleId, afterCursor)

    if (result.errors) {
      throw new Error(result.errors[0]?.message || 'GraphQL error')
    }

    const { edges, pageInfo } = result.data.tournaments
    
    for (const edge of edges) {
      allTournaments.push(edge.node)
    }

    hasNextPage = pageInfo.hasNextPage
    afterCursor = pageInfo.endCursor
  }

  return allTournaments
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const game = searchParams.get('game') // 'lol' or 'valorant'

    const apiKey = process.env.GRID_ESPORTS_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key not configured' },
        { status: 500 }
      )
    }

    // titleId: 3 = League of Legends, 25 = Valorant
    const titleId = game === 'valorant' ? '25' : '3'
    const cacheKey = getTournamentsKey(titleId)

    // Check for force refresh param
    const forceRefresh = searchParams.get('refresh') === 'true'
    
    // Check blob storage cache first
    if (!forceRefresh) {
      const cached = await readJSON<TournamentsData>(cacheKey)
      if (cached) {
        console.log('Returning cached tournaments from blob storage')
        return NextResponse.json(cached)
      }
    }

    // Fetch all tournaments with pagination
    const allTournaments = await fetchAllTournaments(apiKey, titleId)

    // Filter: keep only tournaments with the stage suffix pattern
    // Tournaments with "(Stage: Stage)" pattern have actual series data
    // e.g., "LCK - Spring 2024 (Regular Season: Regular Season)" has data
    // but "LCK - Spring 2024" (parent tournament) doesn't
    const stagePattern = /\([^)]+:\s*[^)]+\)$/
    const validTournaments = allTournaments.filter(
      (t) => stagePattern.test(t.name) && !t.name.includes('2024')
    )

    const now = new Date()

    // Process tournaments and extract leagues
    // Determine if tournament is "live" based on name (contains current year and "Spring"/"Split 1" for Q1-Q2)
    const currentYear = now.getFullYear().toString()
    
    const tournaments: TournamentWithLeague[] = validTournaments.map(
      (tournament) => {
        // Check if tournament name contains current year
        const isCurrentYear = tournament.name.includes(currentYear)
        
        // Simple heuristic: if it's current year, it might be live
        // We can't reliably determine live status without dates
        const isLive = isCurrentYear
        
        return {
          ...tournament,
          league: extractLeague(tournament.name),
          isLive,
        }
      }
    )

    // Get unique leagues sorted alphabetically
    const leagues = Array.from(new Set(tournaments.map(t => t.league))).sort()

    // Group tournaments by league
    const tournamentsByLeague: Record<string, TournamentWithLeague[]> = {}
    for (const tournament of tournaments) {
      if (!tournamentsByLeague[tournament.league]) {
        tournamentsByLeague[tournament.league] = []
      }
      tournamentsByLeague[tournament.league].push(tournament)
    }

    // Sort tournaments within each league by name (to group by year/season)
    for (const league of Object.keys(tournamentsByLeague)) {
      tournamentsByLeague[league].sort((a, b) => {
        // Sort by name descending so newer tournaments appear first
        return b.name.localeCompare(a.name)
      })
    }

    const responseData: TournamentsData = {
      tournaments,
      leagues,
      tournamentsByLeague,
      totalCount: tournaments.length,
    }
    
    // Cache the response in blob storage
    await storeJSON(cacheKey, responseData)
    
    return NextResponse.json(responseData)
  } catch (error) {
    console.error('GRID API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch tournaments' },
      { status: 500 }
    )
  }
}
