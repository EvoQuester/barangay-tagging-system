const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware Configuration
app.use(cors());

/* ==========================================================================
   ⚠️ CRITICAL FIX: EXTEND REQUEST BODY SIZE LIMITS FOR OFFLINE IMAGES
   ========================================================================== */
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve all static frontend UI assets out of the /public folder
app.use(express.static(path.join(__dirname, 'public')));

// Initialize connection pool to local PostgreSQL Database using .env parameters
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// Test Database Connection Integrity
pool.connect((err) => {
    if (err) {
        console.error('❌ Database connection failed:', err.stack);
    } else {
        console.log('✅ Relational engine successfully linked to PostgreSQL (barangay_access_db).');
    }
});

// Safe offline fallback icon constant
const OFFLINE_DEFAULT_PIC = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2394a3b8"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm0 14c-2.03 0-4.43-.82-6.14-2.88C7.55 15.8 9.68 15 12 15s4.45.8 6.14 2.12C16.43 19.18 14.03 20 12 20z"/></svg>';

/* ==========================================================================
   ROUTE 1: REGISTER A NEW RESIDENT & LINK WRISTBAND QR
   ========================================================================== */
app.post('/api/residents/register', async (req, res) => {
    const { name, age, sector, address, emergency_contact, linked_qr_id, profile_pic } = req.body;

    try {
        const existingId = await pool.query('SELECT wristband_id FROM residents WHERE wristband_id = $1', [linked_qr_id]);
        if (existingId.rows.length > 0) {
            return res.status(400).json({ success: false, message: 'This wristband QR is already assigned to another resident!' });
        }

        const fallbackPic = profile_pic.trim() || OFFLINE_DEFAULT_PIC;

        const queryText = `
            INSERT INTO residents (wristband_id, full_name, age, sector, complete_address, emergency_contact, profile_pic)
            VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`;
        
        await pool.query(queryText, [linked_qr_id, name, parseInt(age), sector, address, emergency_contact, fallbackPic]);
        res.json({ success: true, message: 'Resident profile successfully registered!' });
    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ success: false, message: 'Internal server error during registration.' });
    }
});

/* ==========================================================================
   ROUTE 2: ATTENDANCE SCAN LOGIC (AUTOMATIC ENTRY/EXIT TOGGLE)
   ========================================================================== */
app.post('/api/attendance/scan', async (req, res) => {
    const { scanned_id } = req.body;

    try {
        const residentQuery = await pool.query('SELECT * FROM residents WHERE wristband_id = $1', [scanned_id]);
        if (residentQuery.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'UNREGISTERED WRISTBAND' });
        }
        const resident = residentQuery.rows[0];

        const logQuery = await pool.query(
            'SELECT action FROM attendance_logs WHERE wristband_id = $1 ORDER BY timestamp DESC LIMIT 1',
            [scanned_id]
        );

        let currentAction = 'ENTRY'; 
        if (logQuery.rows.length > 0 && logQuery.rows[0].action === 'ENTRY') {
            currentAction = 'EXIT';
        }

        await pool.query(
            'INSERT INTO attendance_logs (wristband_id, action) VALUES ($1, $2)',
            [scanned_id, currentAction]
        );

        res.json({
            success: true,
            action: currentAction,
            resident: {
                id: resident.wristband_id,
                name: resident.full_name,
                age: resident.age,
                sector: resident.sector,
                address: resident.complete_address,
                emergency: resident.emergency_contact,
                picture: resident.profile_pic || OFFLINE_DEFAULT_PIC
            }
        });
    } catch (err) {
        console.error('Scan error:', err);
        res.status(500).json({ success: false, message: 'Database processing error.' });
    }
});

/* ==========================================================================
   ROUTE 3: FETCH HISTORICAL LEDGER LOGS BY SPECIFIC DATE
   ========================================================================== */
app.get('/api/attendance/logs', async (req, res) => {
    const { date } = req.query; 
    
    try {
        const queryText = `
            SELECT l.timestamp, l.wristband_id, r.full_name, r.age, r.sector, r.complete_address, r.emergency_contact, r.profile_pic, l.action
            FROM attendance_logs l
            JOIN residents r ON l.wristband_id = r.wristband_id
            WHERE DATE(l.timestamp) = $1
            ORDER BY l.timestamp DESC`;
            
        const logs = await pool.query(queryText, [date]);
        res.json({ success: true, logs: logs.rows });
    } catch (err) {
        console.error('Fetch logs error:', err);
        res.status(500).json({ success: false, message: 'Failed to extract ledger logs.' });
    }
});

/* ==========================================================================
   ROUTE 4: FETCH A SINGLE RESIDENT BY ID FOR PROFILE MANAGEMENT
   ========================================================================== */
app.get('/api/residents/:id', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM residents WHERE wristband_id = $1', [req.params.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'No resident found with this Unique ID.' });
        }
        res.json({ success: true, resident: result.rows[0] });
    } catch (err) {
        console.error('Fetch profile error:', err);
        res.status(500).json({ success: false, message: 'Server database extraction breakdown.' });
    }
});

/* ==========================================================================
   ROUTE 5: UPDATE ALL COMPREHENSIVE RESIDENT CORE INFORMATION
   ========================================================================== */
app.put('/api/residents/update', async (req, res) => {
    const { wristband_id, name, age, sector, address, emergency_contact, profile_pic } = req.body;

    try {
        const fallbackPic = profile_pic.trim() || OFFLINE_DEFAULT_PIC;
        
        const updateQuery = `
            UPDATE residents 
            SET full_name = $1, age = $2, sector = $3, complete_address = $4, emergency_contact = $5, profile_pic = $6
            WHERE wristband_id = $7
            RETURNING *`;
            
        const result = await pool.query(updateQuery, [name, parseInt(age), sector, address, emergency_contact, fallbackPic, wristband_id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Resident profile was not found.' });
        }
        
        res.json({ success: true, message: 'Resident core metadata successfully synced!' });
    } catch (err) {
        console.error('Update profile matrix error:', err);
        res.status(500).json({ success: false, message: 'Failed to rewrite data fields in database.' });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 System server running at: http://localhost:${PORT}`);
});