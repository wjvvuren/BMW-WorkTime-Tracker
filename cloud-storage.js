// Cloud Storage System for BMW WorkTime Tracker
class CloudStorage {
    constructor() {
        this.currentUser = null;
        this.syncInProgress = false;
        this.lastSyncTime = null;
        this.workTimeTracker = null;
        this.init();
    }

    async init() {
        try {
            // Check if user is logged in
            this.currentUser = Parse.User.current();
            // If no user yet, stay idle. Main app handles auth/redirects.
            if (!this.currentUser) {
                console.log('[CloudStorage] No current user; idle until app initializes.');
                return;
            }

            // Initialize UI
            this.updateUserInfo();
            this.bindEvents();
            
            // Wait for main app to initialize, then get reference
            this.waitForMainApp();
            
            // Setup auto-sync
            this.setupAutoSync();

        } catch (error) {
            console.error('Error initializing cloud storage:', error);
            this.showError('Failed to connect to cloud. Working offline.');
        }
    }

    waitForMainApp() {
        // Wait for the main app to be available
        const checkForApp = () => {
            if (window.workTimeTracker) {
                this.workTimeTracker = window.workTimeTracker;
                console.log('CloudStorage connected to main app');
                this.updateSyncStatus('synced');
            } else {
                setTimeout(checkForApp, 500);
            }
        };
        checkForApp();
    }

