const fs = require('fs');
const ws = JSON.parse(fs.readFileSync('world-state.json', 'utf8'));
const topics = {};
ws.rooms.forEach(r => { topics[r.topic] = (topics[r.topic] || 0) + 1; });
const recent = ws.rooms.slice(-5).reverse().map(r => ({
  name: r.name,
  topic: r.topic,
  comment: r.fragments?.raw ? r.fragments.raw.slice(0, 70) : (r.commentary || '')
}));
const summary = {
  rooms: ws.rooms.length,
  corridors: ws.corridors.length,
  entities: ws.entities.length,
  cycles: ws.observationCycles,
  topics,
  recentRooms: recent
};
fs.writeFileSync('world-summary.json', JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
