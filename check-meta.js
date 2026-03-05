const w = JSON.parse(require('fs').readFileSync('data/world-state.json', 'utf8'));
const keys = Object.keys(w).filter(k => k !== 'rooms' && k !== 'corridors' && k !== 'entities');
keys.forEach(k => console.log(k + ':', JSON.stringify(w[k]).substring(0, 200)));
