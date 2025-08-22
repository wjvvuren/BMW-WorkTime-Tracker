// BMW WorkTime Tracker - Complete Implementation with Cloud Integration
// (c) 2024

class WorkTimeTracker {
	constructor() {
		// Check if we're on login page
		if (window.location.pathname.includes('login.html')) {
			return;
		}

		// Check for redirect loops
		if (sessionStorage.getItem('authRedirectInProgress') === 'true') {
			console.log('Potential redirect loop detected, clearing flag');
			sessionStorage.removeItem('authRedirectInProgress');
		}

		// Check authentication with more robust error handling
		this.performAuthCheck();
	}

	async performAuthCheck() {
		try {
			console.log('Performing authentication check...');

			const isAuth = await this.checkAuthentication();
			if (!isAuth) {
				console.log('Authentication failed, redirecting to login');
				// Add parameter to prevent infinite loops
				window.location.href = 'login.html?from=main-app';
				return;
			}

			console.log('Authentication successful, initializing app');
			
			// Clear any redirect flags
			sessionStorage.removeItem('authRedirectInProgress');
			
			// Initialize the app
			await this.initializeApp();
			
		} catch (error) {
			console.error('Error during authentication check:', error);
			// On any error, redirect to login with error flag
			window.location.href = 'login.html?from=main-app&error=auth-failed';
		}
	}

	async initializeApp() {
		// Initialize cloud storage after auth to avoid races
		this.cloudStorage = window.CloudStorage ? new window.CloudStorage() : null;
		
		// Data will be loaded from cloud, not localStorage
		this.sessions = [];
		this.activeSessions = [];
		this.customTargetHours = 0;
		this.maxHoursPerDay = 10;
		this.mandatoryLunchHours = 5;
		this.lunchDuration = 30; // minutes
		this.userMenuVisible = false;
		
		// Initialize app
		this.initElements();
		this.bindEvents();
		this.setupUserInterface();
		
		// Load data from cloud first, then start app
		await this.initializeFromCloud();
	}

	async initializeFromCloud() {
		try {
			console.log('Initializing app with cloud data...');
			
			// Load data from Back4App
			await this.loadFromCloud();
			
			// Start app functionality
			this.cleanupOldActiveSessions();
			this.updateDisplay();
			this.startPeriodicUpdates();
			this.createParticles();
			
		} catch (error) {
			console.error('Failed to initialize from cloud:', error);
			this.showError('Failed to load data from cloud. Please refresh the page.');
		}
	}

	async loadFromCloud() {
		try {
			const currentUser = Parse.User.current();
			if (!currentUser) {
				throw new Error('No authenticated user');
			}

			console.log('Loading data from Back4App...');
			
			// Query for user's work data
			const WorkData = Parse.Object.extend('WorkData');
			const query = new Parse.Query(WorkData);
			query.equalTo('user', currentUser);
			
			const workData = await query.first();
			
			if (workData) {
				// Load data from cloud
				this.sessions = workData.get('sessions') || [];
				this.activeSessions = workData.get('activeSessions') || [];
				this.customTargetHours = workData.get('customTargetHours') || 0;
				
				console.log('Data loaded from cloud:', {
					sessions: this.sessions.length,
					activeSessions: this.activeSessions.length,
					customTarget: this.customTargetHours
				});
			} else {
				console.log('No existing cloud data found, starting fresh');
				// Create initial cloud data record
				await this.saveToCloud();
			}
			
			return true;
		} catch (error) {
			console.error('Error loading from cloud:', error);
			throw error;
		}
	}

	async saveToCloud() {
		try {
			const currentUser = Parse.User.current();
			if (!currentUser) {
				console.warn('No authenticated user, cannot save to cloud');
				return false;
			}

			console.log('Saving data to Back4App...');

			// Find existing work data or create new
			const WorkData = Parse.Object.extend('WorkData');
			const query = new Parse.Query(WorkData);
			query.equalTo('user', currentUser);
			
			let workData = await query.first();
			
			if (!workData) {
				workData = new WorkData();
				workData.set('user', currentUser);
			}

			// Save current data to cloud
			workData.set('sessions', this.sessions);
			workData.set('activeSessions', this.activeSessions);
			workData.set('customTargetHours', this.customTargetHours);
			workData.set('lastModified', new Date());

			await workData.save();
			
			console.log('Data saved to cloud successfully');
			// Sync status removed
			
			return true;
		} catch (error) {
			console.error('Error saving to cloud:', error);
			// Sync status removed
			return false;
		}
	}

	startPeriodicUpdates() {
		// Update display every second for active session timers
		setInterval(() => this.updateDisplay(), 1000);
		
		// Auto-save to cloud every 30 seconds if there are changes
		setInterval(() => this.autoSaveToCloud(), 30000);
	}

