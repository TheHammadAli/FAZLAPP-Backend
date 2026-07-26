require('dotenv').config();
const { Client } = require('pg');
async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const users = await client.query(`SELECT id, name, latitude, longitude, address FROM "User" WHERE name ILIKE '%hammad%' OR name ILIKE '%altaf%'`);
    console.log('Users:', JSON.stringify(users.rows, null, 2));

    const shops = await client.query(`SELECT id, "ownerId", title, latitude, longitude FROM "Shop" WHERE "ownerId" IN (SELECT id FROM "User" WHERE name ILIKE '%altaf%')`);
    console.log('Altaf shops:', JSON.stringify(shops.rows, null, 2));

    const products = await client.query(`SELECT p.id, p."shopId", p."ownerId", p."categoryId", c.name as category FROM "Product" p LEFT JOIN "Category" c ON c.id = p."categoryId" WHERE p."ownerId" IN (SELECT id FROM "User" WHERE name ILIKE '%altaf%') OR p."shopId" IN (SELECT id FROM "Shop" WHERE "ownerId" IN (SELECT id FROM "User" WHERE name ILIKE '%altaf%'))`);
    console.log('Altaf products:', JSON.stringify(products.rows, null, 2));

    const services = await client.query(`SELECT id, "ownerId", "categoryId" FROM "Service" WHERE "ownerId" IN (SELECT id FROM "User" WHERE name ILIKE '%altaf%')`);
    console.log('Altaf services:', JSON.stringify(services.rows, null, 2));
  } finally {
    await client.end();
  }
}
main().catch((err) => { console.error(err); process.exit(1); });
