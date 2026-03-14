// Sawari - Data integrity verification
// Author: Zenith Kandel — https://zenithkandel.com.np

const s = require('./data/stops.json');
const r = require('./data/routes.json');
console.log('Stops:', s.length, '| Routes:', r.length);
console.log('Stop ID range:', Math.min(...s.map(x => x.id)), '-', Math.max(...s.map(x => x.id)));

const ids = new Set(s.map(x => x.id));
let bad = 0;
r.forEach(rt => rt.stopIds.forEach(sid => { if (ids.has(sid) === false) bad++; }));
console.log('Broken stop references:', bad);

console.log('\nSample new routes:');
r.slice(2, 6).forEach(rt => {
    console.log(` - ${rt.name} (${rt.stopIds.length} stops, color: ${rt.color}${rt.operator ? ', operator: ' + rt.operator.join(', ') : ''})`);
});