	async autoSaveToCloud() {
		// Only save if there are active sessions or recent changes
		if (this.activeSessions.length > 0 || this.hasRecentChanges) {
			await this.saveToCloud();
			this.hasRecentChanges = false;
		}
	}

	async checkAuthentication() {
		try {
			// Check if Parse is initialized
			if (typeof Parse === 'undefined') {
				console.error('Parse is not defined - config may not be loaded');
				return false;
			}

			const currentUser = Parse.User.current();
			console.log('Main app auth check:', currentUser ? 'User authenticated' : 'No authentication');
			
			if (!currentUser) {
				console.log('No current user found');
				return false;
			}
			
			// Additional check - verify we have a valid session token
			const sessionToken = currentUser.getSessionToken();
			if (!sessionToken) {
				console.log('No session token found, user session may be invalid');
				return false;
			}

			// Verify session by fetching user from server to avoid stale sessions
			try {
				await currentUser.fetch();
				console.log('Authentication check passed (server verified)');
				return true;
			} catch (e) {
				console.warn('Session fetch failed, logging out', e);
				await Parse.User.logOut();
				return false;
			}
		} catch (error) {
			console.error('Authentication check error:', error);
			return false;
		}
	}

	setupUserInterface() {
		const currentUser = Parse.User.current();
		if (currentUser) {
			const userInfo = document.getElementById('userInfo');
			const userName = document.getElementById('userName');
			if (userInfo && userName) {
				userName.textContent = currentUser.get('username') || currentUser.get('email') || 'User';
				userInfo.style.display = 'flex';
			}
		}
	}

	// Remove the old localStorage-based sync methods
	startCloudSync() {
		// This is now handled by the direct cloud methods
		console.log('Using direct cloud storage - no sync needed');
	}

	reloadDataFromStorage() {
		// Data is loaded directly from cloud, this method is deprecated
		console.log('Data loaded directly from cloud - reloadDataFromStorage deprecated');
	}

	initElements() {
		this.els = {
			// User interface elements
			userInfo: document.getElementById('userInfo'),
			userName: document.getElementById('userName'),
			userMenuBtn: document.getElementById('userMenuBtn'),
			userMenu: document.getElementById('userMenu'),
			loadingOverlay: document.getElementById('loadingOverlay'),
			
			// Existing elements
			currentDate: document.getElementById('currentDate'),
			currentSessionTime: document.getElementById('currentSessionTime'),
			sessionStatus: document.getElementById('sessionStatus'),
			totalHoursToday: document.getElementById('totalHoursToday'),
			billableHoursToday: document.getElementById('billableHoursToday'),
			lunchDeductionStatus: document.getElementById('lunchDeductionStatus'),
			timeRemaining: document.getElementById('timeRemaining'),
			maxClockOut: document.getElementById('maxClockOut'),
			countdownCard: document.getElementById('countdownCard'),
			manualEntryBtn: document.getElementById('manualEntryBtn'),
			lunchAlert: document.getElementById('lunchAlert'),
			activeSessionsSection: document.getElementById('activeSessionsSection'),
			activeSessionsList: document.getElementById('activeSessionsList'),
			sessionsList: document.getElementById('sessionsList'),
			sessionsCount: document.getElementById('sessionsCount'),
			breaksCount: document.getElementById('breaksCount'),
			efficiency: document.getElementById('efficiency'),
			resetBtn: document.getElementById('resetBtn'),
			modalOverlay: document.getElementById('modalOverlay'),
			modalClose: document.getElementById('modalClose'),
			// Custom Target Modal
			customTargetModal: document.getElementById('customTargetModal'),
			customTargetModalClose: document.getElementById('customTargetModalClose'),
			customTargetHours: document.getElementById('customTargetHours'),
			cancelCustomTarget: document.getElementById('cancelCustomTarget'),
			clearCustomTarget: document.getElementById('clearCustomTarget'),
			saveCustomTarget: document.getElementById('saveCustomTarget'),
			entryType: document.getElementById('entryType'),
			entryDate: document.getElementById('entryDate'),
			activeSessionSelect: document.getElementById('activeSessionSelect'),
			selectActiveSession: document.getElementById('selectActiveSession'),
			newSessionFields: document.getElementById('newSessionFields'),
			checkOutOnlyFields: document.getElementById('checkOutOnlyFields'),
			checkInTime: document.getElementById('checkInTime'),
			checkOutTime: document.getElementById('checkOutTime'),
			checkOutTimeOnly: document.getElementById('checkOutTimeOnly'),
			sessionType: document.getElementById('sessionType'),
			sessionDuration: document.getElementById('sessionDuration'),
			durationGroup: document.getElementById('durationGroup'),
			cancelEntry: document.getElementById('cancelEntry'),
			saveEntry: document.getElementById('saveEntry'),
		};
		// Set current date
		this.els.currentDate.textContent = new Date().toLocaleDateString('en-US', {
			weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
		});
		// Default modal date
		if (this.els.entryDate) this.els.entryDate.value = new Date().toISOString().split('T')[0];
	}

