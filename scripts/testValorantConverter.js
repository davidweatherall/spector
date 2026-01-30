// Test script for Valorant series converter
const fs = require('fs');
const path = require('path');

// Simple JSONL parser
function parseEventsFile(content) {
  const lines = content.split('\n').filter(line => line.trim());
  const batches = [];
  
  for (const line of lines) {
    try {
      const batch = JSON.parse(line);
      batches.push(batch);
    } catch (e) {
      console.warn('Failed to parse line');
    }
  }
  
  return batches;
}

// Extract map veto actions
function extractMapVeto(batches) {
  const vetoActions = [];
  let sequenceCounter = 0;
  
  for (const batch of batches) {
    for (const event of batch.events) {
      // Team banned a map
      if (event.type === 'team-banned-map') {
        sequenceCounter++;
        vetoActions.push({
          sequenceNumber: sequenceCounter,
          occurredAt: batch.occurredAt,
          action: 'ban',
          mapId: event.target?.id || 'unknown',
          teamId: event.actor?.id || null,
          teamName: event.actor?.state?.name || null,
        });
      }
      
      // Team picked a map
      else if (event.type === 'team-picked-map') {
        sequenceCounter++;
        vetoActions.push({
          sequenceNumber: sequenceCounter,
          occurredAt: batch.occurredAt,
          action: 'pick',
          mapId: event.target?.id || 'unknown',
          teamId: event.actor?.id || null,
          teamName: event.actor?.state?.name || null,
        });
      }
      
      // Decider map (auto-picked)
      else if (event.type === 'series-picked-map') {
        sequenceCounter++;
        vetoActions.push({
          sequenceNumber: sequenceCounter,
          occurredAt: batch.occurredAt,
          action: 'decider',
          mapId: event.target?.id || 'unknown',
          teamId: null,
          teamName: null,
        });
      }
    }
  }
  
  // Sort by time
  vetoActions.sort((a, b) => {
    const timeA = new Date(a.occurredAt).getTime();
    const timeB = new Date(b.occurredAt).getTime();
    if (timeA !== timeB) return timeA - timeB;
    return a.sequenceNumber - b.sequenceNumber;
  });
  
  // Re-sequence
  vetoActions.forEach((action, index) => {
    action.sequenceNumber = index + 1;
  });
  
  return vetoActions;
}

// Main test
async function main() {
  const seriesId = process.argv[2] || '2843070';
  const filePath = path.join(__dirname, '..', `sample-events-${seriesId}`, `events_${seriesId}_grid.jsonl`);
  
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }
  
  console.log(`Reading: ${filePath}\n`);
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const batches = parseEventsFile(content);
  
  console.log(`Parsed ${batches.length} event batches\n`);
  
  // Extract map veto
  const mapVeto = extractMapVeto(batches);
  
  console.log('=== MAP VETO SEQUENCE ===\n');
  
  for (const action of mapVeto) {
    const teamInfo = action.teamName ? `${action.teamName} (${action.teamId})` : 'AUTO';
    const actionLabel = action.action.toUpperCase().padEnd(7);
    console.log(`${action.sequenceNumber}. [${actionLabel}] ${action.mapId.padEnd(10)} - ${teamInfo}`);
  }
  
  console.log('\n=== SUMMARY ===');
  console.log(`Total veto actions: ${mapVeto.length}`);
  console.log(`Bans: ${mapVeto.filter(v => v.action === 'ban').length}`);
  console.log(`Picks: ${mapVeto.filter(v => v.action === 'pick').length}`);
  console.log(`Deciders: ${mapVeto.filter(v => v.action === 'decider').length}`);
  
  // Get unique teams
  const teams = new Map();
  for (const action of mapVeto) {
    if (action.teamId && action.teamName) {
      teams.set(action.teamId, action.teamName);
    }
  }
  
  console.log('\n=== TEAMS ===');
  for (const [id, name] of teams) {
    console.log(`  ${name} (${id})`);
  }
}

main().catch(console.error);
