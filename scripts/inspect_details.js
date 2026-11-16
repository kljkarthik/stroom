const Database = require('better-sqlite3');
const db = new Database('data/stroom.db');

console.log('\n--- PARTNER USERS ---');
console.log(db.prepare("SELECT * FROM partner_users").all());

console.log('\n--- NOTIFICATIONS ---');
console.log(db.prepare("SELECT id, user_id, type, title, created_at FROM notifications LIMIT 10").all());

console.log('\n--- COUPON REDEMPTIONS ---');
console.log(db.prepare("SELECT id, coupon_id, user_id, verified_by_user_id, pass_code, order_amount, redeemed_at FROM coupon_redemptions LIMIT 10").all());

console.log('\n--- CONTACT INQUIRIES ---');
console.log(db.prepare("SELECT id, name, email, subject, created_at FROM contact_inquiries LIMIT 10").all());

console.log('\n--- PARTNER PROPOSALS ---');
console.log(db.prepare("SELECT id, partner_name, email, city, status, created_at FROM partner_proposals LIMIT 10").all());

console.log('\n--- ADMIN ANNOUNCEMENTS ---');
console.log(db.prepare("SELECT id, title, target_audience, created_by, created_at FROM admin_announcements LIMIT 10").all());

console.log('\n--- DISCOVERY ITEMS ---');
console.log(db.prepare("SELECT id, title, item_type, city_id, status FROM discovery_items LIMIT 10").all());
