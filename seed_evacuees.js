const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const DEFAULT_SVG = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2394a3b8'><path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm0 14c-2.03 0-4.43-.82-6.14-2.88C7.55 15.8 9.68 15 12 15s4.45.8 6.14 2.12C16.43 19.18 14.03 20 12 20z'/></svg>";

// Extracted Master Evacuee List
const evacuees = [
    // Lindayen Family
    { name: "Lindayen, Airelyn", age: 38, address: "Blk 41 Lot 5/6 Diligence St., Brgy. San Bartolome, Quezon City" },
    { name: "Lindayen, Lloyd", age: 42, address: "Blk 41 Lot 5/6 Diligence St., Brgy. San Bartolome, Quezon City" },
    { name: "Lindayen, Ashanee", age: 13, address: "Blk 41 Lot 5/6 Diligence St., Brgy. San Bartolome, Quezon City" },
    { name: "Lindayen, Lowell", age: 6, address: "Blk 41 Lot 5/6 Diligence St., Brgy. San Bartolome, Quezon City" },
    { name: "Lindayen, Lance", age: 5, address: "Blk 41 Lot 5/6 Diligence St., Brgy. San Bartolome, Quezon City" },
    { name: "Lindayen, Alijah Mae", age: 10, address: "Blk 41 Lot 5/6 Diligence St., Brgy. San Bartolome, Quezon City" },

    // Mondejar
    { name: "Mondejar, Consuelo", age: 65, address: "Brgy. San Bartolome, Quezon City" },

    // Corpuz Family
    { name: "Corpuz, Mary Jane", age: 35, address: "Blk 48 Lot 5 Justice St., Brgy. San Bartolome, Quezon City" },
    { name: "Corpuz, Eugene", age: 10, address: "Blk 48 Lot 5 Justice St., Brgy. San Bartolome, Quezon City" },
    { name: "Corpuz, Elmer", age: 8, address: "Blk 48 Lot 5 Justice St., Brgy. San Bartolome, Quezon City" },
    { name: "Corpuz, Hazel", age: 6, address: "Blk 48 Lot 5 Justice St., Brgy. San Bartolome, Quezon City" },
    { name: "Corpuz, Genoveya", age: 59, address: "Blk 48 Lot 5 Justice St., Brgy. San Bartolome, Quezon City" },
    { name: "Corpuz, Gonny", age: 35, address: "Blk 48 Lot 5 Justice St., Brgy. San Bartolome, Quezon City" },

    // Bonifacio Family
    { name: "Bonifacio, Lengie Lee", age: 45, address: "Blk 42 Lot 6 Kindness St., Brgy. San Bartolome, Quezon City" },
    { name: "Bonifacio, Sheena Len", age: 17, address: "Blk 42 Lot 6 Kindness St., Brgy. San Bartolome, Quezon City" },
    { name: "Camarin, Emmie Rose", age: 23, address: "Blk 42 Lot 6 Kindness St., Brgy. San Bartolome, Quezon City" },

    // Asis & Ausa Family
    { name: "Ausa, EJ", age: 22, address: "Blk 42 Lot 6 Kindness St., Brgy. San Bartolome, Quezon City" },
    { name: "Asis, Renalyn", age: 47, address: "Blk 42 Lot 6 Kindness St., Brgy. San Bartolome, Quezon City" },
    { name: "Asis, Blezy Faith", age: 13, address: "Blk 42 Lot 6 Kindness St., Brgy. San Bartolome, Quezon City" },

    // Antoc Family
    { name: "Antoc, Idilyn Marie", age: 24, address: "Blk 42 Lot 6 Kindness St., Brgy. San Bartolome, Quezon City" },
    { name: "Antoc, Fredo", age: 44, address: "Blk 42 Lot 6 Kindness St., Brgy. San Bartolome, Quezon City" },
    { name: "Antoc, James Ethan", age: 4, address: "Blk 42 Lot 6 Kindness St., Brgy. San Bartolome, Quezon City" },
    { name: "Antoc, Angela Nicole", age: 3, address: "Blk 42 Lot 6 Kindness St., Brgy. San Bartolome, Quezon City" },

    // Amigo Family
    { name: "Amigo, Catalina", age: 75, address: "Brgy. San Bartolome, Quezon City" },
    { name: "Amigo, Avelino", age: 72, address: "Brgy. San Bartolome, Quezon City" },
    { name: "Amigo, Randy", age: 38, address: "Brgy. San Bartolome, Quezon City", isPwd: true }, // Blind

    // Gomez Family
    { name: "Gomez, Catherine", age: 49, address: "Brgy. San Bartolome, Quezon City" },
    { name: "Gomez, Ira Marie", age: 14, address: "Brgy. San Bartolome, Quezon City" },
    { name: "Gomez, Mark Jayson", age: 22, address: "Brgy. San Bartolome, Quezon City" },
    { name: "Gomez, Jake", age: 13, address: "Brgy. San Bartolome, Quezon City" },

    // Recones Family
    { name: "Recones, Emely", age: 44, address: "Brgy. San Bartolome, Quezon City" },
    { name: "Recones, Jeshyra", age: 13, address: "Brgy. San Bartolome, Quezon City" },
    { name: "Recones, Jelrie", age: 8, address: "Brgy. San Bartolome, Quezon City" },

    // Velado Family
    { name: "Velado, Jonalth", age: 40, address: "Brgy. San Bartolome, Quezon City" },
    { name: "Velado, Janien Jr.", age: 19, address: "Brgy. San Bartolome, Quezon City" },

    // Reario Family
    { name: "Reario, Ferdinand", age: 39, address: "Blk 42 Lot 6 Kindness St., Brgy. San Bartolome, Quezon City" },
    { name: "Reario, Michaell Kate", age: 25, address: "Blk 42 Lot 6 Kindness St., Brgy. San Bartolome, Quezon City" },
    { name: "Reario, Dean Zachary", age: 7, address: "Blk 42 Lot 6 Kindness St., Brgy. San Bartolome, Quezon City" },
    { name: "Reario, Katelyn Joy", age: 3, address: "Blk 42 Lot 6 Kindness St., Brgy. San Bartolome, Quezon City" },

    // Individual Entries
    { name: "Camarin, Remilita", age: 73, address: "Brgy. San Bartolome, Quezon City" },
    { name: "Atienza, Marichu", age: 64, address: "B4 L8 Kindness St., Brgy. San Bartolome, Quezon City" },
    { name: "Garcines, Briana", age: 11, address: "B4 L8 Kindness St., Brgy. San Bartolome, Quezon City" },
    { name: "Centeno, Gemmarie", age: 33, address: "Brgy. San Bartolome, Quezon City" },
    { name: "Obaob, Mark John Rey", age: 10, address: "Brgy. San Bartolome, Quezon City" },
    { name: "Basa, Junerex", age: 3, address: "Brgy. San Bartolome, Quezon City" }
];

