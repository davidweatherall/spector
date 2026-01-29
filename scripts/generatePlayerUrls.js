const fs = require('fs').promises;
const path = require('path');

async function main() {
  const positionsPath = path.join(__dirname, '..', 'positions', 'positions.json');
  
  const positionsData = await fs.readFile(positionsPath, 'utf-8');
  const positions = JSON.parse(positionsData);
  
  const playerNames = Object.keys(positions);
  
  console.log('{');
  playerNames.forEach((name, i) => {
    const url = `https://lol.fandom.com/wiki/${encodeURIComponent(name.trim())}`;
    const comma = i < playerNames.length - 1 ? ',' : '';
    console.log(`  "${name}": "${positions[name]}"${comma} // ${url}`);
  });
  console.log('}');
}

main().catch(console.error);
