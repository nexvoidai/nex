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

  // Generate lightweight summary for M5Stack
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  const topics = {};
  let highDecay = 0;
  const recentRooms = [];
  for (const r of state.rooms) {
    topics[r.topic] = (topics[r.topic] || 0) + 1;
    if (r.entropy > 0.7) highDecay++;
  }
  for (const r of state.rooms.slice(-30)) {
    recentRooms.push({ name: r.name, topic: r.topic, commentary: (r.commentary || '').substring(0, 120) });
  }
  const m5summary = {
    rooms: state.rooms.length,
    corridors: state.corridors.length,
    entities: state.entities.length,
    cycles: state.observationCycles,
    highDecay,
    topics,
    recentRooms,
    updatedAt: Date.now()
  };
  // Write both filenames for compatibility
  const summaryPath = path.join(path.dirname(statePath), '..', 'world-summary.json');
  const esp32Path = path.join(path.dirname(statePath), '..', 'esp32-summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(m5summary));
  fs.writeFileSync(esp32Path, JSON.stringify(m5summary));
  console.log(`M5Stack summary written to ${summaryPath} and ${esp32Path}`);

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