	bindEvents() {
		// Main functionality events
		this.els.manualEntryBtn.addEventListener('click', () => this.openManualEntry());
		this.els.resetBtn.addEventListener('click', () => this.resetDay());
		this.els.modalClose.addEventListener('click', () => this.closeManualEntry());
		this.els.cancelEntry.addEventListener('click', () => this.closeManualEntry());
		this.els.saveEntry.addEventListener('click', () => this.saveManualEntry());
		this.els.modalOverlay.addEventListener('click', (e) => {
			if (e.target === this.els.modalOverlay) this.closeManualEntry();
		});
		this.els.entryType.addEventListener('change', () => this.handleEntryTypeChange());
		this.els.entryDate.addEventListener('change', () => {
			if (this.els.entryType.value === 'check-out-only') this.populateActiveSessionSelect();
		});
		this.els.checkOutTime.addEventListener('input', () => this.handleCheckOutTimeChange());
		
		// User interface events
		if (this.els.userMenuBtn) {
			this.els.userMenuBtn.addEventListener('click', (e) => {
				e.stopPropagation();
				this.toggleUserMenu();
			});
		}

		// Close user menu when clicking outside
		document.addEventListener('click', (e) => {
			if (this.userMenuVisible && !this.els.userMenu.contains(e.target)) {
				this.hideUserMenu();
			}
		});

		// Menu item handlers
		document.addEventListener('click', (e) => {
			if (e.target.classList.contains('menu-item')) {
				const action = e.target.dataset.action;
				this.handleMenuAction(action);
			}
		});
		
		// Preset button functionality removed
	}

	// --- User Interface Methods ---
	toggleUserMenu() {
		if (this.userMenuVisible) {
			this.hideUserMenu();
		} else {
			this.showUserMenu();
		}
	}

	showUserMenu() {
		if (this.els.userMenu) {
			this.els.userMenu.style.display = 'block';
			this.userMenuVisible = true;
		}
	}

	hideUserMenu() {
		if (this.els.userMenu) {
			this.els.userMenu.style.display = 'none';
			this.userMenuVisible = false;
		}
	}

	handleMenuAction(action) {
		this.hideUserMenu();
		
		switch (action) {
			case 'sync':
				this.forceSync();
				break;
			case 'settings':
				this.openSettings();
				break;
			case 'logout':
				this.logout();
				break;
		}
	}

	forceSync() {
		if (this.cloudStorage && typeof this.cloudStorage.syncNow === 'function') {
			this.showLoading('Syncing data...');
			this.cloudStorage.syncNow().finally(() => this.hideLoading());
		}
	}

	openSettings() {
		// Future: Open settings modal
		alert('Settings coming soon!');
	}

	async logout() {
		if (confirm('Are you sure you want to logout?')) {
			this.showLoading('Logging out...');
			try {
				await Parse.User.logOut();
				window.location.href = 'login.html';
			} catch (error) {
				this.hideLoading();
				alert('Error logging out: ' + error.message);
			}
		}
	}

	showLoading(message = 'Loading...') {
		if (this.els.loadingOverlay) {
			const loadingText = this.els.loadingOverlay.querySelector('p');
			if (loadingText) {
				loadingText.textContent = message;
			}
			this.els.loadingOverlay.style.display = 'flex';
		}
	}

	hideLoading() {
		if (this.els.loadingOverlay) {
			this.els.loadingOverlay.style.display = 'none';
		}
	}

	// Sync status functionality removed

	// --- Core Actions ---
	completeAllSessions() {
		if (this.activeSessions.length === 0) return alert('No active sessions to complete.');
		const now = new Date();
		this.activeSessions.forEach(session => this.completeSession(session, now));
		this.activeSessions = [];
		this.hasRecentChanges = true;
		this.saveToCloud();
		this.updateDisplay();
	}

	completeSpecificSession(sessionId) {
		const idx = this.activeSessions.findIndex(s => s.id === sessionId);
		if (idx === -1) return;
		const now = new Date();
		const session = this.activeSessions[idx];
		this.completeSession(session, now);
		this.sessions.push(session);
		this.activeSessions.splice(idx, 1);
		this.hasRecentChanges = true;
		this.saveToCloud();
		this.updateDisplay();
	}

	completeSession(session, endTime) {
		session.checkOut = endTime;
		session.duration = this.calculateDuration(session.checkIn, endTime);
		session.isActive = false;
		if (session.type === 'work' && session.duration / 3600 > this.mandatoryLunchHours) {
			session.hasAutoLunch = true;
			this.showLunchAlert();
		}
	}

