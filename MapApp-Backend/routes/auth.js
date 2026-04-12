// routes/auth.js

const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
require('dotenv').config();

// ─── Email Transporter ─────────────────────────────────────
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// ─── Generate 6-digit OTP ──────────────────────────────────
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// ─── Send OTP Email ────────────────────────────────────────
async function sendOTPEmail(email, otp) {
    await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Your NIT KKR Signup OTP',
        html: `
            <h2>Email Verification</h2>
            <p>Your OTP for signup is:</p>
            <h1 style="color: blue; letter-spacing: 5px;">${otp}</h1>
            <p>This OTP is valid for <b>10 minutes</b>.</p>
            <p>If you did not request this, ignore this email.</p>
        `
    });
}


// ─────────────────────────────────────────────────────────────
// ROUTE 1: REGISTER
// POST /api/auth/register
// Body: { full_name, email, password, user_type }
// ─────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
    const { full_name, email, password, user_type } = req.body;

    // 1. Check all fields are present
    if (!full_name || !email || !password || !user_type) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    // 2. Check college domain
    if (!email.endsWith(`@${process.env.COLLEGE_DOMAIN}`)) {
        return res.status(400).json({ message: `Only @${process.env.COLLEGE_DOMAIN} emails are allowed` });
    }

    // 3. Check valid user_type
    const allowedTypes = ['student', 'professor', 'admin'];
    if (!allowedTypes.includes(user_type)) {
        return res.status(400).json({ message: 'Invalid user type' });
    }

    try {
        // 4. Check if email already exists and is verified
        const [results] = await db.query('SELECT * FROM users WHERE email = ?', [email]);

        if (results.length > 0 && results[0].is_verified) {
            return res.status(400).json({ message: 'Email already registered' });
        }

        // 5. Hash password
        const password_hash = await bcrypt.hash(password, 10);

        // 6. Insert user if not exists
        if (results.length === 0) {
            await db.query(
                'INSERT INTO users (full_name, email, password_hash, user_type) VALUES (?, ?, ?, ?)',
                [full_name, email, password_hash, user_type]
            );
        }

        // 7. Generate OTP and expiry
        const otp = generateOTP();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        // 8. Delete old OTP and save new one
        await db.query('DELETE FROM otps WHERE email = ?', [email]);
        await db.query(
            'INSERT INTO otps (email, otp, expires_at) VALUES (?, ?, ?)',
            [email, otp, expiresAt]
        );

        // 9. Send OTP email
        try {
            await sendOTPEmail(email, otp);
            res.status(200).json({ message: 'OTP sent to your email' });
        } catch (error) {
            console.error('Email error:', error);
            res.status(500).json({ message: 'Failed to send OTP email' });
        }
    } catch (err) {
        console.error('Database error during register:', err);
        res.status(500).json({ message: 'Database error' });
    }
});


// ─────────────────────────────────────────────────────────────
// ROUTE 2: VERIFY OTP
// POST /api/auth/verify-otp
// Body: { email, otp }
// ─────────────────────────────────────────────────────────────
router.post('/verify-otp', async (req, res) => {
    const { email, otp } = req.body;

    try {
        const [results] = await db.query('SELECT * FROM otps WHERE email = ? AND otp = ?', [email, otp]);

        if (results.length === 0) {
            return res.status(400).json({ message: 'Invalid OTP' });
        }

        // Check expiry
        const now = new Date();
        if (now > new Date(results[0].expires_at)) {
            return res.status(400).json({ message: 'OTP expired. Please register again.' });
        }

        // Mark user as verified
        await db.query('UPDATE users SET is_verified = TRUE WHERE email = ?', [email]);
        
        // Delete used OTP
        await db.query('DELETE FROM otps WHERE email = ?', [email]);

        res.status(200).json({ message: 'Email verified! You can now log in.' });
    } catch (err) {
        console.error('Database error during verify:', err);
        res.status(500).json({ message: 'Database error' });
    }
});


// ─────────────────────────────────────────────────────────────
// ROUTE 3: RESEND OTP
// POST /api/auth/resend-otp
// Body: { email }
// ─────────────────────────────────────────────────────────────
router.post('/resend-otp', async (req, res) => {
    const { email } = req.body;

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    try {
        await db.query('DELETE FROM otps WHERE email = ?', [email]);
        await db.query(
            'INSERT INTO otps (email, otp, expires_at) VALUES (?, ?, ?)',
            [email, otp, expiresAt]
        );

        try {
            await sendOTPEmail(email, otp);
            res.status(200).json({ message: 'New OTP sent to your email' });
        } catch (error) {
            console.error('Email error:', error);
            res.status(500).json({ message: 'Failed to send OTP email' });
        }
    } catch (err) {
        console.error('Database error during resend:', err);
        res.status(500).json({ message: 'Database error' });
    }
});

// ─────────────────────────────────────────────────────────────
// ROUTE 4: LOGIN
// POST /api/auth/login
// Body: { email, password }
// ─────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }

    try {
        const [results] = await db.query('SELECT * FROM users WHERE email = ?', [email]);

        if (results.length === 0) {
            return res.status(400).json({ message: 'Invalid email or password' });
        }

        const user = results[0];

        // Check password matching
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid email or password' });
        }

        // Check if verified
        if (!user.is_verified) {
            return res.status(403).json({ message: 'Please verify your email before logging in.' });
        }

        res.status(200).json({ message: 'Login successful', user: { full_name: user.full_name, email: user.email, user_type: user.user_type } });
    } catch (err) {
        console.error('Database error during login:', err);
        res.status(500).json({ message: 'Database error' });
    }
});

// ─────────────────────────────────────────────────────────────
// ROUTE 5: FORGOT PASSWORD
// POST /api/auth/forgot-password
// Body: { email }
// ─────────────────────────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ message: 'Email is required' });
    }

    try {
        const [results] = await db.query('SELECT * FROM users WHERE email = ?', [email]);

        if (results.length === 0) {
            // For security, do not reveal if email is registered, respond with success
            return res.status(200).json({ message: 'If an account exists, an email has been sent.' });
        }

        const user = results[0];

        // Generate a random temporary password (8 characters)
        const tempPassword = Math.random().toString(36).slice(-8);
        const password_hash = await bcrypt.hash(tempPassword, 10);

        // Update the password in db
        await db.query('UPDATE users SET password_hash = ? WHERE email = ?', [password_hash, email]);

        // Send email
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Your Password Has Been Reset',
            html: `
                <h2>Password Reset</h2>
                <p>Hello ${user.full_name},</p>
                <p>We received a request to reset your password. Here is your temporary password:</p>
                <h1 style="color: red; letter-spacing: 2px;">${tempPassword}</h1>
                <p>Please log in using this password. We recommend changing it once you log in (if the feature is available).</p>
                <p>If you did not request this, please contact support immediately.</p>
            `
        });

        res.status(200).json({ message: 'If an account exists, an email has been sent.' });
    } catch (err) {
        console.error('Database/Email error during forgot-password:', err);
        res.status(500).json({ message: 'Failed to process request' });
    }
});

module.exports = router;