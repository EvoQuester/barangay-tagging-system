const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const DEFAULT_SVG = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2394a3b8'><path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm0 14c-2.03 0-4.43-.82-6.14-2.88C7.55 15.8 9.68 15 12 15s4.45.8 6.14 2.12C16.43 19.18 14.03 20 12 20z'/></svg>";

const newEvacuees = [
    { name: "Caballero, Jillian", age: 11 },
    { name: "Caballero, Geo Mark", age: 7 },
    { name: "Caballero, Trining", age: 37 },
    { name: "Dula, Angel", age: 11 },
    { name: "Dula, Lalaine", age: 45 },
    { name: "Dula, Bea", age: 19 },
    { name: "Dula De Guzman, Nicole", age: 3 },
    { name: "Sinadhan, Marites", age: 37 },
    { name: "Adizas, Glesly May", age: 12 },
    { name: "Adizas, Glenn Miguel", age: 9 }
];

async function insertNewEvacuees() {
    try {
        console.log("🚀 Inserting 10 new evacuees into Supabase...");

        // Ensure the sequence exists and syncs with current highest ID
        await pool.query("CREATE SEQUENCE IF NOT EXISTS resident_id_seq START WITH 1;");
        
        const maxIdRes = await pool.query(`
            SELECT COALESCE(MAX(CAST(SUBSTRING(resident_id FROM 11) AS INTEGER)), 0) as max_id 
            FROM residents 
            WHERE resident_id LIKE 'BRGY-2026-%';
        `);
        const currentMax = maxIdRes.rows[0].max_id;
        await pool.query(`SELECT setval('resident_id_seq', ${currentMax});`);

        let insertedCount = 0;

        for (const person of newEvacuees) {
            // Check if resident already exists by name
            const existsCheck = await pool.query(
                "SELECT resident_id FROM residents WHERE LOWER(TRIM(full_name)) = LOWER(TRIM($1));",
                [person.name]
            );

            if (existsCheck.rows.length > 0) {
                console.log(`⚠️ Skipped duplicate: ${person.name} (Already exists as ${existsCheck.rows[0].resident_id})`);
                continue;
            }

            // Assign sector based on age
            let sector = 'Flood Victim (Pending Verification)';
            if (person.age <= 18) {
                sector = 'Youth / Flood Victim';
            } else if (person.age >= 60) {
                sector = 'Senior Citizen / Flood Victim';
            }

            // Generate sequential unique ID
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
        console.log(`\n🎉 DONE! Total database count is now: ${totalRes.rows[0].count} residents.`);
        process.exit(0);

    } catch (err) {
        console.error("❌ Insertion failed:", err);
        process.exit(1);
    }
}

insertNewEvacuees();