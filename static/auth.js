let currentLoginMethod = 'gmail';
let currentRegisterMethod = 'gmail';
let generatedOtp = {};

// Parse tab parameters if present
const params = new URLSearchParams(window.location.search);
if(params.get('tab') === 'register') { switchTab('register'); }

function switchTab(tab) {
  const isLogin = tab === 'login';
  document.getElementById('tab-login').classList.toggle('active', isLogin);
  document.getElementById('tab-register').classList.toggle('active', !isLogin);
  document.getElementById('form-login').classList.toggle('hidden', !isLogin);
  document.getElementById('form-register').classList.toggle('hidden', isLogin);
}

function switchMethod(scope, method) {
  const prefix = scope === 'login' ? 'login' : 'reg';
  if (scope === 'login') currentLoginMethod = method;
  else currentRegisterMethod = method;

  document.getElementById(`${prefix}-m-gmail`).classList.toggle('active', method === 'gmail');
  document.getElementById(`${prefix}-m-mobile`).classList.toggle('active', method === 'mobile');
  document.getElementById(`${prefix}-gmail-panel`).classList.toggle('hidden', method !== 'gmail');
  document.getElementById(`${prefix}-mobile-panel`).classList.toggle('hidden', method !== 'mobile');
}

// Simulated OTP Generator
function sendOtp(scope) {
  const prefix = scope === 'login' ? 'login' : 'reg';
  const phoneInput = document.getElementById(`${prefix}-phone`).value.trim();

  if (!phoneInput || phoneInput.length < 10) {
    alert("Please enter a valid 10-digit mobile number.");
    return;
  }

  // Generate random 6-digit OTP code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  generatedOtp[scope] = code;

  document.getElementById(`${prefix}-phone-step`).classList.add('hidden');
  document.getElementById(`${prefix}-otp-step`).classList.remove('hidden');
  
  document.getElementById(`${prefix}-otp-demo-hint`).innerText = `[Demo Mode] OTP sent to +91 ${phoneInput}. Code: ${code}`;
}

// Database helper functions (using localStorage)
function getUsersDatabase() {
  return JSON.parse(localStorage.getItem('ss_users_db') || '{}');
}

function saveUsersDatabase(db) {
  localStorage.setItem('ss_users_db', JSON.stringify(db));
}

// Auth Submission Handler
function handleAuthSubmit(event, scope) {
  event.preventDefault();

  const method = scope === 'login' ? currentLoginMethod : currentRegisterMethod;
  const prefix = scope === 'login' ? 'login' : 'reg';
  const db = getUsersDatabase();

  // Validate OTP code for mobile authentication
  if (method === 'mobile') {
    const enteredOtp = document.getElementById(`${prefix}-otp-input`).value.trim();
    if (enteredOtp !== generatedOtp[scope]) {
      alert("Invalid OTP code. Please enter the correct code shown in the hint.");
      return;
    }
  }

  let userProfile = null;

  if (scope === 'register') {
    const firstName = document.getElementById('reg-first').value.trim() || "User";
    const lastName = document.getElementById('reg-last').value.trim();
    const rawUsername = document.getElementById('reg-username').value.trim() || "user";
    const handle = '@' + rawUsername.replace('@', '');
    const fullName = lastName ? `${firstName} ${lastName}` : firstName;

    const key = method === 'gmail' 
      ? document.getElementById('reg-email').value.trim().toLowerCase()
      : document.getElementById('reg-phone').value.trim();

    if (!key) {
      alert("Please enter your " + (method === 'gmail' ? "Gmail address" : "mobile number") + ".");
      return;
    }

    userProfile = { name: fullName, handle: handle, key: key };
    
    // Save new account into the database under its mobile number / email key
    db[key] = userProfile;
    saveUsersDatabase(db);

  } else {
    // LOGIN MODE: Look up the user by their key (mobile or email)
    const key = method === 'gmail'
      ? document.getElementById('login-email').value.trim().toLowerCase()
      : document.getElementById('login-phone').value.trim();

    if (!key) {
      alert("Please enter your " + (method === 'gmail' ? "Gmail address" : "mobile number") + ".");
      return;
    }

    if (db[key]) {
      // Existing profile found! Retrieve exact name & handle
      userProfile = db[key];
    } else {
      // Fallback if logging in without prior registration in current session
      const fallbackName = method === 'gmail' ? key.split('@')[0] : "Mobile User";
      const fallbackHandle = method === 'gmail' ? '@' + key.split('@')[0] : "@user_" + key.slice(-4);
      userProfile = { name: fallbackName, handle: fallbackHandle, key: key };
      db[key] = userProfile;
      saveUsersDatabase(db);
    }
  }

  // Set current active session details
  localStorage.setItem('ss_name', userProfile.name);
  localStorage.setItem('ss_handle', userProfile.handle);

  // Redirect to studio landing page
  window.location.href = 'landing.html';
}