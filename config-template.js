// Back4App Configuration Template
// Copy this file to config.js and add your actual credentials

const CONFIG = {
    APP_ID: 'your_back4app_application_id_here',
    JS_KEY: 'your_back4app_javascript_key_here', 
    SERVER_URL: 'https://parseapi.back4app.com/'
};

// Initialize Parse
Parse.initialize(CONFIG.APP_ID, CONFIG.JS_KEY);
Parse.serverURL = CONFIG.SERVER_URL;

// Export for use in other files
window.CONFIG = CONFIG;

// Setup Instructions:
// 1. Get your credentials from Back4App dashboard
// 2. Replace the placeholder values above
// 3. Save this file as config.js
// 4. Test your connection using test-config.html
