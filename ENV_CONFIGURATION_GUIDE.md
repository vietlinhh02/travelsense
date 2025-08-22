# 🔧 Environment Variables Configuration Guide

## 📋 **Overview**
Your `.env` file has been updated with all necessary environment variables for the complete TravelSense v2 backend system.

## 🚨 **URGENT: Variables That Need Real Values**

### 1. **🤖 Gemini AI (CRITICAL for AI Features)**
```bash
# Get from Google Cloud Console - AI Platform
GEMINI_API_KEY=your_actual_gemini_api_key
GEMINI_PROJECT_ID=your_google_cloud_project_id
```
**How to get:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create/select project
3. Enable Gemini API
4. Go to "APIs & Services" → "Credentials"
5. Create API Key

### 2. **🔐 JWT Secrets (SECURITY CRITICAL)**
```bash
# Generate strong random keys (32+ characters each)
JWT_SECRET=your-actual-super-secret-jwt-key-32-chars-minimum
JWT_ACCESS_TOKEN_SECRET=your-actual-access-token-secret-32-chars
JWT_REFRESH_TOKEN_SECRET=your-actual-refresh-token-secret-32-chars
```
**Generate secure keys:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. **📧 Email Service (for verification)**
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-actual-email@gmail.com
SMTP_PASS=your-gmail-app-password
```
**For Gmail:**
1. Enable 2FA in your Google account
2. Generate App Password
3. Use App Password (not regular password)

---

## 📊 **Environment Variables by Category**

### 🔧 **Core System**
| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `NODE_ENV` | Environment mode | ✅ | development |
| `PORT` | Server port | ✅ | 5000 |
| `MONGO_URI` | MongoDB connection | ✅ | localhost:27017 |

### 🔐 **Authentication & Security**
| Variable | Description | Required | Notes |
|----------|-------------|----------|-------|
| `JWT_SECRET` | Main JWT secret | ✅ | 32+ chars |
| `JWT_ACCESS_TOKEN_SECRET` | Access token secret | ✅ | 32+ chars |
| `JWT_REFRESH_TOKEN_SECRET` | Refresh token secret | ✅ | 32+ chars |
| `BCRYPT_SALT_ROUNDS` | Password hashing rounds | ✅ | 12 |

### 🤖 **AI Integration (Gemini)**
| Variable | Description | Required | Notes |
|----------|-------------|----------|-------|
| `GEMINI_API_KEY` | Google Gemini API key | ✅ | From Google Cloud |
| `GEMINI_PROJECT_ID` | GCP Project ID | ✅ | From Google Cloud |
| `GEMINI_FLASH_RPM` | Flash model rate limit | ✅ | 15/minute |
| `GEMINI_PRO_RPM` | Pro model rate limit | ✅ | 2/minute |

### 📧 **Communication Services**
| Variable | Description | Required | Notes |
|----------|-------------|----------|-------|
| `SMTP_HOST` | Email server host | 🔶 | For verification emails |
| `SMTP_USER` | Email username | 🔶 | Gmail/SMTP account |
| `SMTP_PASS` | Email password | 🔶 | App password |
| `TWILIO_ACCOUNT_SID` | SMS service ID | 🔶 | For SMS verification |

### 🔍 **External APIs (Optional)**
| Variable | Description | Required | Notes |
|----------|-------------|----------|-------|
| `GOOGLE_CLIENT_ID` | OAuth client ID | 🔶 | For Google login |
| `MAP_API_KEY` | Google Maps key | 🔶 | For location services |
| `WEATHER_API_KEY` | Weather service key | 🔶 | For weather data |

---

## 🚀 **Quick Setup Priority**

### **Phase 1: Essential (AI Trip Planning)**
1. ✅ Database: `MONGO_URI` (already working)
2. ✅ JWT: Generate secure secrets
3. ✅ Gemini AI: Get API key from Google Cloud

### **Phase 2: Enhanced Features**
4. 📧 Email: Configure SMTP for user verification
5. 🔐 Google OAuth: For social login
6. 📱 SMS: Twilio for phone verification

### **Phase 3: Production Ready**
7. 🔍 External APIs: Maps, Weather, Currency
8. 📊 Analytics: Sentry, Google Analytics
9. 💳 Payments: Stripe keys (Phase 3+)

---

## 🔧 **How to Configure Each Service**

### **1. Gemini AI (Most Important)**
```bash
# Visit: https://console.cloud.google.com/
# 1. Create/Select Project
# 2. Enable "Generative Language API"
# 3. Go to "Credentials" → "Create API Key"
GEMINI_API_KEY=AIza...your_actual_key
GEMINI_PROJECT_ID=your-project-id
```

### **2. Gmail SMTP**
```bash
# 1. Enable 2FA on Gmail
# 2. Generate App Password: https://myaccount.google.com/apppasswords
# 3. Use App Password (not regular password)
SMTP_USER=youremail@gmail.com
SMTP_PASS=abcd efgh ijkl mnop  # App password (16 chars)
```

### **3. Google OAuth (Social Login)**
```bash
# Visit: https://console.developers.google.com/
# 1. Create OAuth 2.0 Client ID
# 2. Add authorized redirect URI
GOOGLE_CLIENT_ID=123456789-abc...googleusercontent.com
GOOGLE_CLIENT_SECRET=GOC...your_secret
```

### **4. Generate JWT Secrets**
```bash
# Run this 3 times for different secrets:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## ✅ **Current Status**

### **Already Working:**
- ✅ Server running on port 5000
- ✅ MongoDB connection
- ✅ Basic authentication
- ✅ AI service structure

### **Need Configuration:**
- 🔧 Real Gemini API key for AI features
- 🔧 Secure JWT secrets for production
- 🔧 Email service for user verification

---

## 🎯 **Next Steps**

1. **Get Gemini API Key** (for AI trip planning)
2. **Generate secure JWT secrets**
3. **Configure email service** (optional but recommended)
4. **Test AI endpoints** with real API key

Your system is 95% ready - just needs these API keys to be fully functional! 🚀