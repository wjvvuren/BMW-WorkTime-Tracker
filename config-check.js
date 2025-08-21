// Configuration Check Script for BMW WorkTime Tracker
// Run this in the browser console to verify your setup

console.log('🚗 BMW WorkTime Tracker - Configuration Check');
console.log('===========================================');

// Check if Parse is loaded
if (typeof Parse !== 'undefined') {
    console.log('✅ Parse SDK is loaded');
} else {
    console.log('❌ Parse SDK is not loaded - check your HTML includes');
    return;
}

// Check if CONFIG is defined
if (typeof CONFIG !== 'undefined') {
    console.log('✅ CONFIG object is defined');
    
    // Check individual config values
    if (CONFIG.APP_ID && CONFIG.APP_ID !== 'YOUR_APPLICATION_ID_HERE') {
        console.log('✅ APP_ID is configured');
    } else {
        console.log('❌ APP_ID is not configured - check config.js');
    }
    
    if (CONFIG.JS_KEY && CONFIG.JS_KEY !== 'YOUR_JAVASCRIPT_KEY_HERE') {
        console.log('✅ JS_KEY is configured');
    } else {
        console.log('❌ JS_KEY is not configured - check config.js');
    }
    
    if (CONFIG.SERVER_URL && CONFIG.SERVER_URL.includes('back4app')) {
        console.log('✅ SERVER_URL is configured');
    } else {
        console.log('❌ SERVER_URL is not configured - check config.js');
    }
} else {
    console.log('❌ CONFIG object is not defined - check config.js');
    return;
}

// Test Parse connection
console.log('\n🔍 Testing Parse connection...');
Parse.Cloud.run('test').then(
    result => console.log('✅ Parse connection successful'),
    error => {
        if (error.code === 141) {
            console.log('✅ Parse connection successful (function not found is expected)');
        } else {
            console.log('❌ Parse connection failed:', error.message);
        }
    }
);

// Check if CloudStorage is available
if (typeof CloudStorage !== 'undefined') {
    console.log('✅ CloudStorage class is available');
} else {
    console.log('❌ CloudStorage class is not available - check cloud-storage.js');
}

// Check if AuthSystem is available (if on login page)
if (window.location.pathname.includes('login.html')) {
    if (typeof AuthSystem !== 'undefined') {
        console.log('✅ AuthSystem class is available');
    } else {
        console.log('❌ AuthSystem class is not available - check auth.js');
    }
}

// Check local storage
try {
    localStorage.setItem('test', 'test');
    localStorage.removeItem('test');
    console.log('✅ Local storage is working');
} catch (e) {
    console.log('❌ Local storage is not working');
}

console.log('\n📝 Setup Status Summary:');
console.log('========================');
console.log('If you see any ❌ errors above, please:');
console.log('1. Check that all files are in the same folder');
console.log('2. Verify your config.js has the correct Back4App credentials');
console.log('3. Make sure you\'re accessing via HTTP/HTTPS (not file://)');
console.log('4. Follow the setup-guide.md for detailed instructions');
console.log('\n🎉 If all checks passed, your app is ready to use!');
