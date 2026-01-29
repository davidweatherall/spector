import { NextRequest, NextResponse } from 'next/server'
import { readJSON, storeJSON } from '../../../storage'

const GRID_API_URL = 'https://api-op.grid.gg/central-data/graphql'

// Storage key generator
const getGamesKey = (teamId: string, tournamentIds: string[]) => 
  `cache/games_${teamId}_${tournamentIds.sort().join('_')}.json`

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

interface GamesData {
  games: Game[]
  totalCount: number
  teamName: string
}

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

  const games = result.data.allSeries.edges
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
  
  console.log(`Fetched ${games.length} games for team ${teamId} in tournament ${tournamentId}`)
  return games
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

    const cacheKey = getGamesKey(teamId, tournamentIds)
    
    console.log(`\n=== Fetching games for team: ${teamName} (ID: ${teamId}) ===`)
    console.log(`Tournaments: ${tournamentIds.length}`)
    
    // Check blob storage cache first
    const cached = await readJSON<GamesData>(cacheKey)
    if (cached) {
      console.log(`Returning ${cached.games.length} cached games from blob storage`)
      return NextResponse.json({
        ...cached,
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
      const dateA = new Date(a.date).getTime()
      const dateB = new Date(b.date).getTime()
      return dateB - dateA
    })

    // Limit to 20 most recent
    const limitedGames = uniqueGames.slice(0, 20)

    const responseData: GamesData = {
      games: limitedGames,
      totalCount: limitedGames.length,
      teamName,
    }

    // Cache the result in blob storage
    await storeJSON(cacheKey, responseData)

    return NextResponse.json(responseData)
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
