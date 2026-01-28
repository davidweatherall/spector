import { NextRequest, NextResponse } from 'next/server'

const GRID_API_URL = 'https://api-op.grid.gg/central-data/graphql'

interface TeamInfo {
  id: string
  name: string
}

interface SeriesTeam {
  baseInfo: TeamInfo | null
}

interface Series {
  id: string
  startTimeScheduled: string | null
  tournament: {
    id: string
    name: string
  } | null
  teams: SeriesTeam[]
}

interface SeriesEdge {
  node: Series
}

interface SeriesResponse {
  data: {
    allSeries: {
      edges: SeriesEdge[]
      pageInfo: {
        hasNextPage: boolean
        endCursor: string | null
      }
    }
  }
  errors?: { message: string }[]
}

export interface Game {
  id: string
  date: string | null
  tournament: string
  tournamentId: string
  opponent: TeamInfo
  isHome: boolean
}

// Permanent cache for team games (keyed by teamId + tournamentIds)
// Data is historical and won't change
const gamesCache = new Map<string, Game[]>()

async function fetchGamesForTournament(
  teamId: string,
  tournamentId: string,
  apiKey: string
): Promise<Game[]> {
  const query = `
    query GetTeamSeries($teamId: ID!, $tournamentId: ID!) {
      allSeries(
        filter: { teamId: $teamId, tournamentId: $tournamentId }
        first: 50
        orderBy: StartTimeScheduled
        orderDirection: DESC
      ) {
        edges {
          node {
            id
            startTimeScheduled
            tournament {
              id
              name
            }
            teams {
              baseInfo {
                id
                name
              }
            }
          }
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
      variables: { teamId, tournamentId },
    }),
  })

  if (!response.ok) {
    throw new Error(`GRID API error: ${response.status}`)
  }

  const result: SeriesResponse = await response.json()

  if (result.errors) {
    throw new Error(result.errors[0]?.message || 'GraphQL error')
  }

  return result.data.allSeries.edges
    .map(edge => {
      const series = edge.node
      const teams = series.teams.filter(t => t.baseInfo)
      
      if (teams.length !== 2) return null
      
      const isHome = teams[0].baseInfo?.id === teamId
      const opponentTeam = isHome ? teams[1].baseInfo : teams[0].baseInfo
      
      if (!opponentTeam) return null

      return {
        id: series.id,
        date: series.startTimeScheduled,
        tournament: series.tournament?.name || 'Unknown Tournament',
        tournamentId: series.tournament?.id || tournamentId,
        opponent: opponentTeam,
        isHome,
      }
    })
    .filter((game): game is Game => game !== null)
}

export async function POST(request: NextRequest) {
  try {
    const { teamId, teamName, tournamentIds } = await request.json()

    if (!teamId) {
      return NextResponse.json(
        { error: 'teamId is required' },
        { status: 400 }
      )
    }

    if (!tournamentIds || !Array.isArray(tournamentIds) || tournamentIds.length === 0) {
      return NextResponse.json(
        { error: 'tournamentIds array is required' },
        { status: 400 }
      )
    }

    const apiKey = process.env.GRID_ESPORTS_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key not configured' },
        { status: 500 }
      )
    }

    // Create cache key from teamId + sorted tournamentIds
    const cacheKey = `${teamId}:${tournamentIds.sort().join(',')}`
    
    // Check cache (permanent - historical data doesn't change)
    const cached = gamesCache.get(cacheKey)
    if (cached) {
      return NextResponse.json({
        games: cached,
        totalCount: cached.length,
        cached: true,
      })
    }

    // Fetch games for each tournament
    const allGames: Game[] = []
    
    for (const tournamentId of tournamentIds) {
      try {
        const games = await fetchGamesForTournament(teamId, tournamentId, apiKey)
        allGames.push(...games)
        
        // Small delay to avoid rate limiting
        if (tournamentIds.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      } catch (error) {
        // If rate limited, return what we have so far
        if (error instanceof Error && error.message.includes('rate limit')) {
          if (allGames.length > 0) {
            break
          }
          throw error
        }
        console.error(`Error fetching games for tournament ${tournamentId}:`, error)
      }
    }

    // Deduplicate by game id (in case of overlaps)
    const uniqueGames = allGames.reduce((acc, game) => {
      if (!acc.some(g => g.id === game.id)) {
        acc.push(game)
      }
      return acc
    }, [] as Game[])

    // Sort by date (most recent first)
    uniqueGames.sort((a, b) => {
      if (!a.date) return 1
      if (!b.date) return -1
      return new Date(b.date).getTime() - new Date(a.date).getTime()
    })

    // Limit to 20 most recent
    const limitedGames = uniqueGames.slice(0, 20)

    // Cache the result permanently
    gamesCache.set(cacheKey, limitedGames)

    return NextResponse.json({
      games: limitedGames,
      totalCount: limitedGames.length,
      teamName,
    })
  } catch (error) {
    console.error('GRID API error:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch games'
    const isRateLimit = errorMessage.includes('rate limit')
    
    return NextResponse.json(
      { 
        error: errorMessage,
        retryAfter: isRateLimit ? 60 : undefined 
      },
      { status: isRateLimit ? 429 : 500 }
    )
  }
}