    bindEvents() {
        // User menu events
        document.getElementById('userMenuBtn').addEventListener('click', () => {
            this.toggleUserMenu();
        });

        document.getElementById('syncNowBtn').addEventListener('click', () => {
            this.syncNow();
        });

        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.logout();
        });

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            const userMenu = document.getElementById('userMenu');
            const userMenuBtn = document.getElementById('userMenuBtn');
            if (!userMenu.contains(e.target) && !userMenuBtn.contains(e.target)) {
                userMenu.style.display = 'none';
            }
        });

        // Sync on page visibility change (when user returns to tab) - removed to reduce API calls
        // document.addEventListener('visibilitychange', () => {
        //     if (!document.hidden) {
        //         this.syncNow();
        //     }
        // });

        // Sync before page unload
        window.addEventListener('beforeunload', () => {
            this.saveToCloud();
        });
    }

    updateUserInfo() {
        const userName = document.getElementById('userName');
        const userInfo = document.getElementById('userInfo');
        
        if (this.currentUser) {
            userName.textContent = this.currentUser.get('name') || this.currentUser.get('email');
            userInfo.style.display = 'flex';
        }
    }

    toggleUserMenu() {
        const userMenu = document.getElementById('userMenu');
        userMenu.style.display = userMenu.style.display === 'none' ? 'block' : 'none';
    }

    async logout() {
        try {
            this.showLoading('Signing out...');
            
            // Clear any local data and session storage
            localStorage.clear();
            sessionStorage.clear();
            
            // Log out from Parse
            await Parse.User.logOut();
            
            console.log('User logged out successfully');
            // Add a delay to ensure logout completes before redirect
            setTimeout(() => {
                window.location.href = 'login.html?from=main-app';
            }, 500);
            
        } catch (error) {
            console.error('Logout error:', error);
            this.hideLoading();
            
            // Force redirect even if logout fails
            localStorage.clear();
            sessionStorage.clear();
            setTimeout(() => {
                window.location.href = 'login.html?from=main-app';
            }, 500);
        }
    }

    async saveToCloud() {
        if (this.syncInProgress) return;
        
        try {
            this.syncInProgress = true;
            this.updateSyncStatus('syncing');

            // Get current data from localStorage
            const sessions = JSON.parse(localStorage.getItem('workSessions') || '[]');
            const activeSessions = JSON.parse(localStorage.getItem('activeSessions') || '[]');
            const customTargetHours = localStorage.getItem('customTargetHours') || '0';

            // Save to Parse
            const WorkData = Parse.Object.extend('WorkData');
            let workData = new Parse.Query(WorkData);
            workData.equalTo('user', this.currentUser);
            
            let existingData = await workData.first();
            
            if (!existingData) {
                existingData = new WorkData();
                existingData.set('user', this.currentUser);
            }

            existingData.set('sessions', sessions);
            existingData.set('activeSessions', activeSessions);
            existingData.set('customTargetHours', parseFloat(customTargetHours));
            existingData.set('lastModified', new Date());

            await existingData.save();
            
            this.lastSyncTime = new Date();
            this.updateSyncStatus('synced');

        } catch (error) {
            console.error('Error saving to cloud:', error);
            this.updateSyncStatus('error');
        } finally {
            this.syncInProgress = false;
        }
    }

    async loadFromCloud() {
        try {
            this.showLoading('Loading your data...');
            
            const WorkData = Parse.Object.extend('WorkData');
            const query = new Parse.Query(WorkData);
            query.equalTo('user', this.currentUser);
            
            const workData = await query.first();
            
            if (workData) {
                // Load data from cloud
                const sessions = workData.get('sessions') || [];
                const activeSessions = workData.get('activeSessions') || [];
                const customTargetHours = workData.get('customTargetHours') || 0;

                // Save to localStorage
                localStorage.setItem('workSessions', JSON.stringify(sessions));
                localStorage.setItem('activeSessions', JSON.stringify(activeSessions));
                localStorage.setItem('customTargetHours', customTargetHours.toString());

                this.lastSyncTime = workData.get('lastModified') || new Date();
                this.updateSyncStatus('synced');
            } else {
                // No cloud data, use local data
                this.updateSyncStatus('synced');
            }

        } catch (error) {
            console.error('Error loading from cloud:', error);
            this.updateSyncStatus('error');
            this.showError('Failed to load cloud data. Using local data.');
        } finally {
            this.hideLoading();
        }
    }

    async syncNow() {
        if (this.syncInProgress) return;
        
        try {
            this.updateSyncStatus('syncing');
            
            // Trigger manual sync in the main app if it's loaded
            if (window.workTimeTracker && window.workTimeTracker.loadFromCloud) {
                await window.workTimeTracker.loadFromCloud();
                window.workTimeTracker.updateDisplay();
                this.showSuccess('Data synchronized from cloud!');
            } else {
                this.showError('App not loaded yet');
            }

        } catch (error) {
            console.error('Sync error:', error);
            this.updateSyncStatus('error');
            this.showError('Sync failed. Please try again.');
        }
    }

    setupAutoSync() {
        // Only sync on localStorage changes (debounced), no auto intervals
        const originalSetItem = localStorage.setItem;
        localStorage.setItem = (key, value) => {
            originalSetItem.call(localStorage, key, value);
            
            // Only sync work-related data
            if (key.includes('workSessions') || key.includes('activeSessions') || key.includes('customTargetHours')) {
                // Debounce sync calls - only sync after 5 seconds of inactivity
                clearTimeout(this.syncTimeout);
                this.syncTimeout = setTimeout(() => {
                    this.saveToCloud();
                }, 5000);
            }
        };
    }

    updateSyncStatus(status) {
        const syncStatus = document.getElementById('syncStatus');
        const syncIcon = syncStatus.querySelector('.sync-icon');
        const syncText = syncStatus.querySelector('.sync-text');

        switch (status) {
            case 'syncing':
                syncIcon.textContent = '🔄';
                syncText.textContent = 'Syncing...';
                syncStatus.className = 'sync-status syncing';
                break;
            case 'synced':
                syncIcon.textContent = '☁️';
                syncText.textContent = 'Synced';
                syncStatus.className = 'sync-status synced';
                break;
            case 'error':
                syncIcon.textContent = '⚠️';
                syncText.textContent = 'Sync Error';
                syncStatus.className = 'sync-status error';
                break;
        }
    }

    showLoading(message = 'Loading...') {
        const overlay = document.getElementById('globalLoadingOverlay');
        const text = document.getElementById('loadingText');
        text.textContent = message;
        overlay.style.display = 'flex';
    }

    hideLoading() {
        const overlay = document.getElementById('globalLoadingOverlay');
        overlay.style.display = 'none';
    }

    showSuccess(message) {
        this.showToast(message, 'success');
    }

    showError(message) {
        this.showToast(message, 'error');
    }

    showToast(message, type) {
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        // Style the toast
        Object.assign(toast.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '12px 20px',
            borderRadius: '8px',
            color: 'white',
            fontWeight: '500',
            zIndex: '1000',
            transform: 'translateX(100%)',
            transition: 'transform 0.3s ease-out'
        });

        if (type === 'success') {
            toast.style.background = '#28a745';
        } else {
            toast.style.background = '#dc3545';
        }

        document.body.appendChild(toast);

        // Animate in
        setTimeout(() => {
            toast.style.transform = 'translateX(0)';
        }, 100);

        // Auto remove
        setTimeout(() => {
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => {
                document.body.removeChild(toast);
            }, 300);
        }, 3000);
    }
}

// Expose class for manual instantiation by main app after auth.
window.CloudStorage = CloudStorage;
// NOTE: Do not auto-initialize here to avoid race conditions with auth.
// The main app will instantiate CloudStorage after authentication.
