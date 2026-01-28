import { NextRequest, NextResponse } from 'next/server'

const GRID_API_URL = 'https://api-op.grid.gg/central-data/graphql'

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

    // Fetch all tournaments with pagination
    const allTournaments = await fetchAllTournaments(apiKey, titleId)

    // Filter: keep tournaments that have startDate
    const validTournaments = allTournaments.filter((t) => t.startDate)

    const now = new Date()

    // Process tournaments and extract leagues
    // Determine if tournament is "live" based on dates
    const tournaments: TournamentWithLeague[] = validTournaments.map(
      (tournament) => {
        const startDate = tournament.startDate ? new Date(tournament.startDate) : null
        const endDate = tournament.endDate ? new Date(tournament.endDate) : null
        
        // Tournament is live if: started (startDate <= now) AND not ended (no endDate OR endDate > now)
        const isLive = startDate && startDate <= now && (!endDate || endDate > now)
        
        return {
          ...tournament,
          league: extractLeague(tournament.name),
          isLive: Boolean(isLive),
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

    // Sort tournaments within each league by startDate (most recent first)
    for (const league of Object.keys(tournamentsByLeague)) {
      tournamentsByLeague[league].sort((a, b) => {
        if (!a.startDate) return 1
        if (!b.startDate) return -1
        return new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
      })
    }

    return NextResponse.json({
      tournaments,
      leagues,
      tournamentsByLeague,
      totalCount: tournaments.length,
    })
  } catch (error) {
    console.error('GRID API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch tournaments' },
      { status: 500 }
    )
  }
}
