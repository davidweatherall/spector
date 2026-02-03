# Spector

Professional esports analytics companion for **League of Legends** and **Valorant**. Spector generates detailed scouting reports by analyzing match data from the GRID Esports API.

## Features

### Valorant
- **Scouting Reports**: Comprehensive team analysis across maps
- **Map Analysis**: Per-map statistics with interactive map visualization
- **Defensive Setups**: Track player positioning at freeze time
- **Offensive Setups**: Analyze attack-side formations
- **Economy Tracking**: Eco round formations and tendencies
- **Ability Usage**: Defensive and offensive ability placement patterns
- **Post-Plant Positions**: Where players hold after planting
- **Lurker Detection**: Identify lurk patterns and tendencies
- **Round Playback**: Watch back round movements at 20x speed
- **Agent Statistics**: Pick rates and agent preferences

### League of Legends
- **Scouting Reports**: Analyze team tendencies across multiple games
- **Draft Analysis**: Track champion picks, bans, and draft patterns
- **Match History**: View detailed game-by-game breakdowns

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- GRID Esports API key
- Vercel Blob storage token (for caching)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/spector.git
cd spector
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

4. Add your API keys to `.env`:
```
GRID_ESPORTS_API_KEY=your_grid_api_key_here
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token_here
```

5. Start the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000)

## Usage

### Generating a Scouting Report

1. Navigate to the **Valorant** or **League of Legends** page
2. Select a **League** from the filters (e.g., VCT Americas)
3. Teams will auto-load from tournaments in that league
4. Select a **Team** to analyze
5. Click **Full Report** to analyze all available games, or use the custom input to specify a number of recent games
6. Wait for analysis to complete (progress shown in real-time)
7. Explore the generated scouting report

### Interpreting the Report

#### Valorant
- **Left Sidebar**: Defensive/Offensive formations and economy setups
- **Center**: Interactive map visualization with selectable overlays
- **Right Sidebar**: Ability usage, location tracking, and round playback

#### Map Visualization Tabs
- **Ability Usage > Attacker/Defender**: Where abilities are commonly used
- **Location Tracking > Post Plant**: Player positions after planting
- **Location Tracking > Defender**: Defensive holding positions
- **Round Playback**: Animate through recorded rounds

## Project Structure

```
spector/
├── app/
│   ├── analytics/          # LoL analytics functions
│   ├── val-analytics/      # Valorant analytics functions
│   ├── api/                # API routes
│   │   ├── grid/           # GRID API proxy endpoints
│   │   ├── scouting-report/# LoL report generation
│   │   └── val/            # Valorant endpoints
│   ├── components/         # React components
│   ├── contexts/           # React context providers
│   ├── lol/                # LoL pages
│   ├── val/                # Valorant pages
│   ├── utils/              # Utility functions
│   └── types/              # TypeScript types
├── staticData/             # Static game data (champions, maps)
├── public/                 # Static assets (images)
└── positions/              # Saved position data
```

## Development

### Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: CSS Modules
- **Charts**: Recharts
- **Storage**: Vercel Blob
- **Fonts**: Google Fonts (Oswald)

### Key Components

| Component | Description |
|-----------|-------------|
| `TournamentSelector` | Main UI for filters, team selection, and report display |
| `ValorantMapPlayer` | Interactive Valorant map with position overlays |
| `InteractivePlayer` | LoL interactive game viewer |
| `GridDataContext` | Global state for tournaments, teams, and games |

### Analytics Modules

#### Valorant (`app/val-analytics/`)
| Module | Description |
|--------|-------------|
| `defensiveSetupAnalysis` | Player positions at freeze time end |
| `offensiveSetupAnalysis` | Attack-side formations |
| `abilityUsageAnalysis` | Ability usage patterns |
| `postPlantAnalysis` | Post-plant positioning |
| `lurkerAnalysis` | Lurker detection |
| `playerPositionAnalysis` | Common player positions |
| `playbackAnalysis` | Round-by-round coordinate data |
| `agentPickAnalysis` | Agent pick rates |
| `mapVetoAnalysis` | Map pick/ban patterns |
| `economySetupAnalysis` | Eco round formations |

#### League of Legends (`app/analytics/`)
| Module | Description |
|--------|-------------|
| `draftAnalysis` | Pick/ban patterns |
| `banPhaseAnalysis` | Ban targeting analysis |
| `classWinRate` | Champion class performance |
| `counterPickGoldDiff` | Counter-pick effectiveness |

### API Routes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/grid/tournaments` | GET | Fetch tournaments by game |
| `/api/grid/teams` | POST | Fetch teams from tournaments |
| `/api/grid/games` | POST | Fetch games for a team |
| `/api/val/scouting-report` | POST | Generate Valorant report |
| `/api/scouting-report` | POST | Generate LoL report |

### Adding New Analytics

1. Create a new file in `app/val-analytics/` or `app/analytics/`
2. Export an analysis function that takes series data and returns results
3. Add to the index file exports
4. Integrate into `scoutingReport.ts` aggregation
5. Add UI in `TournamentSelector.tsx`

## Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GRID_ESPORTS_API_KEY` | API key for GRID Esports data | Yes |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob storage token | Yes |

## License

Private - All rights reserved
