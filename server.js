const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

const OFFLINE_DEFAULT_PIC = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2394a3b8"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm0 14c-2.03 0-4.43-.82-6.14-2.88C7.55 15.8 9.68 15 12 15s4.45.8 6.14 2.12C16.43 19.18 14.03 20 12 20z"/></svg>';

/* ==========================================================================
   ROUTE: REGISTER RESIDENT
   ========================================================================== */
app.post('/api/residents/register', async (req, res) => {
    const { name, age, sector, address, emergency_contact, linked_qr_id, profile_pic } = req.body;
    try {
        const existingId = await pool.query('SELECT wristband_id FROM residents WHERE wristband_id = $1', [linked_qr_id]);
        if (existingId.rows.length > 0) {
            return res.status(400).json({ success: false, message: 'This QR code is already bound to another resident!' });
        }
        const fallbackPic = (profile_pic && profile_pic.trim() !== "undefined") ? profile_pic.trim() : OFFLINE_DEFAULT_PIC;
        
        const seqResult = await pool.query("SELECT nextval('resident_id_seq')");
        const nextSeqNum = String(seqResult.rows[0].nextval).padStart(4, '0');
        const generatedResidentId = `BRGY-2026-${nextSeqNum}`;

        const queryText = `
            INSERT INTO residents (resident_id, wristband_id, full_name, age, sector, complete_address, emergency_contact, profile_pic)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`;
        
        await pool.query(queryText, [generatedResidentId, linked_qr_id, name, parseInt(age), sector, address, emergency_contact, fallbackPic]);
        res.json({ success: true, message: 'Resident registered successfully!', resident_id: generatedResidentId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server enrollment crash.' });
    }
});

/* ==========================================================================
   🧠 THE JESSE HIAN CHAY KING DUAL-ROUTING PROTOCOL (KDRP) CORE SCAN PIPELINE
   ========================================================================== */
app.post('/api/attendance/scan', async (req, res) => {
    const { scanned_id, system_mode } = req.body; 

    try {
        const residentQuery = await pool.query('SELECT * FROM residents WHERE wristband_id = $1 OR resident_id = $2', [scanned_id, scanned_id]);
        if (residentQuery.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'UNREGISTERED QR VALUE' });
        }
        const resident = residentQuery.rows[0];

        // 🟢 BRANCH B: FOOD DISTRIBUTION CONTROL ALGORITHM
        if (system_mode === 'FOOD') {
            // Checks for claims on the database's current server date
            const foodCheck = await pool.query(
                'SELECT * FROM food_distribution_logs WHERE resident_id = $1 AND DATE(claimed_at) = CURRENT_DATE',
                [resident.resident_id]
            );

            if (foodCheck.rows.length > 0) {
                return res.json({
                    success: false,
                    is_food_denied: true,
                    message: 'DUPLICATE RATION CLAIM DETECTED',
                    resident: { name: resident.full_name, id: resident.resident_id }
                });
            }

            // Database generates the exact timestamp natively upon insert
            await pool.query(
                'INSERT INTO food_distribution_logs (resident_id, wristband_id, claimed_at) VALUES ($1, $2, NOW())',
                [resident.resident_id, resident.wristband_id]
            );

            return res.json({
                success: true,
                action: 'FOOD_SERVED',
                resident: {
                    id: resident.resident_id,
                    name: resident.full_name,
                    age: resident.age,
                    sector: resident.sector,
                    address: resident.complete_address,
                    picture: resident.profile_pic || OFFLINE_DEFAULT_PIC
                }
            });
        }

        // 🔵 BRANCH A: REGULAR ATTENDANCE ACCESS ROUTINE (STRICT TOGGLE SEQUENCER)
        const logQuery = await pool.query(
            `SELECT action FROM attendance_logs 
             WHERE resident_id = $1 
             ORDER BY timestamp DESC LIMIT 1`,
            [resident.resident_id]
        );

        let currentAction = 'ENTRY';
        if (logQuery.rows.length > 0 && logQuery.rows[0].action === 'ENTRY') {
            currentAction = 'EXIT';
        }

        // Database generates the exact timestamp natively upon insert
        await pool.query(
            'INSERT INTO attendance_logs (resident_id, wristband_id, action, timestamp) VALUES ($1, $2, $3, NOW())',
            [resident.resident_id, resident.wristband_id, currentAction]
        );

        res.json({
            success: true,
            action: currentAction,
            resident: {
                id: resident.resident_id,
                name: resident.full_name,
                age: resident.age,
                sector: resident.sector,
                address: resident.complete_address,
                emergency: resident.emergency_contact,
                picture: resident.profile_pic || OFFLINE_DEFAULT_PIC
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Database processing error.' });
    }
});

/* ==========================================================================
   🏠 ROUTE: FETCH CURRENT ACTIVE INSIDERS (ENTRY WITHOUT EXIT)
   ========================================================================== */
app.get('/api/evacuation/insiders', async (req, res) => {
    try {
        const queryText = `
            WITH LastLogs AS (
                SELECT DISTINCT ON (resident_id) resident_id, action, timestamp
                FROM attendance_logs
                ORDER BY resident_id, timestamp DESC
            )
            SELECT r.resident_id, r.full_name, r.sector, r.profile_pic, r.complete_address
            FROM LastLogs l
            JOIN residents r ON l.resident_id = r.resident_id
            WHERE l.action = 'ENTRY'
            ORDER BY l.timestamp DESC`;

        const result = await pool.query(queryText);
        res.json({ success: true, insiders: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Evacuation tracker extraction breakdown.' });
    }
});

/* ==========================================================================
   🛡️ LEDGER ROUTE A: FETCH ATTENDANCE LOG TIMELINE FILTERED BY DATE
   ========================================================================== */
app.get('/api/attendance/logs', async (req, res) => {
    const { date } = req.query;
    try {
        const queryText = `
            SELECT l.timestamp, r.resident_id, r.full_name, r.age, r.sector, r.complete_address, r.emergency_contact, r.profile_pic, l.action
            FROM attendance_logs l
            JOIN residents r ON l.resident_id = r.resident_id
            WHERE DATE(l.timestamp) = $1
            ORDER BY l.timestamp DESC`;

        const logs = await pool.query(queryText, [date]);
        res.json({ success: true, logs: logs.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false });
    }
});

/* ==========================================================================
   🥗 LEDGER ROUTE B: FETCH FOOD DISTRIBUTION RATION LOGS FILTERED BY DATE
   ========================================================================== */
app.get('/api/ration/logs', async (req, res) => {
    const { date } = req.query;
    try {
        const queryText = `
            SELECT f.claimed_at AS timestamp, r.resident_id, r.full_name, r.age, r.sector, r.complete_address, r.profile_pic, 'FOOD_SERVED' AS action
            FROM food_distribution_logs f
            JOIN residents r ON f.resident_id = r.resident_id
            WHERE DATE(f.claimed_at) = $1
            ORDER BY f.claimed_at DESC`;

        const result = await pool.query(queryText, [date]);
        res.json({ success: true, logs: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false });
    }
});

app.get('/api/residents/:id', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM residents WHERE wristband_id = $1 OR resident_id = $2', [req.params.id, req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Not found.' });
        res.json({ success: true, resident: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

app.put('/api/residents/update', async (req, res) => {
    const { resident_id, name, age, sector, address, emergency_contact, profile_pic } = req.body;
    try {
        const fallbackPic = (profile_pic && profile_pic.trim() !== "undefined") ? profile_pic.trim() : OFFLINE_DEFAULT_PIC;
        await pool.query(
            'UPDATE residents SET full_name = $1, age = $2, sector = $3, complete_address = $4, emergency_contact = $5, profile_pic = $6 WHERE resident_id = $7',
            [name, parseInt(age), sector, address, emergency_contact, fallbackPic, resident_id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

app.listen(PORT, () => console.log("🚀 Server running at: http://localhost:" + PORT));