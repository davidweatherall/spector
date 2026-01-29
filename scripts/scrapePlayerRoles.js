const fs = require('fs').promises;
const path = require('path');

// Delay function for rate limiting
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Map role names to standardized values
function normalizeRole(role) {
  if (!role) return 'unknown';
  
  const roleLower = role.toLowerCase().trim();
  
  if (roleLower.includes('mid')) return 'mid';
  if (roleLower.includes('top')) return 'top';
  if (roleLower.includes('jungle') || roleLower === 'jungler') return 'jungle';
  if (roleLower.includes('bot') || roleLower.includes('adc') || roleLower.includes('marksman')) return 'adc';
  if (roleLower.includes('support')) return 'support';
  
  return 'unknown';
}

// Extract role from HTML using regex
function extractRoleFromHtml(html) {
  // Try to find role in the infobox - look for the title attribute in sprite role-sprite
  // Pattern: <span title="Mid Laner" class="sprite role-sprite"
  const titleMatch = html.match(/<span[^>]*title="([^"]*)"[^>]*class="[^"]*sprite role-sprite[^"]*"/i);
  if (titleMatch) {
    return titleMatch[1];
  }
  
  // Alternative pattern with class before title
  const altMatch = html.match(/<span[^>]*class="[^"]*sprite role-sprite[^"]*"[^>]*title="([^"]*)"/i);
  if (altMatch) {
    return altMatch[1];
  }
  
  // Look for markup-object-name after Role label
  const roleSection = html.match(/class="infobox-label"[^>]*>Role<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i);
  if (roleSection) {
    const nameMatch = roleSection[1].match(/class="markup-object-name"[^>]*>([^<]*)</i);
    if (nameMatch) {
      return nameMatch[1];
    }
  }
  
  return null;
}

async function fetchPlayerRole(playerName) {
  // URL encode the player name
  const encodedName = encodeURIComponent(playerName.trim());
  const url = `https://lol.fandom.com/wiki/${encodedName}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        console.log(`  ⚠️  Page not found for: ${playerName}`);
      } else {
        console.log(`  ⚠️  HTTP ${response.status} for: ${playerName}`);
      }
      return null;
    }
    
    const html = await response.text();
    const role = extractRoleFromHtml(html);
    
    return role;
  } catch (error) {
    console.log(`  ❌ Error fetching ${playerName}: ${error.message}`);
    return null;
  }
}

async function main() {
  const positionsPath = path.join(__dirname, '..', 'data', 'positions.json');
  
  console.log('📖 Reading positions.json...');
  const positionsData = await fs.readFile(positionsPath, 'utf-8');
  const positions = JSON.parse(positionsData);
  
  const playerNames = Object.keys(positions);
  const total = playerNames.length;
  let found = 0;
  let notFound = 0;
  
  console.log(`\n🎮 Processing ${total} players...\n`);
  
  for (let i = 0; i < playerNames.length; i++) {
    const playerName = playerNames[i];
    const progress = `[${i + 1}/${total}]`;
    
    process.stdout.write(`${progress} ${playerName}... `);
    
    const role = await fetchPlayerRole(playerName);
    const normalizedRole = normalizeRole(role);
    
    if (normalizedRole !== 'unknown') {
      positions[playerName] = normalizedRole;
      console.log(`✅ ${normalizedRole}`);
      found++;
    } else {
      console.log(`❓ unknown`);
      notFound++;
    }
    
    // Rate limiting - wait 1 second between requests
    if (i < playerNames.length - 1) {
      await delay(1000);
    }
  }
  
  console.log('\n💾 Saving updated positions.json...');
  await fs.writeFile(positionsPath, JSON.stringify(positions, null, 2), 'utf-8');
  
  console.log('\n📊 Summary:');
  console.log(`   ✅ Found: ${found}`);
  console.log(`   ❓ Unknown: ${notFound}`);
  console.log(`   📁 Total: ${total}`);
  console.log('\n✨ Done!');
}

main().catch(console.error);
