document.addEventListener('DOMContentLoaded', () => {


// =============================================
// CONFIG
// =============================================
const API_BASE_URL = 'https://projectcode-production.up.railway.app';

// =============================================
// PANELS
// =============================================
const signUpPanel = document.querySelector('.sign-up');
const verifyPanel = document.querySelector('.verify-email');
const logInPanel = document.querySelector('.log-in');
const forgotPanel = document.querySelector('.forgot-password');
const adminPanel = document.querySelector('.admin-key');

// =============================================
// NAVIGATION BUTTONS
// =============================================
const linkToLogin = document.getElementById('link-to-login');
const linkToSignup = document.getElementById('link-to-signup');
const linkToForgot = document.getElementById('link-to-forgot');
const forgotToLogin = document.getElementById('forgot-to-login');
const forgotToLoginBtn = document.getElementById('forgot-to-login-btn');

const adminModeBtn = document.getElementById('admin-mode-btn');
const adminBackBtn = document.getElementById('admin-back-btn');

// =============================================
// FORMS
// =============================================
const signupForm = document.getElementById('signup-form');
const verifyForm = document.getElementById('verify-form');
const loginForm = document.getElementById('login-form');
const forgotForm = document.getElementById('forgot-form');
const adminKeyForm = document.getElementById('admin-key-form');

const prevBtn = document.getElementById('prev-btn');
const resendOtpBtn = document.getElementById('resend-otp-btn');

// =============================================
// STATE
// =============================================
let savedEmail = '';
let otpTimerInterval = null;

// =============================================
// HELPERS
// =============================================
function showError(id, msg) {
    const input = document.getElementById(id);
    const err = document.getElementById(id + '-error');
    if (input) input.classList.add('input-error');
    if (err) {
        err.textContent = msg;
        err.classList.add('show');
    }
}

function clearAllErrors() {
    document.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));
    document.querySelectorAll('.error-msg.show').forEach(el => {
        el.classList.remove('show');
        el.textContent = '';
    });
}

function switchPanel(panel) {
    [signUpPanel, verifyPanel, logInPanel, forgotPanel, adminPanel].forEach(p => {
        if (p) p.classList.remove('active');
    });
    if (panel) panel.classList.add('active');
}

// =============================================
// DEFAULT
// =============================================
switchPanel(signUpPanel);

// =============================================
// NAVIGATION
// =============================================
linkToLogin?.addEventListener('click', e => { e.preventDefault(); switchPanel(logInPanel); });
linkToSignup?.addEventListener('click', e => { e.preventDefault(); switchPanel(signUpPanel); });
linkToForgot?.addEventListener('click', e => { e.preventDefault(); switchPanel(forgotPanel); });
forgotToLogin?.addEventListener('click', e => { e.preventDefault(); switchPanel(logInPanel); });
forgotToLoginBtn?.addEventListener('click', () => switchPanel(logInPanel));

prevBtn?.addEventListener('click', () => {
    clearInterval(otpTimerInterval);
    switchPanel(signUpPanel);
});

// =============================================
// ADMIN MODE BUTTON
// =============================================
adminModeBtn?.addEventListener('click', () => {
    switchPanel(adminPanel);
});

adminBackBtn?.addEventListener('click', () => {
    switchPanel(signUpPanel);
});

// =============================================
// OTP TIMER
// =============================================
function startOtpTimer(time) {
    let t = time;
    clearInterval(otpTimerInterval);

    otpTimerInterval = setInterval(() => {
        if (--t < 0) {
            clearInterval(otpTimerInterval);
            resendOtpBtn.disabled = false;
        }
    }, 1000);
}

// =============================================
// SIGNUP
// =============================================
signupForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAllErrors();

    const name = document.getElementById('sign-name').value.trim();
    const email = document.getElementById('sign-email').value.trim();
    const password = document.getElementById('sign-password').value;

    try {
        const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ full_name:name, email, password })
        });

        if (res.ok) {
            savedEmail = email;
            switchPanel(verifyPanel);
            startOtpTimer(300);
        } else {
            showError('sign-email', 'Registration failed');
        }
    } catch {
        showError('sign-email', 'Server error');
    }
});

// =============================================
// LOGIN
// =============================================
loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAllErrors();

    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify({email,password})
        });

        const data = await res.json();

        if (res.ok) {
            localStorage.setItem('user', JSON.stringify(data.user));
            window.location.href = 'home.html';
        } else {
            showError('login-email', data.message || "Login failed");
        }
    } catch {
        showError('login-email', 'Server error');
    }
});

// =============================================
// ADMIN VERIFY
// =============================================
adminKeyForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAllErrors();

    const adminKey = document.getElementById('admin-key-input').value.trim();

    if (!adminKey) {
        showError('admin-key-input', 'Enter admin key');
        return;
    }

    try {
        const res = await fetch(`${API_BASE_URL}/api/auth/verify-admin`, {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ admin_key: adminKey })
        });

        if (res.ok) {
            window.location.href = 'home.html?admin=true';
        } else {
            showError('admin-key-input', 'Wrong admin key');
        }
    } catch {
        showError('admin-key-input', 'Server error');
    }
});

});
