const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function findElmer() {
    try {
        console.log("🔍 Searching for existing 'Elmer' or 'Alfonso' records in Supabase...\n");

        const res = await pool.query(`
            SELECT resident_id, full_name, age, sector, complete_address, emergency_contact
            FROM residents
            WHERE full_name ILIKE '%Elmer%' OR full_name ILIKE '%Alfonso%'
            ORDER BY resident_id ASC;
        `);

        if (res.rows.length > 0) {
            console.log(`🎯 Found ${res.rows.length} matching record(s):`);
            res.rows.forEach((r, idx) => {
                console.log(`\n${idx + 1}. [${r.resident_id}] ${r.full_name}`);
                console.log(`   Age: ${r.age} | Sector: ${r.sector}`);
                console.log(`   Address: ${r.complete_address}`);
                console.log(`   Emergency / Metadata: ${r.emergency_contact}`);
            });
        } else {
            console.log("❌ No records found matching 'Elmer' or 'Alfonso'.");
        }

        process.exit(0);
    } catch (err) {
        console.error("❌ Search failed:", err);
        process.exit(1);
    }
}

findElmer();