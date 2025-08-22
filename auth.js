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
    
    // Debug UI removed

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
        try {
            // Prevent infinite redirect loops by checking if we were redirected here intentionally
            const urlParams = new URLSearchParams(window.location.search);
            const from = urlParams.get('from');
            if (from) {
                console.log('Redirected here with from=', from, '— staying on login page');
                return;
            }
            
            // Add a small delay to ensure Parse is fully initialized
            await new Promise(resolve => setTimeout(resolve, 100));
            
            this.currentUser = Parse.User.current();
            console.log('Current user check:', this.currentUser ? 'User logged in' : 'No user');
            
            if (this.currentUser) {
                // Verify the session is still valid
                try {
                    await this.currentUser.fetch();
                    console.log('User session verified, redirecting to main app');
                    
                    // Add a flag to prevent circular redirects
                    sessionStorage.setItem('authRedirectInProgress', 'true');
                    
                    // User is already logged in and session is valid, redirect to main app
                    window.location.href = 'main-app.html';
                } catch (sessionError) {
                    console.log('User session expired, staying on login page');
                    // Session expired, log out and stay on login
                    await Parse.User.logOut();
                    this.currentUser = null;
                }
            }
        } catch (error) {
            console.log('Error checking current user:', error);
            this.currentUser = null;
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

        try {
            const user = await Parse.User.logIn(email, password);
            
            // Store remember me preference
            if (rememberMe) {
                localStorage.setItem('rememberMe', 'true');
            }

            this.showMessage('Login successful! Redirecting...', 'success');
            
            // Redirect to main app
            setTimeout(() => {
                window.location.href = 'main-app.html';
            }, 1000);

        } catch (error) {
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
