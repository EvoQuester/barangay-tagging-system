const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const DEFAULT_SVG = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2394a3b8'><path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm0 14c-2.03 0-4.43-.82-6.14-2.88C7.55 15.8 9.68 15 12 15s4.45.8 6.14 2.12C16.43 19.18 14.03 20 12 20z'/></svg>";

const intakeRecords = [
    // Family 1
    { family: 1, name: "Dula, Lalaine", sex: "F", age: 45, bday: "1981-04-10", address: "Sacre California, Brgy. San Bartolome, Quezon City" },
    { family: 1, name: "Dula, Angel", sex: "F", age: 11, bday: "2014-10-04", address: "Sacre California, Brgy. San Bartolome, Quezon City" },

    // Family 2
    { family: 2, name: "Dula, Bea", sex: "F", age: 19, bday: "2007-04-21", address: "Sacre California, Brgy. San Bartolome, Quezon City" },
    { family: 2, name: "Dula De Guzman, Nicole", sex: "F", age: 3, bday: "2023-08-02", address: "Sacre California, Brgy. San Bartolome, Quezon City" },

    // Family 3
    { family: 3, name: "Centeno, Gemmarie", sex: "F", age: 33, bday: "1992-12-21", address: "Sambahayan California, Brgy. San Bartolome, Quezon City" },
    { family: 3, name: "Centeno, Mark John Rey", sex: "M", age: 10, bday: "2014-01-14", address: "Sambahayan California, Brgy. San Bartolome, Quezon City" },
    { family: 3, name: "Centeno, Jhun Rex", sex: "M", age: 3, bday: "2022-09-20", address: "Sambahayan California, Brgy. San Bartolome, Quezon City" },
    { family: 3, name: "Agoncillo, Juner", sex: "M", age: 27, bday: "1999-04-28", address: "Sambahayan California, Brgy. San Bartolome, Quezon City" },

    // Family 4
    { family: 4, name: "Caballero, Trining", sex: "F", age: 37, bday: "1988-12-18", address: "Sacre California, Brgy. San Bartolome, Quezon City" },
    { family: 4, name: "Caballero, Gian Marc", sex: "M", age: 14, bday: "2011-10-28", address: "Sacre California, Brgy. San Bartolome, Quezon City" },
    { family: 4, name: "Caballero, Ad Riah", sex: "M", age: 18, bday: "2008-05-20", address: "Sacre California, Brgy. San Bartolome, Quezon City" },
    { family: 4, name: "Caballero, Jillian", sex: "F", age: 11, bday: "2014-10-21", address: "Sacre California, Brgy. San Bartolome, Quezon City" },
    { family: 4, name: "Caballero, Geo Mark", sex: "M", age: 7, bday: "2018-09-01", address: "Sacre California, Brgy. San Bartolome, Quezon City" },

    // Family 5
    { family: 5, name: "Sinadhan, Marites", sex: "F", age: 37, bday: "1988-11-10", address: "Sacre California, Brgy. San Bartolome, Quezon City" },
    { family: 5, name: "Sinadhan, Jo Mark", sex: "M", age: 43, bday: "1982-09-04", address: "Sacre California, Brgy. San Bartolome, Quezon City" },
    { family: 5, name: "Sinadhan, Princess", sex: "F", age: 17, bday: "2009-09-12", address: "Sacre California, Brgy. San Bartolome, Quezon City" },
    { family: 5, name: "Sinadhan, Leonora May B.", sex: "F", age: 15, bday: "2010-01-13", address: "Sacre California, Brgy. San Bartolome, Quezon City" },

    // Family 6
    { family: 6, name: "Adizas, Glenda", sex: "F", age: 33, bday: "1992-02-07", address: "Sacre California, Brgy. San Bartolome, Quezon City" },
    { family: 6, name: "Adizas, Glesly May", sex: "F", age: 12, bday: "2014-05-14", address: "Sacre California, Brgy. San Bartolome, Quezon City" },
    { family: 6, name: "Adizas, Glenn Miguel", sex: "M", age: 9, bday: "2016-11-26", address: "Sacre California, Brgy. San Bartolome, Quezon City" },

    // Family 7
    { family: 7, name: "Fabros, June", sex: "M", age: 60, bday: "1964-07-03", address: "Sacre California, Brgy. San Bartolome, Quezon City" },

    // Family 8
    { family: 8, name: "Brizo, Luisa", sex: "F", age: 62, bday: "1964-06-21", address: "Goodwill Manukan, Brgy. San Bartolome, Quezon City" },
    { family: 8, name: "Brizo, Sharmine", sex: "F", age: 17, bday: "2009-03-27", address: "Goodwill Manukan, Brgy. San Bartolome, Quezon City" }
];

