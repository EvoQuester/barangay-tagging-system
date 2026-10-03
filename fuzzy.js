const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const DEFAULT_SVG = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2394a3b8'><path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm0 14c-2.03 0-4.43-.82-6.14-2.88C7.55 15.8 9.68 15 12 15s4.45.8 6.14 2.12C16.43 19.18 14.03 20 12 20z'/></svg>";

const notebookEntries = [
    {
        rawName: "Bleszhy Faith C. Asis",
        formattedName: "Asis, Bleszhy Faith C.",
        age: 13,
        address: "Blk 42 Lot 10 Kindness St., Goodwill, Brgy. San Bartolome, Quezon City",
        emergency: "Renaly C. Asis - 09628772399"
    },
    {
        rawName: "Morad M. Panagas",
        formattedName: "Panagas, Morad M.",
        age: 17,
        address: "Blk 42 RS Goodwill Manukan, Brgy. San Bartolome, Quezon City",
        emergency: "Raida Panagas - 09533448680"
    },
    {
        rawName: "Elzlle Marie Corpuz",
        formattedName: "Corpuz, Elzlle Marie",
        age: 5,
        address: "Blk 48 Lot 20 Goodwill Homes Manukan, Brgy. San Bartolome, Quezon City",
        emergency: "Evacuation Intake - N/A"
    },
    {
        rawName: "Elmer C. Alfonso",
        formattedName: "Alfonso, Elmer C.",
        age: 8,
        address: "Blk 48 Lot 28 Goodwill Manukan, Brgy. San Bartolome, Quezon City",
        emergency: "Genova Corpuz (Lola) - 093031245"
    },
    {
        rawName: "Eugine Corpuz",
        formattedName: "Corpuz, Eugine",
        age: 10,
        address: "Blk 48 Lot 28 Goodwill Manukan, Brgy. San Bartolome, Quezon City",
        emergency: "Genoveva Corpuz (Lola) - 093031245"
    }
];

function levenshtein(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    return matrix[b.length][a.length];
}

function wordSimilarity(w1, w2) {
    if (!w1 || !w2) return 0;
    if (w1 === w2) return 1.0;
    const dist = levenshtein(w1, w2);
    const maxLen = Math.max(w1.length, w2.length);

    // Allow up to 2-character typos for names >= 5 chars (e.g. bleszhy vs blezy)
    if (dist <= 2 && maxLen >= 5) {
        return Math.max(0.80, 1 - dist / maxLen);
    }
    return 1 - dist / maxLen;
}

function extractTokens(str) {
    return (str || '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, ' ')
        .split(/\s+/)
        .filter(t => t.length > 0);
}

function calculateRobustScore(entry, dbResident) {
    const tTokens = extractTokens(entry.rawName);
    const dbTokens = extractTokens(dbResident.full_name);

    if (tTokens.length === 0 || dbTokens.length === 0) return 0;

    // 1. Surname verification: At least one substantial token must match strongly
    let surnameMatched = false;
    for (const t of tTokens) {
        for (const db of dbTokens) {
            if (t.length >= 3 && wordSimilarity(t, db) >= 0.85) {
                surnameMatched = true;
                break;
            }
        }
        if (surnameMatched) break;
    }

    if (!surnameMatched) return 0;

    // 2. Token overlap score
    let matchedWeights = 0;
    let totalWeight = 0;

    for (const tWord of tTokens) {
        const weight = tWord.length === 1 ? 0.5 : (tWord.length >= 4 ? 2.0 : 1.0);
        totalWeight += weight;

        let bestWordScore = 0;
        for (const dbWord of dbTokens) {
            const score = wordSimilarity(tWord, dbWord);
            if (score > bestWordScore) bestWordScore = score;
        }

        if (bestWordScore >= 0.70) {
            matchedWeights += bestWordScore * weight;
        }
    }

    let score = totalWeight > 0 ? (matchedWeights / totalWeight) : 0;

    // 3. Metadata boost: Same age (+5%) or exact address keyword match (+5%)
    if (dbResident.age === entry.age) score += 0.05;
    if (dbResident.emergency_contact && dbResident.emergency_contact.toLowerCase().includes(tTokens[0])) {
        score += 0.05;
    }

    return Math.min(1.0, score);
}

async function runFuzzySync() {
    try {
        console.log("🔍 Fetching existing resident records from Supabase...");
        const dbResidentsRes = await pool.query("SELECT * FROM residents ORDER BY resident_id ASC;");
        const dbResidents = dbResidentsRes.rows;
        console.log(`📦 Loaded ${dbResidents.length} database records.\n`);

        await pool.query("CREATE SEQUENCE IF NOT EXISTS resident_id_seq START WITH 1;");
        const maxIdRes = await pool.query(`
            SELECT COALESCE(MAX(CAST(SUBSTRING(resident_id FROM 11) AS INTEGER)), 0) as max_id 
            FROM residents 
            WHERE resident_id LIKE 'BRGY-2026-%';
        `);
        await pool.query(`SELECT setval('resident_id_seq', ${maxIdRes.rows[0].max_id});`);

        for (const entry of notebookEntries) {
            let bestMatch = null;
            let highestScore = 0;

            for (const resident of dbResidents) {
                const score = calculateRobustScore(entry, resident);
                if (score > highestScore) {
                    highestScore = score;
                    bestMatch = resident;
                }
            }

            const matchPercentage = (highestScore * 100).toFixed(1);

            let sector = 'Flood Victim (Pending Verification)';
            if (entry.age <= 18) sector = 'Youth / Flood Victim';
            else if (entry.age >= 60) sector = 'Senior Citizen / Flood Victim';

            if (highestScore >= 0.80 && bestMatch) {
                console.log(`🎯 [MATCHED ${matchPercentage}%] "${entry.rawName}" -> ${bestMatch.resident_id} (${bestMatch.full_name})`);

                await pool.query(`
                    UPDATE residents 
                    SET full_name = $1, age = $2, sector = $3, complete_address = $4, emergency_contact = $5
                    WHERE resident_id = $6;
                `, [entry.formattedName, entry.age, sector, entry.address, entry.emergency, bestMatch.resident_id]);

                console.log(`   📝 Updated information on ${bestMatch.resident_id}\n`);
            } else {
                console.log(`✨ [NEW ENTRY (Best: ${matchPercentage}%)] "${entry.rawName}" -> Adding to database...`);

                const seqRes = await pool.query("SELECT nextval('resident_id_seq');");
                const nextSeqNum = String(seqRes.rows[0].nextval).padStart(4, '0');
                const generatedId = `BRGY-2026-${nextSeqNum}`;

                await pool.query(`
                    INSERT INTO residents (
                        resident_id, wristband_id, full_name, age, sector, complete_address, emergency_contact, profile_pic
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
                `, [generatedId, generatedId, entry.formattedName, entry.age, sector, entry.address, entry.emergency, DEFAULT_SVG]);

                console.log(`   ➕ Inserted: ${generatedId} | ${entry.formattedName}\n`);
            }
        }

        const countRes = await pool.query("SELECT COUNT(*) FROM residents;");
        console.log(`🎉 COMPLETED! Total records in database: ${countRes.rows[0].count}`);
        process.exit(0);

    } catch (err) {
        console.error("❌ Sync failed:", err);
        process.exit(1);
    }
}

runFuzzySync();