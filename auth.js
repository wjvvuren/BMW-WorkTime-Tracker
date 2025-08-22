// Authentication System for BMW WorkTime Tracker
class AuthSystem {
    constructor() {
        this.currentUser = null;
        this.init();
    }

    init() {
        this.bindEvents();
        
        // Check for error messages from URL params
        this.checkForErrors();
        
        // Initialize authentication checking
        this.checkCurrentUser();
    }
    
    checkForErrors() {
        const urlParams = new URLSearchParams(window.location.search);
        const error = urlParams.get('error');
        const from = urlParams.get('from');
        
        if (error === 'auth-failed') {
            this.showMessage('Authentication failed. Please login again.', 'error');
        } else if (from === 'main-app') {
            this.showMessage('Session expired. Please login again.', 'info');
        } else if (from === 'loading') {
            const reason = urlParams.get('reason');
            if (reason === 'session-expired') {
                this.showMessage('Your session expired. Please sign in again.', 'info');
            } else if (reason === 'no-session') {
                // No message needed; normal flow
            } else if (error === 'init-failed') {
                this.showMessage('Initialization failed. Please try signing in.', 'error');
            }
        }
    }
    
    addDebugInfo() {
        // Debug buttons removed - authentication now works cleanly
    }

    updateQuickDebug(message) {
        // Debug UI removed - method kept for compatibility
    }

