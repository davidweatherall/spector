const fs = require('fs').promises;
const path = require('path');
const puppeteer = require('puppeteer');
const readline = require('readline');

// Delay function for rate limiting
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Random delay between min and max ms
const randomDelay = (min, max) => delay(Math.floor(Math.random() * (max - min + 1)) + min);

// Wait for user to press Enter
function waitForEnter(message) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise(resolve => {
    rl.question(message, () => {
      rl.close();
      resolve();
    });
  });
}

// Check if page has Cloudflare challenge
async function hasCloudflareChallenge(page) {
  return await page.evaluate(() => {
    const title = document.title.toLowerCase();
    const bodyText = document.body?.innerText?.toLowerCase() || '';
    
    // Check for common Cloudflare challenge indicators
    if (title.includes('just a moment') || title.includes('cloudflare')) return true;
    if (bodyText.includes('checking your browser') || bodyText.includes('verify you are human')) return true;
    if (document.querySelector('#challenge-running')) return true;
    if (document.querySelector('.cf-browser-verification')) return true;
    
    return false;
  });
}

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

async function fetchPlayerRole(page, playerName) {
  // URL encode the player name
  const encodedName = encodeURIComponent(playerName.trim());
  const url = `https://lol.fandom.com/wiki/${encodedName}`;
  
  try {
    const response = await page.goto(url, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    
    // Wait a moment for any dynamic content
    await delay(1000);
    
    // Check for Cloudflare challenge
    if (await hasCloudflareChallenge(page)) {
      console.log(`\n\n🛡️  CLOUDFLARE CHALLENGE DETECTED!`);
      console.log(`    Please solve the challenge in the browser window.`);
      await waitForEnter('    Press ENTER when done... ');
      
      // Wait a bit after solving
      await delay(2000);
      
      // Retry the page load
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await delay(1000);
      
      // Check again
      if (await hasCloudflareChallenge(page)) {
        console.log(`  ⚠️  Still showing challenge, skipping...`);
        return null;
      }
    }
    
    if (!response.ok()) {
      const status = response.status();
      if (status === 404) {
        console.log(`  ⚠️  Page not found`);
      } else {
        console.log(`  ⚠️  HTTP ${status}`);
      }
      return null;
    }
    
    // Try to find the role using page.evaluate
    const role = await page.evaluate(() => {
      // Look for the sprite role-sprite span with title attribute
      const roleSprite = document.querySelector('.sprite.role-sprite[title]');
      if (roleSprite) {
        return roleSprite.getAttribute('title');
      }
      
      // Alternative: look for markup-object-name after Role label
      const roleLabel = Array.from(document.querySelectorAll('.infobox-label'))
        .find(el => el.textContent.trim() === 'Role');
      
      if (roleLabel) {
        const roleCell = roleLabel.nextElementSibling;
        if (roleCell) {
          const roleName = roleCell.querySelector('.markup-object-name');
          if (roleName) {
            return roleName.textContent.trim();
          }
        }
      }
      
      return null;
    });
    
    return role;
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    return null;
  }
}

async function main() {
  const positionsPath = path.join(__dirname, '..', 'positions', 'positions.json');
  
  console.log('📖 Reading positions.json...');
  const positionsData = await fs.readFile(positionsPath, 'utf-8');
  const positions = JSON.parse(positionsData);
  
  const playerNames = Object.keys(positions);
  const total = playerNames.length;
  let found = 0;
  let notFound = 0;
  
  console.log('🚀 Launching browser...');
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Set a realistic viewport and user agent
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
  
  console.log(`\n🎮 Processing ${total} players...\n`);
  
  try {
    for (let i = 0; i < playerNames.length; i++) {
      const playerName = playerNames[i];
      const progress = `[${i + 1}/${total}]`;
      
      process.stdout.write(`${progress} ${playerName}... `);
      
      const role = await fetchPlayerRole(page, playerName);
      const normalizedRole = normalizeRole(role);
      
      if (normalizedRole !== 'unknown') {
        positions[playerName] = normalizedRole;
        console.log(`✅ ${normalizedRole}`);
        found++;
      } else {
        console.log(`❓ unknown`);
        notFound++;
      }
      
      // Rate limiting - wait 1-2 seconds between requests (randomized)
      if (i < playerNames.length - 1) {
        await randomDelay(1000, 2000);
      }
      
      // Save progress every 10 players
      if ((i + 1) % 10 === 0) {
        await fs.writeFile(positionsPath, JSON.stringify(positions, null, 2), 'utf-8');
        console.log('   💾 Progress saved');
      }
    }
  } finally {
    await browser.close();
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
