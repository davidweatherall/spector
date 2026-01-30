import { NextRequest, NextResponse } from 'next/server'
import { readJSON, storeJSON } from '../../../storage'

const GRID_API_URL = 'https://api-op.grid.gg/central-data/graphql'

// Storage key generator - Valorant data stored in val/ prefix
const getGamesKey = (game: string, teamId: string, tournamentIds: string[]) => 
  game === 'valorant'
    ? `val/cache/games_${teamId}_${tournamentIds.sort().join('_')}.json`
    : `cache/games_${teamId}_${tournamentIds.sort().join('_')}.json`

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

// Fetch all games for a team in a single API call, then filter by tournament IDs
async function fetchAllGamesForTeam(
  teamId: string,
  tournamentIds: string[],
  apiKey: string
): Promise<Game[]> {
  const tournamentIdSet = new Set(tournamentIds)
  const allGames: Game[] = []
  let afterCursor: string | null = null
  let hasNextPage = true
  let pageCount = 0
  const maxPages = 5 // Limit pagination to avoid rate limits

  while (hasNextPage && pageCount < maxPages) {
    pageCount++
    
    // Query all series for the team (no tournament filter - more efficient)
    const query = `
      query GetTeamSeries($teamId: ID!, $after: String) {
        allSeries(
          filter: { teamId: $teamId }
          first: 50
          after: $after
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
        variables: { teamId, after: afterCursor },
      }),
    })

    if (!response.ok) {
      throw new Error(`GRID API error: ${response.status}`)
    }

    const result: SeriesResponse = await response.json()

    if (result.errors) {
      throw new Error(result.errors[0]?.message || 'GraphQL error')
    }

    const { edges, pageInfo } = result.data.allSeries

    for (const edge of edges) {
      const series = edge.node
      const tournamentId = series.tournament?.id
      
      // Only include games from selected tournaments
      if (!tournamentId || !tournamentIdSet.has(tournamentId)) {
        continue
      }
      
      const teams = series.teams.filter(t => t.baseInfo)
      if (teams.length !== 2) continue
      
      const isHome = teams[0].baseInfo?.id === teamId
      const opponentTeam = isHome ? teams[1].baseInfo : teams[0].baseInfo
      
      if (!opponentTeam) continue

      allGames.push({
        id: series.id,
        date: series.startTimeScheduled,
        tournament: series.tournament?.name || 'Unknown Tournament',
        tournamentId: tournamentId,
        opponent: opponentTeam,
        isHome,
      })
    }

    hasNextPage = pageInfo.hasNextPage
    afterCursor = pageInfo.endCursor
    
    // Small delay between pages
    if (hasNextPage && pageCount < maxPages) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  console.log(`Fetched ${allGames.length} games for team ${teamId} from ${tournamentIds.length} tournaments (${pageCount} API calls)`)
  return allGames
}

export async function POST(request: NextRequest) {
  try {
    const { teamId, teamName, tournamentIds, game = 'lol' } = await request.json()

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

    const cacheKey = getGamesKey(game, teamId, tournamentIds)
    
    console.log(`\n=== Fetching games for team: ${teamName} (ID: ${teamId}) ===`)
    console.log(`Filtering by ${tournamentIds.length} tournaments`)
    
    // Check blob storage cache first
    const cached = await readJSON<GamesData>(cacheKey)
    if (cached) {
      console.log(`Returning ${cached.games.length} cached games from blob storage`)
      return NextResponse.json({
        ...cached,
        cached: true,
      })
    }

    // Fetch all games for the team in a single optimized query
    // Then filter by selected tournament IDs
    const allGames = await fetchAllGamesForTeam(teamId, tournamentIds, apiKey)

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

    // Limit to 50 most recent games
    const limitedGames = uniqueGames.slice(0, 50)

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
