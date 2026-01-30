import { NextRequest, NextResponse } from 'next/server'
import { readJSON, storeJSON } from '../../../storage'

const GRID_API_URL = 'https://api-op.grid.gg/central-data/graphql'

// Storage key generators - Valorant data stored in val/ prefix
const getTeamsKey = (game: string, tournamentId: string) => 
  game === 'valorant'
    ? `val/cache/teams_tournament_${tournamentId}.json`
    : `cache/teams_tournament_${tournamentId}.json`

interface Team {
  id: string
  name: string
}

interface SeriesTeam {
  baseInfo: {
    id: string
    name: string
  } | null
}

interface SeriesNode {
  id: string
  tournament: {
    id: string
  } | null
  teams: SeriesTeam[]
}

interface SeriesEdge {
  node: SeriesNode
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

// Fetch teams for a single tournament (with blob storage caching)
async function fetchTeamsFromTournament(
  apiKey: string,
  tournamentId: string,
  game: string = 'lol'
): Promise<Team[]> {
  const cacheKey = getTeamsKey(game, tournamentId)
  
  // Check blob storage cache first
  const cached = await readJSON<Team[]>(cacheKey)
  if (cached) {
    console.log(`Cache hit for tournament ${tournamentId}`)
    return cached
  }

  const teamsMap = new Map<string, Team>()
  let afterCursor: string | null = null
  let hasNextPage = true
  let pageCount = 0
  const maxPages = 5 // Limit to prevent too many API calls

  while (hasNextPage && pageCount < maxPages) {
    pageCount++
    
    const query = `
      query GetSeriesTeams($tournamentId: ID!, $after: String) {
        allSeries(filter: { tournamentId: $tournamentId }, first: 50, after: $after) {
          edges {
            node {
              id
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
        variables: { tournamentId, after: afterCursor },
      }),
    })

    if (!response.ok) {
      throw new Error(`GRID API error: ${response.status}`)
    }

    const result: SeriesResponse = await response.json()

    if (result.errors) {
      if (result.errors[0]?.message.includes('rate limit')) {
        throw new Error('Rate limit exceeded. Please try again later.')
      }
      throw new Error(result.errors[0]?.message || 'GraphQL error')
    }

    const { edges, pageInfo } = result.data.allSeries

    for (const edge of edges) {
      for (const team of edge.node.teams) {
        if (team?.baseInfo?.id && !teamsMap.has(team.baseInfo.id)) {
          teamsMap.set(team.baseInfo.id, {
            id: team.baseInfo.id,
            name: team.baseInfo.name,
          })
        }
      }
    }

    hasNextPage = pageInfo.hasNextPage
    afterCursor = pageInfo.endCursor
    
    // Add a small delay between requests to avoid rate limiting
    if (hasNextPage && pageCount < maxPages) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  const teams = Array.from(teamsMap.values())
  
  // Cache the result in blob storage
  await storeJSON(cacheKey, teams)
  
  return teams
}

export async function POST(request: NextRequest) {
  try {
    const { tournamentIds, game = 'lol' } = await request.json()

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

    // Limit the number of tournaments to prevent too many API calls
    const limitedTournamentIds = tournamentIds.slice(0, 5)
    
    // Fetch teams sequentially with delays to avoid rate limiting
    const allTeams: Team[] = []
    
    for (const id of limitedTournamentIds) {
      try {
        const teams = await fetchTeamsFromTournament(apiKey, id, game)
        allTeams.push(...teams)
        
        // Add delay between tournament fetches
        if (limitedTournamentIds.indexOf(id) < limitedTournamentIds.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200))
        }
      } catch (error) {
        console.error(`Error fetching teams for tournament ${id}:`, error)
        // Continue with other tournaments
      }
    }

    // Deduplicate teams
    const teamsMap = new Map<string, Team>()
    for (const team of allTeams) {
      if (!teamsMap.has(team.id)) {
        teamsMap.set(team.id, team)
      }
    }

    const teams = Array.from(teamsMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    )

    return NextResponse.json({
      teams,
      totalCount: teams.length,
      note: tournamentIds.length > 5 ? 'Limited to first 5 tournaments to avoid rate limits' : undefined,
    })
  } catch (error) {
    console.error('GRID API error:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch teams'
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
