const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const DEFAULT_SVG = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2394a3b8'><path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm0 14c-2.03 0-4.43-.82-6.14-2.88C7.55 15.8 9.68 15 12 15s4.45.8 6.14 2.12C16.43 19.18 14.03 20 12 20z'/></svg>";

const batch2Evacuees = [
    { name: "Sinadhan, Princess", age: 17 },
    { name: "Sinadhan, Leonora May B.", age: 15 },
    { name: "Centeno, Mark John Rey", age: 10 },
    { name: "Fabros, June", age: 60 },
    { name: "Centeno, Jhun Rex", age: 3 },
    { name: "Brizo, Luisa", age: 62 },
    { name: "Brizo, Sharmine", age: 17 },
    { name: "Centeno, Gemmarie", age: 33 },
    { name: "Agoncillo, Juner", age: 27 }
];

async function insertBatch2() {
    try {
        console.log("🚀 Inserting 9 new evacuees into Supabase...");

        // Ensure sequence is created and synchronized with the latest resident_id
        await pool.query("CREATE SEQUENCE IF NOT EXISTS resident_id_seq START WITH 1;");
        
        const maxIdRes = await pool.query(`
            SELECT COALESCE(MAX(CAST(SUBSTRING(resident_id FROM 11) AS INTEGER)), 0) as max_id 
            FROM residents 
            WHERE resident_id LIKE 'BRGY-2026-%';
        `);
        const currentMax = maxIdRes.rows[0].max_id;
        await pool.query(`SELECT setval('resident_id_seq', ${currentMax});`);

        let insertedCount = 0;

        for (const person of batch2Evacuees) {
            // Check for existing records to prevent duplicates
            const existsCheck = await pool.query(
                "SELECT resident_id FROM residents WHERE LOWER(TRIM(full_name)) = LOWER(TRIM($1));",
                [person.name]
            );

            if (existsCheck.rows.length > 0) {
                console.log(`⚠️ Skipped duplicate: ${person.name} (Already registered as ${existsCheck.rows[0].resident_id})`);
                continue;
            }

            // Categorize sector based on age
            let sector = 'Flood Victim (Pending Verification)';
            if (person.age >= 60) {
                sector = 'Senior Citizen / Flood Victim';
            } else if (person.age <= 18) {
                sector = 'Youth / Flood Victim';
            }

            // Generate sequential ID
            const seqRes = await pool.query("SELECT nextval('resident_id_seq');");
            const nextSeqNum = String(seqRes.rows[0].nextval).padStart(4, '0');
            const generatedId = `BRGY-2026-${nextSeqNum}`;

            const insertQuery = `
                INSERT INTO residents (
                    resident_id, wristband_id, full_name, age, sector, complete_address, emergency_contact, profile_pic
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING resident_id, full_name;
            `;

            const res = await pool.query(insertQuery, [
                generatedId,
                generatedId,
                person.name,
                person.age,
                sector,
                'Brgy. San Bartolome, Quezon City',
                'Evacuation Intake',
                DEFAULT_SVG
            ]);

            insertedCount++;
            console.log(`✅ [${insertedCount}] Added: ${res.rows[0].resident_id} | ${res.rows[0].full_name} (${person.age} y/o)`);
        }

        const totalRes = await pool.query("SELECT COUNT(*) FROM residents;");
        console.log(`\n🎉 BATCH COMPLETE! Total registered residents: ${totalRes.rows[0].count}`);
        process.exit(0);

    } catch (err) {
        console.error("❌ Batch insertion failed:", err);
        process.exit(1);
    }
}

insertBatch2();