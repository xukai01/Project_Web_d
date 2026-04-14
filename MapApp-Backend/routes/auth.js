// routes/auth.js

const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcryptjs');
require('dotenv').config();
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

// ─── Generate 6-digit OTP ──────────────────────────────────
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// ─── Send OTP Email (Resend) ───────────────────────────────
async function sendOTPEmail(email, otp) {
    await resend.emails.send({
        from: process.env.EMAIL_FROM,
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
// ─────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
    const { full_name, email, password, user_type } = req.body;

    if (!full_name || !email || !password || !user_type) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    if (!email.endsWith(`@${process.env.COLLEGE_DOMAIN}`)) {
        return res.status(400).json({ message: `Only @${process.env.COLLEGE_DOMAIN} emails are allowed` });
    }

    const allowedTypes = ['student', 'professor', 'admin'];
    if (!allowedTypes.includes(user_type)) {
        return res.status(400).json({ message: 'Invalid user type' });
    }

    try {
        const [results] = await db.query('SELECT * FROM users WHERE email = ?', [email]);

        if (results.length > 0 && results[0].is_verified) {
            return res.status(400).json({ message: 'Email already registered' });
        }

        const password_hash = await bcrypt.hash(password, 10);

        if (results.length === 0) {
            await db.query(
                'INSERT INTO users (full_name, email, password_hash, user_type) VALUES (?, ?, ?, ?)',
                [full_name, email, password_hash, user_type]
            );
        }

        const otp = generateOTP();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await db.query('DELETE FROM otps WHERE email = ?', [email]);

        await db.query(
            'INSERT INTO otps (email, otp, expires_at, created_at) VALUES (?, ?, ?, NOW())',
            [email, otp, expiresAt]
        );

        await sendOTPEmail(email, otp);

        res.status(200).json({ message: 'OTP sent to your email' });

    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ message: 'Database error' });
    }
});

// ─────────────────────────────────────────────────────────────
// ROUTE 2: VERIFY OTP
// ─────────────────────────────────────────────────────────────
router.post('/verify-otp', async (req, res) => {
    const { email, otp } = req.body;

    try {
        const [results] = await db.query(
            'SELECT * FROM otps WHERE email = ? AND otp = ?',
            [email, otp]
        );

        if (results.length === 0) {
            return res.status(400).json({ message: 'Invalid OTP' });
        }

        if (new Date() > new Date(results[0].expires_at)) {
            return res.status(400).json({ message: 'OTP expired. Please request again.' });
        }

        await db.query('UPDATE users SET is_verified = TRUE WHERE email = ?', [email]);
        await db.query('DELETE FROM otps WHERE email = ?', [email]);

        res.status(200).json({ message: 'Email verified successfully' });

    } catch (err) {
        console.error('Verify OTP error:', err);
        res.status(500).json({ message: 'Database error' });
    }
});

// ─────────────────────────────────────────────────────────────
// ROUTE 3: RESEND OTP (WITH COOLDOWN)
// ─────────────────────────────────────────────────────────────
router.post('/resend-otp', async (req, res) => {
    const { email } = req.body;

    try {
        const [existing] = await db.query('SELECT * FROM otps WHERE email = ?', [email]);

        if (existing.length > 0) {
            const lastSent = new Date(existing[0].created_at);
            const now = new Date();

            if (now - lastSent < 30000) {
                return res.status(429).json({
                    message: 'Wait 30 seconds before requesting another OTP'
                });
            }
        }

        const otp = generateOTP();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await db.query('DELETE FROM otps WHERE email = ?', [email]);

        await db.query(
            'INSERT INTO otps (email, otp, expires_at, created_at) VALUES (?, ?, ?, NOW())',
            [email, otp, expiresAt]
        );

        try{
            await sendOTPEmail(email, otp);
        }catch(err){
            console.error('Error sending OTP email:', err);
            return res.status(500).json({ message: 'Failed to send OTP email' });
        }

        res.status(200).json({ message: 'New OTP sent successfully' });

    } catch (err) {
        console.error('Resend OTP error:', err);
        res.status(500).json({ message: 'Failed to resend OTP' });
    }
});

// ─────────────────────────────────────────────────────────────
// ROUTE 4: LOGIN
// ─────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password required' });
    }

    try {
        const [results] = await db.query('SELECT * FROM users WHERE email = ?', [email]);

        if (results.length === 0) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const user = results[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        if (!user.is_verified) {
            return res.status(403).json({ message: 'Please verify your email first' });
        }

        res.status(200).json({
            message: 'Login successful',
            user: {
                full_name: user.full_name,
                email: user.email,
                user_type: user.user_type
            }
        });

    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ message: 'Database error' });
    }
});

// ─────────────────────────────────────────────────────────────
// ROUTE 5: FORGOT PASSWORD (RESEND)
// ─────────────────────────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ message: 'Email required' });
    }

    try {
        const [results] = await db.query('SELECT * FROM users WHERE email = ?', [email]);

        if (results.length === 0) {
            return res.status(200).json({
                message: 'If account exists, email sent'
            });
        }

        const user = results[0];

        const tempPassword = Math.random().toString(36).slice(-8);
        const password_hash = await bcrypt.hash(tempPassword, 10);

        await db.query(
            'UPDATE users SET password_hash = ? WHERE email = ?',
            [password_hash, email]
        );

        await resend.emails.send({
            from: process.env.EMAIL_FROM,
            to: email,
            subject: 'Password Reset',
            html: `
                <h2>Password Reset</h2>
                <p>Hello ${user.full_name},</p>
                <p>Your temporary password is:</p>
                <h1>${tempPassword}</h1>
            `
        });

        res.status(200).json({
            message: 'If account exists, email sent'
        });

    } catch (err) {
        console.error('Forgot password error:', err);
        res.status(500).json({ message: 'Error processing request' });
    }
});

module.exports = router;
// ─────────────────────────────────────────────────────────────
// ROUTE 6: VERIFY ADMIN KEY
// POST /api/auth/verify-admin
// Body: { admin_key }
// ─────────────────────────────────────────────────────────────
router.post('/verify-admin', async (req, res) => {
    const { admin_key } = req.body;

    if (!admin_key) {
        return res.status(400).json({ message: 'Admin key is required' });
    }

    if (admin_key === process.env.ADMIN_KEY) {
        return res.status(200).json({ message: 'Admin verified successfully' });
    } else {
        return res.status(401).json({ message: 'Invalid admin key' });
    }
});

module.exports = router;
