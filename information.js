const { Pool } = require('pg');
const XLSX = require('xlsx');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function exportToExcel() {
    try {
        console.log("📥 Fetching resident records from Supabase...");

        const query = `
            SELECT 
                resident_id AS "System ID",
                wristband_id AS "Wristband / Token ID",
                full_name AS "Full Name",
                age AS "Age",
                sector AS "Sector Classification",
                complete_address AS "Complete Address",
                emergency_contact AS "Emergency Contact / Intake Metadata",
                registered_at AS "Date Registered"
            FROM residents
            ORDER BY resident_id ASC;
        `;

        const res = await pool.query(query);

        if (res.rows.length === 0) {
            console.log("⚠️ No records found in the database to export.");
            process.exit(0);
        }

        console.log(`📊 Retrieved ${res.rows.length} records. Generating Excel workbook...`);

        // Convert query rows to an Excel worksheet
        const worksheet = XLSX.utils.json_to_sheet(res.rows);

        // Auto-fit column widths
        const columnWidths = [
            { wch: 18 }, // System ID
            { wch: 22 }, // Wristband / Token ID
            { wch: 30 }, // Full Name
            { wch: 8 },  // Age
            { wch: 35 }, // Sector
            { wch: 45 }, // Complete Address
            { wch: 40 }, // Emergency Contact
            { wch: 22 }  // Date Registered
        ];
        worksheet['!cols'] = columnWidths;

        // Create workbook and append sheet
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Master Evacuee List");

        const outputPath = path.join(__dirname, 'Barangay_San_Bartolome_Masterlist.xlsx');
        XLSX.writeFile(workbook, outputPath);

        console.log(`\n🎉 SUCCESS! Excel file created at:`);
        console.log(`👉 ${outputPath}`);

        process.exit(0);
    } catch (err) {
        console.error("❌ Export failed:", err);
        process.exit(1);
    }
}

exportToExcel();