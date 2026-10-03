const { Pool } = require('pg');
const AdmZip = require('adm-zip');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Exact sequential list of 27 evacuees matching the order in 2026-EVACUEES.docx
const mappedResidents = [
    "Camarin, Remilita",
    "Mondejar, Consuelo",
    "Lindayen, Ashanee",
    "Bonifacio, Sheena Len",
    "Ausa, EJ",
    "Asis, Renalyn",
    "Asis, Blezy Faith",
    "Reario, Michaell Kate",
    "Reario, Katelyn Joy",
    "Atienza, Marichu",
    "Garcines, Briana",
    "Centeno, Gemmarie",
    "Obaob, Mark John Rey",
    "Basa, Junerex",
    "Antoc, Idilyn Marie",
    "Antoc, Angela Nicole",
    "Antoc, James Ethan",
    "Amigo, Catalina",
    "Amigo, Randy",
    "Gomez, Catherine",
    "Gomez, Ira Marie",
    "Recones, Jeshyra",
    "Recones, Emily",
    "Recones, Jelrie",
    "Gomez, Jake",
    "Bonifacio, Lengie Lee",
    "Lindayen, Alijah Mae"
];

async function extractAndAttachPhotos() {
    try {
        const docxPath = path.join(__dirname, '2026-EVACUEES.docx');
        console.log("📦 Unpacking 2026-EVACUEES.docx image assets...");
        
        const zip = new AdmZip(docxPath);
        const zipEntries = zip.getEntries();

        // Extract and sort all images numerically (image1.jpeg, image2.jpeg, ...)
        const mediaEntries = zipEntries
            .filter(entry => entry.entryName.startsWith('word/media/'))
            .sort((a, b) => {
                const numA = parseInt(a.entryName.match(/\d+/)?.[0] || '0');
                const numB = parseInt(b.entryName.match(/\d+/)?.[0] || '0');
                return numA - numB;
            });

        console.log(`📸 Found ${mediaEntries.length} embedded photos in document.`);

        let updatedCount = 0;
        for (let i = 0; i < Math.min(mediaEntries.length, mappedResidents.length); i++) {
            const residentName = mappedResidents[i];
            const imageEntry = mediaEntries[i];
            
            // Read image buffer and convert to single-quote Base64 String
            const imageBuffer = imageEntry.getData();
            const ext = path.extname(imageEntry.entryName).replace('.', '') || 'jpeg';
            const base64Image = `data:image/${ext};base64,${imageBuffer.toString('base64')}`.replace(/"/g, "'");

            // Match full name in database (case-insensitive substring match)
            const updateQuery = `
                UPDATE residents 
                SET profile_pic = $1 
                WHERE full_name ILIKE $2
                RETURNING resident_id, full_name`;

            const res = await pool.query(updateQuery, [base64Image, `%${residentName.split(',')[0]}%`]);

            if (res.rows.length > 0) {
                updatedCount++;
                console.log(`✅ [${updatedCount}/${mappedResidents.length}] Attached photo to: ${res.rows[0].full_name} (${res.rows[0].resident_id})`);
            } else {
                console.warn(`⚠️ No database match found for: "${residentName}"`);
            }
        }

        console.log(`\n🎉 SUCCESS! ${updatedCount} resident photos imported directly into Supabase!`);
        process.exit(0);

    } catch (err) {
        console.error("❌ Photo extraction failed:", err);
        process.exit(1);
    }
}

extractAndAttachPhotos();