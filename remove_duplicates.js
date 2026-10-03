const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function removeDuplicates() {
    try {
        console.log("🔍 Scanning for duplicate resident records...");

        // Deletes duplicate rows where the full_name matches, keeping the earliest resident_id
        const deleteQuery = `
            DELETE FROM residents a
            USING residents b
            WHERE a.resident_id > b.resident_id
              AND LOWER(TRIM(a.full_name)) = LOWER(TRIM(b.full_name))
            RETURNING a.resident_id, a.full_name;
        `;

        const res = await pool.query(deleteQuery);

        if (res.rowCount > 0) {
            console.log(`\n🧹 Removed ${res.rowCount} duplicate record(s):`);
            res.rows.forEach((r, idx) => {
                console.log(`   ${idx + 1}. Deleted ID: ${r.resident_id} | Name: ${r.full_name}`);
            });
        } else {
            console.log("✅ No duplicate resident records found.");
        }

        // Output current total record count
        const countRes = await pool.query("SELECT COUNT(*) FROM residents;");
        console.log(`\n📊 Total unique residents in database: ${countRes.rows[0].count}`);

        process.exit(0);
    } catch (err) {
        console.error("❌ Failed to remove duplicates:", err);
        process.exit(1);
    }
}

removeDuplicates();