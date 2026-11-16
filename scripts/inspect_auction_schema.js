const Database = require('better-sqlite3');
const db = new Database('data/stroom.db');

console.log('--- AUCTION_ROOMS SCHEMA ---');
console.log(db.prepare("SELECT sql FROM sqlite_master WHERE name = 'auction_rooms'").get().sql);

console.log('\n--- EVENTS SCHEMA ---');
console.log(db.prepare("SELECT sql FROM sqlite_master WHERE name = 'events'").get().sql);

console.log('\n--- BIDS COUNT ---');
console.log(db.prepare("SELECT COUNT(*) as c FROM bids").get().c);

console.log('\n--- BIDS LINKED TO ROOMS ---');
console.log(db.prepare("SELECT auction_id, COUNT(*) as c FROM bids GROUP BY auction_id").all());
