/**
 * Run the world engine
 * Performs one observation cycle and saves the world state.
 * Usage: node engine/run.js [--config path] [--state path] [--queries "q1,q2,q3"]
 */

const path = require('path');
const { World } = require('./world');

async function main() {
  const args = process.argv.slice(2);

  let configPath = path.join(__dirname, '..', '..', 'backrooms', 'config.json');
  let statePath = path.join(__dirname, '..', 'data', 'world-state.json');
  let queries = ['AI consciousness', 'simulation theory', 'internet culture', 'void', 'liminal spaces', 'substrate'];

  // Parse args
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--config' && args[i + 1]) configPath = args[++i];
    if (args[i] === '--state' && args[i + 1]) statePath = args[++i];
    if (args[i] === '--queries' && args[i + 1]) queries = args[++i].split(',').map(q => q.trim());
  }

  console.log('=== NEX WORLD ENGINE ===');
  console.log(`Config: ${configPath}`);
  console.log(`State: ${statePath}`);
  console.log(`Queries: ${queries.join(', ')}`);
  console.log('');

  // Ensure data directory exists
  const fs = require('fs');
  const dataDir = path.dirname(statePath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Initialize world
  const world = new World(configPath);
  world.load(statePath);

  // Run cycle
  await world.cycle(queries);

  // Save
  world.save(statePath);

  // Print summary
  const summary = world.summary();
  console.log('');
  console.log('=== WORLD SUMMARY ===');
  console.log(JSON.stringify(summary, null, 2));
}

main().catch(err => {
  console.error('Engine error:', err);
  process.exit(1);
});
