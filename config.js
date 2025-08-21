// Back4App Configuration
// Your actual Back4App credentials configured!
const CONFIG = {
    APP_ID: 'tyAvoKFtV0Ch3nsecQ5B9ViYhgWTzP4he1F7iiUg',
    JS_KEY: 'uZfh4ZRDSeWRjy31t0n0lRkLbuyJ4rVAARRZWHrF',
    SERVER_URL: 'https://parseapi.back4app.com/'
};

// Initialize Parse
Parse.initialize(CONFIG.APP_ID, CONFIG.JS_KEY);
Parse.serverURL = CONFIG.SERVER_URL;

// Export for use in other files
window.CONFIG = CONFIG;
