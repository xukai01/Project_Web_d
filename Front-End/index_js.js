document.addEventListener('DOMContentLoaded', () => {
    // 1. Grab all panels
    const signUpPanel = document.querySelector('.sign-up');
    const verifyPanel = document.querySelector('.verify-email');
    const logInPanel = document.querySelector('.log-in');
    const forgotPanel = document.querySelector('.forgot-password');

    // 2. Grab forms and buttons
    const linkToLogin = document.getElementById('link-to-login');
    const linkToSignup = document.getElementById('link-to-signup');
    const linkToForgot = document.getElementById('link-to-forgot');
    const forgotToLogin = document.getElementById('forgot-to-login');
    const forgotToLoginBtn = document.getElementById('forgot-to-login-btn');
    
    const signupForm = document.getElementById('signup-form');
    const verifyForm = document.getElementById('verify-form');
    const loginForm = document.getElementById('login-form');
    const forgotForm = document.getElementById('forgot-form');
    
    const prevBtn = document.getElementById('prev-btn');
    const resendOtpBtn = document.getElementById('resend-otp-btn');

    // State Variables
    let savedEmail = '';
    let otpTimerInterval = null;

    // --- Helper specific to Inline Errors (Replacement for alert popups) ---
    function showError(inputId, message) {
        const inputField = document.getElementById(inputId);
        const errorSpan = document.getElementById(`${inputId}-error`);
        
        if (inputField) inputField.classList.add('input-error');
        if (errorSpan) {
            errorSpan.textContent = message;
            errorSpan.classList.add('show');
        }
    }

    function clearAllErrors() {
        document.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));
        document.querySelectorAll('.error-msg.show').forEach(el => {
            el.classList.remove('show');
            el.textContent = '';
        });
        document.querySelectorAll('.success-msg.show').forEach(el => {
            el.classList.remove('show');
            el.textContent = '';
        });
    }

    // Clear error on input change
    document.querySelectorAll('.input-field').forEach(input => {
        input.addEventListener('input', function() {
            this.classList.remove('input-error');
            const errorSpan = document.getElementById(`${this.id}-error`);
            if (errorSpan) {
                errorSpan.classList.remove('show');
                errorSpan.textContent = '';
            }
        });
    });

    // --- Panel Switching ---
    function switchPanel(panelToShow) {
        clearAllErrors(); // Clear validation errors upon switching
        [signUpPanel, verifyPanel, logInPanel, forgotPanel].forEach(panel => {
            if (panel) panel.classList.remove('active');
        });
        if (panelToShow) panelToShow.classList.add('active');
    }

    // Set Default State
    switchPanel(signUpPanel);

    // Navigation Listeners
    if (linkToLogin) linkToLogin.addEventListener('click', (e) => { e.preventDefault(); switchPanel(logInPanel); });
    if (linkToSignup) linkToSignup.addEventListener('click', (e) => { e.preventDefault(); switchPanel(signUpPanel); });
    if (linkToForgot) linkToForgot.addEventListener('click', (e) => { e.preventDefault(); switchPanel(forgotPanel); });
    if (forgotToLogin) forgotToLogin.addEventListener('click', (e) => { e.preventDefault(); switchPanel(logInPanel); });
    if (forgotToLoginBtn) forgotToLoginBtn.addEventListener('click', () => switchPanel(logInPanel));
    if (prevBtn) prevBtn.addEventListener('click', () => { clearInterval(otpTimerInterval); switchPanel(signUpPanel); });

    // --- OTP Timer Logic ---
    function startOtpTimer(durationSeconds) {
        let timer = durationSeconds;
        const display = document.getElementById('otp-timer');
        if(resendOtpBtn) {
            resendOtpBtn.disabled = true;
            resendOtpBtn.textContent = 'Resend OTP';
        }

        clearInterval(otpTimerInterval);
        
        otpTimerInterval = setInterval(function () {
            let minutes = parseInt(timer / 60, 10);
            let seconds = parseInt(timer % 60, 10);

            minutes = minutes < 10 ? "0" + minutes : minutes;
            seconds = seconds < 10 ? "0" + seconds : seconds;

            if (display) display.textContent = minutes + ":" + seconds;

            if (--timer < 0) {
                clearInterval(otpTimerInterval);
                if(display) display.textContent = "00:00";
                if(resendOtpBtn) {
                    resendOtpBtn.disabled = false;
                    resendOtpBtn.textContent = 'Resend OTP Now';
                }
            }
        }, 1000);
    }

    if (resendOtpBtn) {
        resendOtpBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            if(resendOtpBtn.disabled) return;
            
            // Re-trigger OTP dispatch here if there's a backend endpoint for it
            // Assuming successful resend:
            startOtpTimer(300); // restart 5-minute timer
        });
    }

    // --- Form Submissions ---

    // 1. Sign Up
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearAllErrors();
            
            const name = document.getElementById('sign-name').value.trim();
            const email = document.getElementById('sign-email').value.trim();
            const password = document.getElementById('sign-password').value;
            const confirmPassword = document.getElementById('sign-confirm-password').value;
            let isValid = true;

            // Basic validation
            if(!name) { showError('sign-name', 'Name is required'); isValid = false; }
            if(!email) { showError('sign-email', 'Email is required'); isValid = false; }
            if(!password || password.length < 6) { showError('sign-password', 'Password must be at least 6 characters'); isValid = false; }
            if(password !== confirmPassword) { showError('sign-confirm-password', 'Passwords do not match'); isValid = false; }

            if(!isValid) return;

            try {
                const response = await fetch('http://localhost:5000/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ full_name: name, email, password, user_type: 'student' })
                });

                if (response.ok) {
                    savedEmail = email;
                    switchPanel(verifyPanel);
                    startOtpTimer(300); // Start 5:00 countdown
                } else {
                    const data = await response.json().catch(() => ({}));
                    const msg = data.message || 'Registration failed.';
                    // Direct targeting for known errors
                    if(msg.toLowerCase().includes('email')) {
                        showError('sign-email', msg);
                    } else {
                        showError('sign-email', msg);
                    }
                }
            } catch (error) {
                console.error('Registration Error:', error);
                showError('sign-email', 'Connection error. Check server.');
            }
        });
    }

    // 2. Verify OTP
    if (verifyForm) {
        verifyForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearAllErrors();

            const otp = document.getElementById('verify-otp').value.trim();
            if(!otp || otp.length !== 6) {
                showError('verify-otp', 'Please enter a valid 6-digit OTP');
                return;
            }

            try {
                const response = await fetch('http://localhost:5000/api/auth/verify-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: savedEmail, otp })
                });

                if (response.ok) {
                    clearInterval(otpTimerInterval);
                    window.location.href = 'home.html';
                } else {
                    const data = await response.json().catch(() => ({}));
                    showError('verify-otp', data.message || 'Invalid OTP code.');
                }
            } catch (error) {
                console.error('Verification Error:', error);
                showError('verify-otp', 'Connection error. Please try again.');
            }
        });
    }

    // 3. Log In
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearAllErrors();

            const email = document.getElementById('login-email').value.trim();
            const password = document.getElementById('login-password').value;
            let isValid = true;

            if(!email) { showError('login-email', 'Email is required'); isValid = false; }
            if(!password) { showError('login-password', 'Password is required'); isValid = false; }

            if(!isValid) return;

            try {
                const response = await fetch('http://localhost:5000/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                if (response.ok) {
                    window.location.href = 'home.html';
                } else {
                    const data = await response.json().catch(() => ({}));
                    const msg = data.message || 'Login failed.';
                    
                    // Distribute messages based on text commonly sent by backends
                    if (msg.toLowerCase().includes('password')) {
                        showError('login-password', msg);
                    } else {
                        showError('login-email', msg);
                    }
                }
            } catch (error) {
                console.error('Login Error:', error);
                showError('login-email', 'Connection error. Please try again.');
            }
        });
    }

    // 4. Forgot Password Flow
    if (forgotForm) {
        forgotForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearAllErrors();

            const email = document.getElementById('forgot-email').value.trim();
            if(!email) { showError('forgot-email', 'Email is required'); return; }

            try {
                // Adjust if a different endpoint exists for password reset requests
                const response = await fetch('http://localhost:5000/api/auth/forgot-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });

                if (response.ok || response.status === 404) {
                    // For security, often it's good to show a success message regardless
                    const successSpan = document.getElementById('forgot-email-success');
                    if(successSpan) {
                        successSpan.textContent = "If an account exists, a temporary password has been emailed.";
                        successSpan.classList.add('show');
                    }
                } else {
                    const data = await response.json().catch(() => ({}));
                    showError('forgot-email', data.message || 'Failed to send temporary password.');
                }
            } catch (error) {
                console.error('Forgot Password Error:', error);
                showError('forgot-email', 'Connection error. Please try again.');
            }
        });
    }
});