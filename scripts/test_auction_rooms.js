const Database = require('better-sqlite3');
const db = new Database('data/stroom.db');

console.log('--- TESTING AUCTION_ROOMS NULLABLE EVENT_ID ---');
// Check current auction_rooms rows
const rooms = db.prepare('SELECT id, event_id, title FROM auction_rooms').all();
console.log('Current rooms:', rooms);