    bindEvents() {
        // Form submissions
        document.getElementById('loginFormElement').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        document.getElementById('registerFormElement').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleRegister();
        });

        document.getElementById('forgotPasswordFormElement').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleForgotPassword();
        });

        // Form switching
        document.getElementById('showRegisterBtn').addEventListener('click', () => {
            this.showForm('register');
        });

        document.getElementById('showLoginBtn').addEventListener('click', () => {
            this.showForm('login');
        });

        document.getElementById('forgotPasswordLink').addEventListener('click', (e) => {
            e.preventDefault();
            this.showForm('forgotPassword');
        });

        document.getElementById('backToLoginBtn').addEventListener('click', () => {
            this.showForm('login');
        });

        // Password confirmation validation
        document.getElementById('confirmPassword').addEventListener('input', () => {
            this.validatePasswordConfirmation();
        });
    }

    async checkCurrentUser() {
        this.updateQuickDebug('Checking current user...');
        
        try {
            // Prevent infinite redirect loops by checking if we were redirected here intentionally
            const urlParams = new URLSearchParams(window.location.search);
            const from = urlParams.get('from');
            if (from) {
                console.log('Redirected here with from=', from, '— staying on login page');
                this.updateQuickDebug(`Redirected from ${from} - staying on login`);
                // Clear any redirect flags since we're now on login page
                sessionStorage.removeItem('authRedirectInProgress');
                sessionStorage.removeItem('authRedirectTimestamp');
                // If we were redirected from main due to auth failure, ensure no stale session persists
                try {
                    const maybeUser = Parse.User.current();
                    if (maybeUser) {
                        console.log('Logging out stale user after redirect from main');
                        await Parse.User.logOut();
                    }
                } catch (e) {
                    console.warn('Logout after redirect failed:', e);
                }
                // Clean up the URL
                if (window.history && window.history.replaceState) {
                    window.history.replaceState({}, document.title, window.location.pathname);
                }
                return;
            }
            
            // Check if we're in a redirect loop - but do not block on login
            const redirectFlag = sessionStorage.getItem('authRedirectInProgress');
            const redirectTimestamp = sessionStorage.getItem('authRedirectTimestamp');
            
            if (redirectFlag === 'true') {
                const now = Date.now();
                const timestamp = parseInt(redirectTimestamp) || 0;
                const age = now - timestamp;

                // If redirect was set more than 10 seconds ago, clear it (likely stale)
                if (age > 10000) {
                    console.log('Clearing stale redirect flag');
                    this.updateQuickDebug('Clearing stale redirect flag');
                    sessionStorage.removeItem('authRedirectInProgress');
                    sessionStorage.removeItem('authRedirectTimestamp');
                } else {
                    // On login page, don't block due to a recent redirect flag (can cause a stuck state)
                    console.log('Recent redirect flag detected on login, clearing and continuing auth check');
                    this.updateQuickDebug(`Recent redirect flag detected (${Math.round(age / 1000)}s) - continuing...`);
                    sessionStorage.removeItem('authRedirectInProgress');
                    sessionStorage.removeItem('authRedirectTimestamp');
                    // Continue with auth check instead of returning
                }
            }
            
            // Add a small delay to ensure Parse is fully initialized
            this.updateQuickDebug('Initializing Parse...');
            await new Promise(resolve => setTimeout(resolve, 300));
            
            this.currentUser = Parse.User.current();
            console.log('Current user check:', this.currentUser ? 'User logged in' : 'No user');
            
            if (this.currentUser) {
                this.updateQuickDebug('User found - verifying session...');
                // Verify the session is still valid
                try {
                    console.log('Verifying user session...');
                    await this.currentUser.fetch();
                    console.log('User session verified, redirecting to main app');
                    this.updateQuickDebug('Session valid - redirecting to app...');
                    
                    // Set flag with timestamp to prevent circular redirects
                    sessionStorage.setItem('authRedirectInProgress', 'true');
                    sessionStorage.setItem('authRedirectTimestamp', Date.now().toString());
                    
                    setTimeout(() => {
                        window.location.href = 'loading-screen.html';
                    }, 200);
                    
                } catch (sessionError) {
                    console.log('User session expired, staying on login page');
                    this.updateQuickDebug('Session expired - please login');
                    // Session expired, log out and stay on login
                    await Parse.User.logOut();
                    this.currentUser = null;
                    sessionStorage.removeItem('authRedirectInProgress');
                    sessionStorage.removeItem('authRedirectTimestamp');
                }
            } else {
                this.updateQuickDebug('No user logged in - ready for login');
            }
        } catch (error) {
            console.log('Error checking current user:', error);
            this.updateQuickDebug(`Error: ${error.message}`);
            this.currentUser = null;
            sessionStorage.removeItem('authRedirectInProgress');
            sessionStorage.removeItem('authRedirectTimestamp');
        }
    }

    showForm(formType) {
        // Hide all forms
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('registerForm').style.display = 'none';
        document.getElementById('forgotPasswordForm').style.display = 'none';

        // Show selected form
        switch (formType) {
            case 'login':
                document.getElementById('loginForm').style.display = 'block';
                break;
            case 'register':
                document.getElementById('registerForm').style.display = 'block';
                break;
            case 'forgotPassword':
                document.getElementById('forgotPasswordForm').style.display = 'block';
                break;
        }

        // Clear messages
        this.hideMessage();
    }

    async handleLogin() {
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;
        const rememberMe = document.getElementById('rememberMe').checked;

        if (!email || !password) {
            this.showMessage('Please fill in all fields', 'error');
            return;
        }

        this.setLoading('loginBtn', true);
        this.updateQuickDebug('Attempting login...');

        try {
            // Clear any previous redirect flags
            sessionStorage.removeItem('authRedirectInProgress');
            sessionStorage.removeItem('authRedirectTimestamp');
            
            console.log('Attempting login for:', email);
            const user = await Parse.User.logIn(email, password);
            console.log('Login successful for user:', user.get('email'));
            this.updateQuickDebug('Login successful - redirecting...');
            
            // Store remember me preference
            if (rememberMe) {
                localStorage.setItem('rememberMe', 'true');
            }

            this.showMessage('Login successful! Redirecting...', 'success');
            
            // Set redirect flag with timestamp and redirect to main app
            sessionStorage.setItem('authRedirectInProgress', 'true');
            sessionStorage.setItem('authRedirectTimestamp', Date.now().toString());
            
            setTimeout(() => {
                window.location.href = 'loading-screen.html';
            }, 400);

        } catch (error) {
            console.error('Login error:', error);
            this.updateQuickDebug(`Login failed: ${error.message}`);
            sessionStorage.removeItem('authRedirectInProgress');
            sessionStorage.removeItem('authRedirectTimestamp');
            this.showMessage(this.getErrorMessage(error), 'error');
        } finally {
            this.setLoading('loginBtn', false);
        }
    }

    async handleRegister() {
        const name = document.getElementById('registerName').value.trim();
        const email = document.getElementById('registerEmail').value.trim();
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const agreeTerms = document.getElementById('agreeTerms').checked;

        // Validation
        if (!name || !email || !password || !confirmPassword) {
            this.showMessage('Please fill in all fields', 'error');
            return;
        }

        if (password !== confirmPassword) {
            this.showMessage('Passwords do not match', 'error');
            return;
        }

        if (password.length < 6) {
            this.showMessage('Password must be at least 6 characters', 'error');
            return;
        }

        if (!agreeTerms) {
            this.showMessage('Please agree to the Terms of Service', 'error');
            return;
        }

        this.setLoading('registerBtn', true);

        try {
            const user = new Parse.User();
            user.set('username', email);
            user.set('email', email);
            user.set('password', password);
            user.set('name', name);

            await user.signUp();

            this.showMessage('Account created successfully! Please check your email for verification.', 'success');
            
            // Auto-login after registration
            setTimeout(() => {
                this.showForm('login');
                document.getElementById('loginEmail').value = email;
            }, 2000);

        } catch (error) {
            this.showMessage(this.getErrorMessage(error), 'error');
        } finally {
            this.setLoading('registerBtn', false);
        }
    }

    async handleForgotPassword() {
        const email = document.getElementById('resetEmail').value.trim();

        if (!email) {
            this.showMessage('Please enter your email address', 'error');
            return;
        }

        this.setLoading('resetBtn', true);

        try {
            await Parse.User.requestPasswordReset(email);
            this.showMessage('Password reset email sent! Check your inbox.', 'success');
            
            setTimeout(() => {
                this.showForm('login');
            }, 3000);

        } catch (error) {
            this.showMessage(this.getErrorMessage(error), 'error');
        } finally {
            this.setLoading('resetBtn', false);
        }
    }

    validatePasswordConfirmation() {
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const confirmField = document.getElementById('confirmPassword');

        if (confirmPassword && password !== confirmPassword) {
            confirmField.style.borderColor = 'var(--error-red)';
        } else {
            confirmField.style.borderColor = '#e0e0e0';
        }
    }

    setLoading(buttonId, isLoading) {
        const button = document.getElementById(buttonId);
        const spinner = button.querySelector('.loading-spinner');
        const text = button.querySelector('.btn-text');

        if (isLoading) {
            button.disabled = true;
            spinner.style.display = 'block';
            text.textContent = 'Please wait...';
        } else {
            button.disabled = false;
            spinner.style.display = 'none';
            
            // Reset text based on button
            switch (buttonId) {
                case 'loginBtn':
                    text.textContent = 'Sign In';
                    break;
                case 'registerBtn':
                    text.textContent = 'Create Account';
                    break;
                case 'resetBtn':
                    text.textContent = 'Send Reset Link';
                    break;
            }
        }
    }

    showMessage(message, type) {
        const messageEl = document.getElementById('authMessage');
        messageEl.textContent = message;
        messageEl.className = `auth-message ${type}`;
        messageEl.style.display = 'block';

        // Auto-hide error messages
        if (type === 'error') {
            setTimeout(() => {
                this.hideMessage();
            }, 5000);
        }
    }

    hideMessage() {
        const messageEl = document.getElementById('authMessage');
        messageEl.style.display = 'none';
    }

    getErrorMessage(error) {
        switch (error.code) {
            case Parse.Error.INVALID_EMAIL_ADDRESS:
                return 'Invalid email address';
            case Parse.Error.USERNAME_TAKEN:
                return 'This email is already registered';
            case Parse.Error.EMAIL_TAKEN:
                return 'This email is already registered';
            case Parse.Error.INVALID_PASSWORD:
                return 'Invalid password';
            case Parse.Error.OBJECT_NOT_FOUND:
                return 'Invalid email or password';
            case Parse.Error.CONNECTION_FAILED:
                return 'Connection failed. Please check your internet connection.';
            default:
                return error.message || 'An error occurred. Please try again.';
        }
    }
}

// Initialize authentication system when page loads
document.addEventListener('DOMContentLoaded', () => {
    new AuthSystem();
});
