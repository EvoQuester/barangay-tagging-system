const { Pool } = require('pg');
const XLSX = require('xlsx');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.process ? process.env.DATABASE_URL : '',
    ssl: { rejectUnauthorized: false }
});

const DEFAULT_SVG = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2394a3b8'><path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm0 14c-2.03 0-4.43-.82-6.14-2.88C7.55 15.8 9.68 15 12 15s4.45.8 6.14 2.12C16.43 19.18 14.03 20 12 20z'/></svg>";

function parseAge(birthdateStr) {
    if (!birthdateStr) return 35;
    const str = String(birthdateStr).toUpperCase();
    const match = str.match(/\b(19\d{2}|20[0-2]\d)\b/);
    if (match) {
        let year = parseInt(match[1]);
        if (year < 1900) year = 1975;
        return Math.max(0, Math.min(120, 2026 - year));
    }
    return 35;
}

function formatContact(num) {
    if (!num) return 'N/A';
    let s = String(num).replace(/\D/g, '');
    if (s.length === 10 && s.startsWith('9')) return '0' + s;
    if (s.length === 11 && s.startsWith('09')) return s;
    return s || 'N/A';
}

async function runImport() {
    try {
        console.log("📖 Reading FLOOD-AREA.xlsx...");
        const workbook = XLSX.readFile('FLOOD-AREA.xlsx');
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet);

        console.log(`⚡ Processing ${rows.length} records with smart fallback logic...`);

        await pool.query("CREATE SEQUENCE IF NOT EXISTS resident_id_seq START WITH 1");

        let count = 0;
        for (const row of rows) {
            const lastName = (row['LAST NAME '] || row['LAST NAME'] || '').trim();
            const firstName = (row['FIRST NAME '] || row['FIRST NAME'] || '').trim();
            const middleName = (row['MIDDLE NAME '] || row['MIDDLE NAME'] || '').trim();
            const qcId = String(row['QC ID '] || row['QC ID'] || '').trim().toUpperCase();
            const categoryRaw = String(row['CATEGORY '] || row['CATEGORY'] || '').trim().toUpperCase();

            const fullName = middleName && middleName !== 'NAN' 
                ? `${lastName}, ${firstName} ${middleName}` 
                : `${lastName}, ${firstName}`;

            const age = parseAge(row['BIRTHDATE '] || row['BIRTHDATE']);
            const contact = formatContact(row[' CONTACT NUMBER'] || row['CONTACT NUMBER']);
            const spouse = (row['SPOUSE NAME '] || row['SPOUSE NAME'] || '').trim();

            let sector = 'Flood Victim (Pending Verification)';
            if (age >= 60) {
                sector = 'Senior Citizen / Flood Victim';
            } else if (qcId.includes('PWD') || categoryRaw.includes('PWD')) {
                sector = 'PWD / Flood Victim';
            }

            let address = (row['ADDRESS'] || 'Brgy. San Bartolome, Quezon City').trim();
            if (!address.toUpperCase().includes('SAN BARTOLOME')) {
                address += ', Brgy. San Bartolome, Quezon City';
            }

            let emergency = 'N/A';
            if (spouse && spouse.toUpperCase() !== 'NAN' && spouse.toUpperCase() !== 'WIDOW') {
                emergency = `${spouse} - Spouse - ${contact}`;
            } else if (contact !== 'N/A') {
                emergency = `Contact - ${contact}`;
            }

            const seqRes = await pool.query("SELECT nextval('resident_id_seq')");
            const nextSeqNum = String(seqRes.rows[0].nextval).padStart(4, '0');
            const generatedId = `BRGY-2026-${nextSeqNum}`;

            const queryText = `
                INSERT INTO residents (resident_id, wristband_id, full_name, age, sector, complete_address, emergency_contact, profile_pic)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`;

            await pool.query(queryText, [
                generatedId,
                generatedId,
                fullName,
                age,
                sector,
                address,
                emergency,
                DEFAULT_SVG
            ]);

            count++;
        }

        console.log(`\n✅ SUCCESS! ${count} flood victim records imported into Supabase.`);
        process.exit(0);

    } catch (err) {
        console.error("❌ Import failed:", err);
        process.exit(1);
    }
}

runImport();