	// --- Manual Entry Modal ---
	openManualEntry() {
		this.els.modalOverlay.style.display = 'flex';
		this.els.entryType.value = 'new-session';
		this.handleEntryTypeChange();
		const now = new Date();
		this.els.checkInTime.value = now.toTimeString().slice(0,5);
		this.els.checkOutTime.value = '';
		this.els.checkOutTimeOnly.value = now.toTimeString().slice(0,5);
		this.els.sessionDuration.value = '';
		this.els.durationGroup.style.display = 'none';
	}
	closeManualEntry() {
		this.els.modalOverlay.style.display = 'none';
		this.resetManualEntryForm();
	}
	resetManualEntryForm() {
		this.els.entryType.value = 'new-session';
		this.els.checkInTime.value = '';
		this.els.checkOutTime.value = '';
		this.els.checkOutTimeOnly.value = '';
		this.els.sessionDuration.value = '';
		this.els.sessionType.value = 'work';
		this.els.durationGroup.style.display = 'none';
		this.els.newSessionFields.style.display = 'block';
		this.els.checkOutOnlyFields.style.display = 'none';
		this.els.activeSessionSelect.style.display = 'none';
	}
	handleEntryTypeChange() {
		const entryType = this.els.entryType.value;
		if (entryType === 'check-out-only') {
			this.els.newSessionFields.style.display = 'none';
			this.els.checkOutOnlyFields.style.display = 'block';
			this.els.activeSessionSelect.style.display = 'block';
			this.populateActiveSessionSelect();
		} else {
			this.els.newSessionFields.style.display = 'block';
			this.els.checkOutOnlyFields.style.display = 'none';
			this.els.activeSessionSelect.style.display = 'none';
		}
	}
	handleCheckOutTimeChange() {
		if (this.els.checkOutTime.value) {
			this.els.durationGroup.style.display = 'none';
			this.els.sessionDuration.value = '';
		} else {
			this.els.durationGroup.style.display = 'block';
		}
	}
	populateActiveSessionSelect() {
		const today = this.els.entryDate.value;
		const todayString = new Date(today).toDateString();
		const relevant = this.activeSessions.filter(s => new Date(s.checkIn).toDateString() === todayString);
		this.els.selectActiveSession.innerHTML = '';
		if (relevant.length === 0) {
			this.els.selectActiveSession.innerHTML = '<option value="">No active sessions for this date</option>';
		} else {
			relevant.forEach(session => {
				const startTime = new Date(session.checkIn).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
				const option = document.createElement('option');
				option.value = session.id;
				option.textContent = `${session.type.toUpperCase()} - Started ${startTime}`;
				this.els.selectActiveSession.appendChild(option);
			});
		}
	}
	saveManualEntry() {
		const entryType = this.els.entryType.value;
		if (entryType === 'check-out-only') {
			this.handleCheckOutOnly();
		} else {
			this.handleNewSession();
		}
	}
	async handleCheckOutOnly() {
		const sessionId = parseInt(this.els.selectActiveSession.value);
		const checkOutTime = this.els.checkOutTimeOnly.value;
		const date = this.els.entryDate.value;
		
		if (!sessionId || !checkOutTime) return alert('Select an active session and check-out time.');
		
		const idx = this.activeSessions.findIndex(s => s.id === sessionId);
		if (idx === -1) return alert('Session not found.');
		
		const session = this.activeSessions[idx];
		const checkOutDateTime = new Date(`${date}T${checkOutTime}`);
		
		if (checkOutDateTime <= new Date(session.checkIn)) return alert('Check out must be after check in.');
		
		this.completeSession(session, checkOutDateTime);
		session.isManualEntry = true;
		
		// Move from active to completed sessions
		this.sessions.push(session);
		this.activeSessions.splice(idx, 1);
		
		// Save to cloud immediately
		this.hasRecentChanges = true;
		await this.saveToCloud();
		
		this.closeManualEntry();
		this.updateDisplay();
		
		this.showSuccess('Session completed and saved to cloud');
	}
	async handleNewSession() {
		const date = this.els.entryDate.value;
		const checkInTime = this.els.checkInTime.value;
		const checkOutTime = this.els.checkOutTime.value;
		const sessionType = this.els.sessionType.value;
		const sessionDuration = parseFloat(this.els.sessionDuration.value);
		
		console.log('Creating new session with:', {
			date, checkInTime, checkOutTime, sessionType, sessionDuration
		});
		
		if (!date || !checkInTime) return alert('Fill in date and check-in time.');
		const checkInDateTime = new Date(`${date}T${checkInTime}`);
		
		if (!checkOutTime && !sessionDuration) {
			// Create active session
			const activeSession = {
				id: Date.now(),
				checkIn: checkInDateTime,
				type: sessionType,
				isActive: true,
				isManualEntry: true
			};
			console.log('Adding active session:', activeSession);
			this.activeSessions.push(activeSession);
			
			// Save to cloud immediately
			this.hasRecentChanges = true;
			await this.saveToCloud();
			
			this.closeManualEntry();
			this.updateDisplay();
			this.showSuccess('Active session started and saved to cloud');
			return;
		}
		
		// Completed session
		let checkOutDateTime, duration;
		if (checkOutTime) {
			checkOutDateTime = new Date(`${date}T${checkOutTime}`);
			if (checkOutDateTime <= checkInDateTime) return alert('Check out must be after check in.');
			duration = this.calculateDuration(checkInDateTime, checkOutDateTime);
		} else {
			if (sessionDuration <= 0 || sessionDuration > 12) return alert('Duration must be 0.25-12 hours.');
			duration = sessionDuration * 3600;
			checkOutDateTime = new Date(checkInDateTime.getTime() + (duration * 1000));
		}
		
		const newSession = {
			id: Date.now(),
			checkIn: checkInDateTime,
			checkOut: checkOutDateTime,
			duration: duration,
			type: sessionType,
			isManualEntry: true,
			isActive: false
		};
		
		if (duration / 3600 > this.mandatoryLunchHours && sessionType === 'work') {
			newSession.hasAutoLunch = true;
		}
		
		console.log('Adding completed session:', newSession);
		this.sessions.push(newSession);
		this.sessions.sort((a, b) => new Date(a.checkIn) - new Date(b.checkIn));
		
		// Save to cloud immediately
		this.hasRecentChanges = true;
		await this.saveToCloud();
		
		this.closeManualEntry();
		this.updateDisplay();
		
		// Show confirmation
		this.showSuccess(`Session added: ${this.formatTime(duration)} on ${date}`);
	}

