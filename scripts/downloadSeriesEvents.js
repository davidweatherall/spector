// Download series events data from GRID API
const fs = require('fs');
const path = require('path');

const SERIES_ID = process.argv[2] || '2843070';

async function downloadEvents() {
  // Load API key from environment or .env file
  let apiKey = process.env.GRID_ESPORTS_API_KEY;
  
  if (!apiKey) {
    try {
      const envContent = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf-8');
      const match = envContent.match(/GRID_ESPORTS_API_KEY=(.+)/);
      if (match) apiKey = match[1].trim();
    } catch (e) {
      // Try parent directory
      try {
        const envContent = fs.readFileSync(path.join(__dirname, '..', '..', '.env'), 'utf-8');
        const match = envContent.match(/GRID_ESPORTS_API_KEY=(.+)/);
        if (match) apiKey = match[1].trim();
      } catch (e2) {
        console.error('Could not find API key');
        process.exit(1);
      }
    }
  }

  console.log(`Downloading events for series ${SERIES_ID}...`);
  
  const url = `https://api.grid.gg/file-download/events/grid/series/${SERIES_ID}`;
  
  const outputDir = path.join(__dirname, '..', `sample-events-${SERIES_ID}`);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/zip',
        'x-api-key': apiKey,
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    const zipPath = path.join(outputDir, `events_${SERIES_ID}.zip`);
    fs.writeFileSync(zipPath, Buffer.from(buffer));
    console.log(`Downloaded zip to: ${zipPath}`);
    console.log(`Size: ${(buffer.byteLength / 1024).toFixed(1)} KB`);
    
    // Try to extract with adm-zip if available
    try {
      const AdmZip = require('adm-zip');
      const zip = new AdmZip(zipPath);
      zip.extractAllTo(outputDir, true);
      console.log(`Extracted to: ${outputDir}`);
      
      // List extracted files
      const files = fs.readdirSync(outputDir).filter(f => !f.endsWith('.zip'));
      console.log('\nExtracted files:');
      files.forEach(f => {
        const stats = fs.statSync(path.join(outputDir, f));
        console.log(`  - ${f} (${(stats.size / 1024).toFixed(1)} KB)`);
      });
    } catch (e) {
      console.log('\nNote: adm-zip not installed. Trying PowerShell extraction...');
      
      // Use PowerShell to extract
      const { execSync } = require('child_process');
      try {
        execSync(`Expand-Archive -Path "${zipPath}" -DestinationPath "${outputDir}" -Force`, { shell: 'powershell' });
        console.log(`Extracted to: ${outputDir}`);
        
        const files = fs.readdirSync(outputDir).filter(f => !f.endsWith('.zip'));
        console.log('\nExtracted files:');
        files.forEach(f => {
          const stats = fs.statSync(path.join(outputDir, f));
          console.log(`  - ${f} (${(stats.size / 1024).toFixed(1)} KB)`);
        });
      } catch (e2) {
        console.log('Could not auto-extract. Please extract the zip manually.');
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

downloadEvents()
  .then(() => console.log('\nDone!'))
  .catch(err => console.error('Error:', err.message));
