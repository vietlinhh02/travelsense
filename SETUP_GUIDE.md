# Backend2 Setup and Run Guide

This guide will help you set up and run the TravelSense v2 backend application.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Setup
The `.env` file has been created with default values. Update the following variables as needed:

```bash
# Database Configuration
MONGO_URI=mongodb://localhost:27017/backend2

# JWT Configuration (IMPORTANT: Change these in production!)
JWT_SECRET=your-super-secret-jwt-key-that-should-be-at-least-32-characters-long
JWT_ACCESS_TOKEN_SECRET=your-access-token-secret-key-that-should-be-at-least-32-characters-long
JWT_REFRESH_TOKEN_SECRET=your-refresh-token-secret-key-that-should-be-at-least-32-characters-long
```

### 3. Start the Server
```bash
# Development mode with auto-restart
npm run dev

# Production mode
npm start
```

### 4. Test the API
Once the server is running, you can test the health endpoint:
```bash
curl http://localhost:5000/api/v1/health
```

Expected response:
```json
{
  \"status\": \"ok\",
  \"timestamp\": \"2024-01-01T00:00:00.000Z\",
  \"service\": \"TravelSense Backend API v1\"
}
```

## 🔧 Development Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Start production server
npm start

# Run tests
npm test

# Run authentication tests
npm run test:auth

# Run tests with coverage
npm run test:coverage
```

## 📡 Available Endpoints

### Health Check
- `GET /api/v1/health` - Server health status

### Authentication (Phase 1)
- `POST /api/v1/auth/refresh` - Refresh JWT token
- `POST /api/v1/auth/revoke` - Revoke refresh token (logout)
- `GET /api/v1/auth/validate` - Validate access token

## 🔒 Security Notes

1. **JWT Secrets**: Change the default JWT secrets in production
2. **MongoDB**: Ensure MongoDB is running and accessible
3. **Environment**: Never commit `.env` file to version control
4. **CORS**: CORS is configured for development, adjust for production

## 🐛 Troubleshooting

### Common Issues

1. **Port already in use**: Change PORT in `.env` file
2. **MongoDB connection failed**: Check MongoDB server and connection string
3. **JWT errors**: Verify JWT secrets are at least 32 characters
4. **Module not found**: Run `npm install` to install dependencies

### Dependencies Issues
If you encounter dependency issues, try:
```bash
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

## 📁 Project Structure

```
src/
├── config/          # Configuration files
├── controllers/     # Route controllers
├── models/          # Database models
│   ├── auth/        # Authentication models
│   └── users/       # User models
├── routes/          # API routes
├── tests/           # Test files
├── utils/           # Utility functions
├── validations/     # Input validation
├── app.js           # Express app setup
└── server.js        # Server entry point
```

## 🧪 Testing

Run the comprehensive authentication test suite:
```bash
npm run test:auth
```

This will test all authentication endpoints with 75+ test cases covering:
- Success scenarios
- Error handling
- Security validation
- Edge cases

---

**Happy coding! 🎉**