	// --- Utility Functions ---
	showSuccess(message) {
		this.showNotification(message, 'success');
	}
	
	showError(message) {
		this.showNotification(message, 'error');
	}
	
	showNotification(message, type = 'info') {
		// Remove any existing notifications
		const existingNotification = document.querySelector('.notification');
		if (existingNotification) {
			existingNotification.remove();
		}
		
		// Create notification element
		const notification = document.createElement('div');
		notification.className = `notification ${type}`;
		notification.innerHTML = `
			<span class="notification-message">${message}</span>
			<button class="notification-close">&times;</button>
		`;
		
		// Add to body
		document.body.appendChild(notification);
		
		// Auto-remove after 5 seconds
		setTimeout(() => {
			if (notification.parentNode) {
				notification.remove();
			}
		}, 5000);
		
		// Manual close
		notification.querySelector('.notification-close').addEventListener('click', () => {
			notification.remove();
		});
	}

	// --- Time Calculations ---
	calculateDuration(start, end) {
		if (!start || !end) return 0;
		const s = new Date(start).getTime();
		const e = new Date(end).getTime();
		if (isNaN(s) || isNaN(e)) return 0;
		return Math.floor((e - s) / 1000);
	}
	formatTime(seconds) {
		if (isNaN(seconds) || seconds < 0) return '00:00:00';
		const h = Math.floor(seconds / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		const s = seconds % 60;
		return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
	}
	getCurrentSessionTime() {
		if (this.activeSessions.length === 0) return 0;
		const now = new Date();
		let total = 0;
		this.activeSessions.forEach(session => {
			total += this.calculateDuration(session.checkIn, now);
		});
		return total;
	}
	getTotalTimeToday() {
		const today = new Date().toDateString();
		let total = 0;
		this.sessions.forEach(session => {
			if (new Date(session.checkIn).toDateString() === today) total += session.duration || 0;
		});
		const now = new Date();
		this.activeSessions.forEach(session => {
			if (new Date(session.checkIn).toDateString() === today) total += this.calculateDuration(session.checkIn, now);
		});
		return total;
	}
	getBillableHoursToday() {
		const today = new Date().toDateString();
		let totalWork = 0, autoLunch = 0;
		this.sessions.forEach(session => {
			if (new Date(session.checkIn).toDateString() === today && session.type === 'work') {
				totalWork += session.duration || 0;
				if (session.hasAutoLunch) autoLunch += this.lunchDuration * 60;
			}
		});
		const now = new Date();
		this.activeSessions.forEach(session => {
			if (new Date(session.checkIn).toDateString() === today && session.type === 'work') {
				const dur = this.calculateDuration(session.checkIn, now);
				totalWork += dur;
				if (dur / 3600 > this.mandatoryLunchHours) autoLunch += this.lunchDuration * 60;
			}
		});
		return {
			billableSeconds: Math.max(0, totalWork - autoLunch),
			rawWorkSeconds: totalWork,
			lunchDeductions: autoLunch
		};
	}

	// --- Custom Target Methods Removed ---

	// --- Display Updates ---
	updateDisplay() {
		// Current session time
		this.els.currentSessionTime.textContent = this.formatTime(this.getCurrentSessionTime());
		this.updateSessionStatus();
		const totalTime = this.getTotalTimeToday();
		const billableInfo = this.getBillableHoursToday();
		this.els.totalHoursToday.textContent = this.formatTime(totalTime);
		this.els.billableHoursToday.textContent = this.formatTime(billableInfo.billableSeconds);
		if (billableInfo.lunchDeductions > 0) {
			this.els.lunchDeductionStatus.textContent = `${billableInfo.lunchDeductions/60} min lunch deducted`;
		} else {
			this.els.lunchDeductionStatus.textContent = 'No lunch deduction yet';
		}
		this.updateProgressAndCountdown(billableInfo.billableSeconds);
		this.updateActiveSessionsDisplay();
		this.updateSessionsList();
		this.updateStatistics();
	}
	updateSessionStatus() {
		if (this.activeSessions.length > 0) {
			const now = new Date();
			let statusParts = [];
			this.activeSessions.forEach(session => {
				const dur = this.calculateDuration(session.checkIn, now);
				if (session.type === 'work' && dur/3600 > this.mandatoryLunchHours) {
					statusParts.push(`${session.type} (lunch will be deducted)`);
				} else {
					statusParts.push(session.type);
				}
			});
			this.els.sessionStatus.textContent = `Active: ${statusParts.join(', ')}`;
		} else {
			this.els.sessionStatus.textContent = 'No active sessions';
		}
	}
	updateProgressAndCountdown(billableSeconds) {
		const maxSeconds = this.maxHoursPerDay * 3600; // 10 hours for countdown calculations
		const remainingBillableTime = maxSeconds - billableSeconds;
		
		// Show countdown card if there are any sessions today or active sessions
		const today = new Date().toDateString();
		const hasSessionsToday = this.sessions.some(s => new Date(s.checkIn).toDateString() === today) || this.activeSessions.length > 0;
		
		if (hasSessionsToday || billableSeconds > 0) {
			this.els.countdownCard.style.display = 'block';
			
			// Calculate actual work time remaining (accounting for lunch deduction)
			let actualWorkTimeRemaining = remainingBillableTime;
			
			if (this.activeSessions.length > 0) {
				const now = new Date();
				
				// Check if we haven't hit the 5-hour threshold yet for active work sessions
				const currentWorkTime = this.getBillableHoursToday().rawWorkSeconds;
				const mandatoryLunchSeconds = this.mandatoryLunchHours * 3600;
				
				// If we haven't reached 5 hours of work yet, we need to account for the future lunch deduction
				if (currentWorkTime < mandatoryLunchSeconds && remainingBillableTime > 0) {
					// We'll need 30 extra minutes to compensate for the lunch deduction
					actualWorkTimeRemaining += (this.lunchDuration * 60);
				}
				
				const latestClockOut = new Date(now.getTime() + (actualWorkTimeRemaining * 1000));
				this.els.maxClockOut.textContent = latestClockOut.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
			} else {
				this.els.maxClockOut.textContent = 'N/A';
			}
			
			// Show the actual work time remaining (not just billable time)
			this.els.timeRemaining.textContent = this.formatTime(Math.max(actualWorkTimeRemaining, 0));
			
			if (actualWorkTimeRemaining <= 3600) {
				this.els.countdownCard.style.borderColor = '#dc3545';
				this.els.timeRemaining.style.color = '#dc3545';
			} else if (actualWorkTimeRemaining <= 7200) {
				this.els.countdownCard.style.borderColor = '#fd7e14';
				this.els.timeRemaining.style.color = '#fd7e14';
			} else {
				this.els.countdownCard.style.borderColor = '';
				this.els.timeRemaining.style.color = '';
			}
		} else {
			this.els.countdownCard.style.display = 'none';
		}
	}
	updateActiveSessionsDisplay() {
		if (this.activeSessions.length === 0) {
			this.els.activeSessionsSection.style.display = 'none';
			return;
		}
		this.els.activeSessionsSection.style.display = 'block';
		const now = new Date();
		this.els.activeSessionsList.innerHTML = this.activeSessions.map(session => {
			const startTime = new Date(session.checkIn).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
			const dur = this.calculateDuration(session.checkIn, now);
			let statusText = '';
			if (session.type === 'work' && dur/3600 > this.mandatoryLunchHours) statusText = ' (30min lunch will be deducted)';
			return `
				<div class="active-session-item">
					<div class="active-session-info">
						<h4>${session.type.toUpperCase()} Session${statusText}</h4>
						<div class="active-session-time">Started: ${startTime}</div>
						<div class="active-session-duration">Duration: ${this.formatTime(dur)}</div>
					</div>
					<button class="complete-btn" onclick="tracker.completeSpecificSession(${session.id})">Complete</button>
				</div>
			`;
		}).join('');
	}
	updateSessionsList() {
		const today = new Date().toDateString();
		const todaySessions = this.sessions.filter(s => new Date(s.checkIn).toDateString() === today);
		if (todaySessions.length === 0) {
			this.els.sessionsList.innerHTML = '<div class="no-sessions">No sessions recorded today</div>';
			return;
		}
		this.els.sessionsList.innerHTML = todaySessions.map(session => {
			const checkInTime = new Date(session.checkIn).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
			const checkOutTime = session.checkOut ? new Date(session.checkOut).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : '--:--';
			const duration = this.formatTime(session.duration);
			let sessionInfo = `${checkInTime} - ${checkOutTime}`;
			if (session.isManualEntry) sessionInfo += ' (Manual)';
			let durationInfo = `Duration: ${duration}`;
			if (session.hasAutoLunch && session.type === 'work') durationInfo += ' (30min lunch deducted)';
			return `
				<div class="session-item">
					<div class="session-info">
						<div class="session-time">${sessionInfo}</div>
						<div class="session-duration">${durationInfo}</div>
					</div>
					<div class="session-type ${session.type}">${session.type.toUpperCase()}</div>
				</div>
			`;
		}).join('');
	}
	updateStatistics() {
		const today = new Date().toDateString();
		const todaySessions = this.sessions.filter(s => new Date(s.checkIn).toDateString() === today);
		const workSessions = todaySessions.filter(s => s.type === 'work');
		const lunchSessions = todaySessions.filter(s => s.type === 'lunch');
		const autoLunchSessions = todaySessions.filter(s => s.hasAutoLunch);
		const activeWorkSessions = this.activeSessions.filter(s => s.type === 'work');
		this.els.sessionsCount.textContent = workSessions.length + activeWorkSessions.length;
		this.els.breaksCount.textContent = lunchSessions.length + autoLunchSessions.length;
		const totalTime = this.getTotalTimeToday();
		const billableInfo = this.getBillableHoursToday();
		const efficiency = totalTime > 0 ? Math.round((billableInfo.billableSeconds / totalTime) * 100) : 100;
		this.els.efficiency.textContent = `${efficiency}%`;
	}

	// --- Utility ---
	cleanupOldActiveSessions() {
		const today = new Date().toDateString();
		const todaysActive = this.activeSessions.filter(s => new Date(s.checkIn).toDateString() === today);
		const oldActive = this.activeSessions.filter(s => new Date(s.checkIn).toDateString() !== today);
		oldActive.forEach(session => {
			if (!session.checkOut) {
				const endOfDay = new Date(session.checkIn);
				endOfDay.setHours(23,59,59);
				this.completeSession(session, endOfDay);
			}
			this.sessions.push(session);
		});
		this.activeSessions = todaysActive;
		this.hasRecentChanges = true;
		this.saveToCloud();
	}
	showLunchAlert() {
		this.els.lunchAlert.style.display = 'block';
		setTimeout(() => {
			this.els.lunchAlert.style.display = 'none';
		}, 5000);
	}
	async resetDay() {
		if (confirm('Are you sure you want to reset today\'s data? This cannot be undone.')) {
			const today = new Date().toDateString();
			const initialSessionCount = this.sessions.length;
			const initialActiveCount = this.activeSessions.length;
			
			this.sessions = this.sessions.filter(s => new Date(s.checkIn).toDateString() !== today);
			this.activeSessions = this.activeSessions.filter(s => new Date(s.checkIn).toDateString() !== today);
			
			// Save to cloud immediately
			this.hasRecentChanges = true;
			await this.saveToCloud();
			
			this.updateDisplay();
			
			const removedSessions = (initialSessionCount - this.sessions.length) + (initialActiveCount - this.activeSessions.length);
			this.showSuccess(`Reset complete - removed ${removedSessions} session(s) from today`);
		}
	}

	// Old localStorage methods removed - now using direct cloud storage

	// --- BMW Particles and Animations ---
	createParticles() {
		const particlesContainer = document.getElementById('particles');
		if (!particlesContainer) return;
		
		// Create animated background pattern
		const patternDiv = document.createElement('div');
		patternDiv.className = 'bmw-pattern';
		document.body.appendChild(patternDiv);
		
		// Create various particle types
		this.createFloatingParticles(particlesContainer);
		this.createSpeedLines(particlesContainer);
		this.createRacingStreaks();
		this.addInteractiveEffects();
		
		// Add dynamic progress bar animations
		this.enhanceProgressBar();
	}
	
	createFloatingParticles(container) {
		const particleCount = 15;
		for (let i = 0; i < particleCount; i++) {
			const particle = document.createElement('div');
			particle.className = 'particle bmw-blue';
			const size = Math.random() * 6 + 3;
			const x = Math.random() * window.innerWidth;
			const y = Math.random() * window.innerHeight;
			const delay = Math.random() * 8;
			
			particle.style.width = `${size}px`;
			particle.style.height = `${size}px`;
			particle.style.left = `${x}px`;
			particle.style.top = `${y}px`;
			particle.style.animationDelay = `${delay}s`;
			
			container.appendChild(particle);
		}
	}
	
	createSpeedLines(container) {
		const speedLineCount = 8;
		for (let i = 0; i < speedLineCount; i++) {
			const speedLine = document.createElement('div');
			speedLine.className = 'particle speed-line';
			const y = Math.random() * window.innerHeight;
			const delay = Math.random() * 6;
			
			speedLine.style.top = `${y}px`;
			speedLine.style.animationDelay = `${delay}s`;
			
			container.appendChild(speedLine);
		}
	}
	
	createRacingStreaks() {
		setInterval(() => {
			if (Math.random() > 0.7) { // 30% chance every interval
				const streak = document.createElement('div');
				streak.className = 'racing-streak';
				streak.style.top = Math.random() * window.innerHeight + 'px';
				document.body.appendChild(streak);
				
				setTimeout(() => {
					streak.remove();
				}, 2000);
			}
		}, 3000);
	}
	
	addInteractiveEffects() {
		// Logo click animation
		const logo = document.querySelector('.logo-circle');
		if (logo) {
			logo.addEventListener('click', () => {
				logo.style.animation = 'none';
				logo.offsetHeight; // Trigger reflow
				logo.style.animation = 'logoSpinFast 1s cubic-bezier(0.4, 0, 0.2, 1)';
				this.createClickSpark(logo);
			});
		}
		
		// Button hover effects
		document.querySelectorAll('.action-btn').forEach(btn => {
			btn.addEventListener('mouseenter', () => {
				this.createButtonGlow(btn);
			});
		});
		
		// Card hover animations
		document.querySelectorAll('.time-card').forEach(card => {
			card.addEventListener('mouseenter', () => {
				this.createCardSparkle(card);
			});
		});
	}
	
	enhanceProgressBar() {
		const progressBar = document.querySelector('.progress-bar');
		if (progressBar) {
			progressBar.classList.add('lunch-progress');
			
			// Add racing track effect
			progressBar.style.background = `
				linear-gradient(90deg, 
					#f0f0f0 0%, 
					#e0e0e0 25%, 
					#f0f0f0 50%, 
					#e0e0e0 75%, 
					#f0f0f0 100%
				),
				repeating-linear-gradient(90deg, 
					transparent, 
					transparent 10px, 
					rgba(0,102,204,0.1) 10px, 
					rgba(0,102,204,0.1) 12px
				)
			`;
		}
	}
	
	createClickSpark(element) {
		const rect = element.getBoundingClientRect();
		const centerX = rect.left + rect.width / 2;
		const centerY = rect.top + rect.height / 2;
		
		for (let i = 0; i < 8; i++) {
			const spark = document.createElement('div');
			spark.style.position = 'fixed';
			spark.style.left = centerX + 'px';
			spark.style.top = centerY + 'px';
			spark.style.width = '4px';
			spark.style.height = '4px';
			spark.style.background = '#0066CC';
			spark.style.borderRadius = '50%';
			spark.style.pointerEvents = 'none';
			spark.style.zIndex = '1000';
			
			const angle = (i / 8) * 2 * Math.PI;
			const distance = 50;
			const endX = Math.cos(angle) * distance;
			const endY = Math.sin(angle) * distance;
			
			spark.style.animation = `sparkFly 0.6s ease-out forwards`;
			spark.style.setProperty('--endX', endX + 'px');
			spark.style.setProperty('--endY', endY + 'px');
			
			document.body.appendChild(spark);
			
			setTimeout(() => spark.remove(), 600);
		}
	}
	
	createButtonGlow(button) {
		const glow = document.createElement('div');
		glow.style.position = 'absolute';
		glow.style.top = '-5px';
		glow.style.left = '-5px';
		glow.style.right = '-5px';
		glow.style.bottom = '-5px';
		glow.style.background = 'linear-gradient(45deg, #0066CC, #3388DD)';
		glow.style.borderRadius = '55px';
		glow.style.opacity = '0.3';
		glow.style.animation = 'glowPulse 1s ease-in-out';
		glow.style.zIndex = '-1';
		
		button.style.position = 'relative';
		button.appendChild(glow);
		
		setTimeout(() => glow.remove(), 1000);
	}
	
	createCardSparkle(card) {
		const sparkle = document.createElement('div');
		sparkle.innerHTML = '✨';
		sparkle.style.position = 'absolute';
		sparkle.style.top = Math.random() * 50 + '%';
		sparkle.style.left = Math.random() * 50 + '%';
		sparkle.style.fontSize = '20px';
		sparkle.style.animation = 'sparkleFloat 2s ease-out forwards';
		sparkle.style.pointerEvents = 'none';
		sparkle.style.zIndex = '10';
		
		card.style.position = 'relative';
		card.appendChild(sparkle);
		
		setTimeout(() => sparkle.remove(), 2000);
	}
}

// Initialize
let tracker;
document.addEventListener('DOMContentLoaded', () => {
	// Make app globally accessible for cloud sync
	window.workTimeTracker = new WorkTimeTracker();
});