async function syncPaperIntake() {
    try {
        console.log("🔍 Synchronizing exact intake sheet records into Supabase...");

        // Ensure database sequence sync
        await pool.query("CREATE SEQUENCE IF NOT EXISTS resident_id_seq START WITH 1;");
        const maxIdRes = await pool.query(`
            SELECT COALESCE(MAX(CAST(SUBSTRING(resident_id FROM 11) AS INTEGER)), 0) as max_id 
            FROM residents 
            WHERE resident_id LIKE 'BRGY-2026-%';
        `);
        const currentMax = maxIdRes.rows[0].max_id;
        await pool.query(`SELECT setval('resident_id_seq', ${currentMax});`);

        let updatedCount = 0;
        let insertedCount = 0;

        for (const person of intakeRecords) {
            let sector = 'Flood Victim (Pending Verification)';
            if (person.age >= 60) {
                sector = 'Senior Citizen / Flood Victim';
            } else if (person.age <= 18) {
                sector = 'Youth / Flood Victim';
            }

            const emergencyMeta = `Family #${person.family} | DOB: ${person.bday} | Intake: 08/19/2026`;

            // Split name into Last Name and First Name root for dual-term matching
            const nameParts = person.name.split(',').map(s => s.trim());
            const lastName = nameParts[0];
            const firstNameRoot = nameParts[1] ? nameParts[1].split(' ')[0] : ''; // e.g., 'Jillian', 'Angel', 'Trining'

            const checkRes = await pool.query(`
                SELECT * FROM residents 
                WHERE full_name ILIKE $1 AND full_name ILIKE $2
                ORDER BY resident_id ASC LIMIT 1;
            `, [`%${lastName}%`, `%${firstNameRoot}%`]);

            if (checkRes.rows.length > 0) {
                // Existing resident found -> Update with verified metadata
                const existing = checkRes.rows[0];
                await pool.query(`
                    UPDATE residents 
                    SET age = $1, sector = $2, complete_address = $3, emergency_contact = $4
                    WHERE resident_id = $5;
                `, [person.age, sector, person.address, emergencyMeta, existing.resident_id]);

                updatedCount++;
                console.log(`📝 [Updated] ${existing.resident_id} | ${existing.full_name} -> Age: ${person.age}, Fam #${person.family}`);
            } else {
                // Not in database -> Generate next ID and insert
                const seqRes = await pool.query("SELECT nextval('resident_id_seq');");
                const nextSeqNum = String(seqRes.rows[0].nextval).padStart(4, '0');
                const generatedId = `BRGY-2026-${nextSeqNum}`;

                await pool.query(`
                    INSERT INTO residents (
                        resident_id, wristband_id, full_name, age, sector, complete_address, emergency_contact, profile_pic
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
                `, [generatedId, generatedId, person.name, person.age, sector, person.address, emergencyMeta, DEFAULT_SVG]);

                insertedCount++;
                console.log(`➕ [Inserted New] ${generatedId} | ${person.name} (${person.age} y/o, Fam #${person.family})`);
            }
        }

        const totalRes = await pool.query("SELECT COUNT(*) FROM residents;");
        console.log(`\n🎉 SYNC COMPLETED SUCCESSFULLY!`);
        console.log(`📊 Updated Existing: ${updatedCount} | Newly Added: ${insertedCount} | Total Database Records: ${totalRes.rows[0].count}`);

        process.exit(0);
    } catch (err) {
        console.error("❌ Synchronization failed:", err);
        process.exit(1);
    }
}

syncPaperIntake();