async function seed() {
    try {
        console.log("🚀 Seeding evacuee records into Supabase...");
        await pool.query("CREATE SEQUENCE IF NOT EXISTS resident_id_seq START WITH 1");

        let count = 0;
        for (const person of evacuees) {
            // Smart Sector Determination
            let sector = 'Flood Victim (Pending Verification)';
            if (person.age >= 60) {
                sector = 'Senior Citizen / Flood Victim';
            } else if (person.isPwd) {
                sector = 'PWD / Flood Victim';
            }

            // Generate Sequential Unique ID
            const seqRes = await pool.query("SELECT nextval('resident_id_seq')");
            const nextSeqNum = String(seqRes.rows[0].nextval).padStart(4, '0');
            const generatedId = `BRGY-2026-${nextSeqNum}`;

            const queryText = `
                INSERT INTO residents (resident_id, wristband_id, full_name, age, sector, complete_address, emergency_contact, profile_pic)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`;

            await pool.query(queryText, [
                generatedId,  // resident_id
                generatedId,  // wristband_id default to ID
                person.name,
                person.age,
                sector,
                person.address,
                'Evacuation Records - N/A',
                DEFAULT_SVG
            ]);

            count++;
            console.log(`[${count}/${evacuees.length}] Encoded: ${generatedId} | ${person.name} (${sector})`);
        }

        console.log(`\n✅ SUCCESSFULLY SEEDED ${count} EVACUEES INTO SUPABASE!`);
        process.exit(0);

    } catch (err) {
        console.error("❌ Seeding failed:", err);
        process.exit(1);
    }
}

seed();