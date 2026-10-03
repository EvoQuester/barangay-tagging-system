const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function undoAndSearch() {
    try {
        console.log("🧹 Rolling back newly inserted entries from fuzzy run...");

        // 1. Delete the 4 new IDs created in the previous run
        const targetIds = [
            'BRGY-2026-0338',
            'BRGY-2026-0339',
            'BRGY-2026-0340',
            'BRGY-2026-0341'
        ];

        const delRes = await pool.query(
            "DELETE FROM residents WHERE resident_id = ANY($1::text[]) RETURNING resident_id, full_name;",
            [targetIds]
        );

        console.log(`✅ Deleted ${delRes.rowCount} record(s):`);
        delRes.rows.forEach(r => console.log(`   - Removed: ${r.resident_id} (${r.full_name})`));

        // 2. Synchronize sequence back to highest remaining ID
        const maxIdRes = await pool.query(`
            SELECT COALESCE(MAX(CAST(SUBSTRING(resident_id FROM 11) AS INTEGER)), 0) as max_id 
            FROM residents 
            WHERE resident_id LIKE 'BRGY-2026-%';
        `);
        const newMax = maxIdRes.rows[0].max_id;
        await pool.query(`SELECT setval('resident_id_seq', ${newMax});`);

        const totalRes = await pool.query("SELECT COUNT(*) FROM residents;");
        console.log(`\n📊 Database count restored to: ${totalRes.rows[0].count} records.`);

        // 3. Search and display all existing "Asis" or "Blezy" records in Supabase
        console.log("\n🔍 Locating existing 'Asis' records in your database...");
        const searchRes = await pool.query(`
            SELECT resident_id, full_name, age, sector, complete_address, emergency_contact 
            FROM residents 
            WHERE full_name ILIKE '%Asis%' OR full_name ILIKE '%Ble%'
            ORDER BY resident_id ASC;
        `);

        if (searchRes.rows.length > 0) {
            console.log(`🎯 Found ${searchRes.rows.length} existing record(s):`);
            searchRes.rows.forEach((r, i) => {
                console.log(`   ${i + 1}. [${r.resident_id}] ${r.full_name} | Age: ${r.age} | Sector: ${r.sector}`);
                console.log(`      Address: ${r.complete_address}`);
                console.log(`      Emergency: ${r.emergency_contact}\n`);
            });
        } else {
            console.log("⚠️ No record found matching 'Asis' or 'Ble'.");
        }

        process.exit(0);
    } catch (err) {
        console.error("❌ Undo failed:", err);
        process.exit(1);
    }
}

undoAndSearch();