// Redirect Manager - Prevents infinite loops between login and main app
class RedirectManager {
    static REDIRECT_KEY = 'authRedirectInProgress';
    static TIMESTAMP_KEY = 'authRedirectTimestamp';
    static REDIRECT_TIMEOUT = 15000; // 15 seconds
    
    static setRedirectFlag() {
        sessionStorage.setItem(this.REDIRECT_KEY, 'true');
        sessionStorage.setItem(this.TIMESTAMP_KEY, Date.now().toString());
        console.log('Redirect flag set with timestamp');
    }
    
    static clearRedirectFlag() {
        sessionStorage.removeItem(this.REDIRECT_KEY);
        sessionStorage.removeItem(this.TIMESTAMP_KEY);
        console.log('Redirect flag cleared');
    }
    
    static isRedirectInProgress() {
        const flag = sessionStorage.getItem(this.REDIRECT_KEY);
        const timestamp = sessionStorage.getItem(this.TIMESTAMP_KEY);
        
        if (flag !== 'true' || !timestamp) {
            return false;
        }
        
        const age = Date.now() - parseInt(timestamp);
        
        // If redirect flag is older than timeout, clear it
        if (age > this.REDIRECT_TIMEOUT) {
            console.log('Redirect flag expired, clearing');
            this.clearRedirectFlag();
            return false;
        }
        
        console.log(`Redirect in progress (${age}ms ago)`);
        return true;
    }
    
    static shouldAllowRedirect() {
        if (this.isRedirectInProgress()) {
            console.log('Blocking redirect - already in progress');
            return false;
        }
        return true;
    }
    
    static redirectToLogin(reason = '') {
        if (!this.shouldAllowRedirect()) {
            return false;
        }
        
        this.setRedirectFlag();
        const url = reason ? `login.html?from=main-app&error=${reason}` : 'login.html?from=main-app';
        console.log(`Redirecting to login: ${url}`);
        window.location.href = url;
        return true;
    }
    
    static redirectToMainApp() {
        if (!this.shouldAllowRedirect()) {
            return false;
        }
        
        this.setRedirectFlag();
        console.log('Redirecting to main app');
        window.location.href = 'main-app.html';
        return true;
    }
    
    static handleSuccessfulRedirect() {
        // Clear flag when we successfully reach our destination
        this.clearRedirectFlag();
    }
}

// Export for global use
window.RedirectManager = RedirectManager;
