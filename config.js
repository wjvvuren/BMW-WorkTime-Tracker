// Back4App Configuration
// SECURITY NOTE: These are public client keys for Back4App JavaScript SDK
// These keys are designed to be exposed in client-side applications
// However, for production apps, you should still implement proper security measures

const CONFIG = {
    // These are Back4App PUBLIC client keys - safe for client-side use
    APP_ID: 'tyAvoKFtV0Ch3nsecQ5B9ViYhgWTzP4he1F7iiUg',
    JS_KEY: 'uZfh4ZRDSeWRjy31t0n0lRkLbuyJ4rVAARRZWHrF',
    SERVER_URL: 'https://parseapi.back4app.com/'
};

// Initialize Parse with error handling
try {
    Parse.initialize(CONFIG.APP_ID, CONFIG.JS_KEY);
    Parse.serverURL = CONFIG.SERVER_URL;
    console.log('Parse initialized successfully');
} catch (error) {
    console.error('Failed to initialize Parse:', error);
}

// Export for use in other files
window.CONFIG = CONFIG;
