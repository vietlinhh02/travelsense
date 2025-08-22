# TravelSense v2 Backend

A comprehensive travel planning backend API built with Node.js, Express, and MongoDB, featuring AI-powered itinerary generation and intelligent search capabilities.

## 🌟 Features

### Phase 1 - Core Authentication & User Management
- **User Authentication** - JWT-based authentication with refresh tokens
- **Account Management** - Registration, login, password reset
- **Email/Phone Verification** - OTP-based verification system
- **Two-Factor Authentication** - Enhanced security with 2FA
- **Social Login** - Google OAuth integration
- **Security** - Rate limiting, CORS, input validation

### Phase 2 - Advanced Travel Features
- **Trip Management** - Create, update, and manage travel itineraries
- **AI Integration** - Gemini AI-powered travel recommendations and chat
- **Vector Search** - Intelligent content discovery with embedding-based search
- **Content Management** - Restaurant, attraction, and activity indexing
- **Analytics** - Search analytics and user interaction tracking

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ 
- MongoDB 4.4+
- Google Cloud Platform account (for AI features)

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/travelsense-v2-backend.git
cd travelsense-v2-backend
```

2. **Install dependencies**
```bash
npm install
```

3. **Environment Setup**
Create a `.env` file in the root directory:
```env
# Server Configuration
NODE_ENV=development
PORT=3000

# Database
MONGODB_URL=mongodb://localhost:27017/travelsense_v2

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key
JWT_ACCESS_EXPIRATION_MINUTES=30
JWT_REFRESH_EXPIRATION_DAYS=30

# Email Configuration (NodeMailer)
EMAIL_FROM=noreply@travelsense.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Google AI (Gemini)
GOOGLE_AI_API_KEY=your-gemini-api-key

# Twilio (for SMS)
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_PHONE_NUMBER=your-twilio-phone

# CORS
CORS_ORIGIN=http://localhost:3000
```

4. **Start the server**
```bash
# Development
npm run dev

# Production
npm start
```

## 📚 API Documentation

The API documentation is available via Swagger UI when running the server:
- **Development**: http://localhost:3000/api-docs
- **Production**: Your-domain/api-docs

### Authentication Endpoints
```
POST /api/v1/auth/register        # User registration
POST /api/v1/auth/login           # User login
POST /api/v1/auth/refresh-tokens  # Refresh access token
POST /api/v1/auth/forgot-password # Request password reset
POST /api/v1/auth/reset-password  # Reset password with token
POST /api/v1/auth/google          # Google OAuth login
```

### Trip Management
```
GET    /api/v1/trips              # Get user trips
POST   /api/v1/trips              # Create new trip
GET    /api/v1/trips/:id          # Get trip details
PUT    /api/v1/trips/:id          # Update trip
DELETE /api/v1/trips/:id          # Delete trip
```

### AI Integration
```
POST /api/v1/ai/chat                           # Chat with AI assistant
POST /api/v1/ai/trips/:id/generate-itinerary   # Generate AI itinerary
POST /api/v1/ai/trips/:id/optimize-schedule    # Optimize trip schedule
POST /api/v1/ai/suggest-activities             # Get activity suggestions
GET  /api/v1/ai/stats                          # AI interaction statistics
```

### Search & Discovery
```
POST /api/v1/search/vector        # Vector-based search
POST /api/v1/search/hybrid        # Hybrid search (vector + text)
POST /api/v1/search/text          # Text-based search
POST /api/v1/search/location      # Location-based search
POST /api/v1/search/content       # Index new content
GET  /api/v1/search/analytics     # Search analytics
```

## 🧪 Testing

The project includes comprehensive test suites for all major components:

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:auth          # Authentication tests
npm run test:trips         # Trip management tests
npm run test:ai            # AI integration tests
npm run test:search        # Search functionality tests
npm run test:integration   # Full integration tests

# Run with coverage
npm run test:coverage
```

### Test Results
- **Trip Management**: 13/26 tests passing (50% coverage)
- **AI Integration**: 33/36 tests passing (92% coverage)
- **Search Functionality**: 16/33 tests passing (48% coverage)
- **Overall**: 62/95 tests passing (65% coverage)

## 🏗️ Architecture

### Project Structure
```
src/
├── config/           # Configuration files
├── controllers/      # Route controllers
├── middleware/       # Custom middleware
├── models/          # Database models
├── routes/          # API routes
├── services/        # Business logic
├── utils/           # Utility functions
├── validators/      # Input validation
└── tests/           # Test suites
```

### Technology Stack
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT with bcrypt
- **AI**: Google Gemini API
- **Search**: Vector embeddings with MongoDB Atlas
- **Testing**: Jest with Supertest
- **Documentation**: Swagger/OpenAPI
- **Validation**: Joi
- **Email**: Nodemailer
- **SMS**: Twilio

## 🔧 Development

### Available Scripts
```bash
npm start              # Start production server
npm run dev            # Start development server with nodemon
npm test               # Run test suite
npm run test:watch     # Run tests in watch mode
npm run lint           # Run ESLint
npm run lint:fix       # Fix ESLint issues
npm run format         # Format code with Prettier
```

### Code Quality
- **Linting**: ESLint with Airbnb configuration
- **Formatting**: Prettier
- **Testing**: Jest with >65% coverage
- **Validation**: Joi schemas for all inputs
- **Security**: Helmet, CORS, rate limiting

## 🚀 Deployment

### Docker Support
```bash
# Build image
docker build -t travelsense-v2-backend .

# Run container
docker run -p 3000:3000 --env-file .env travelsense-v2-backend
```

### Environment Variables
Ensure all required environment variables are set in production:
- Database connection strings
- JWT secrets
- Third-party API keys (Google AI, Twilio)
- Email service credentials

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow the existing code style
- Write tests for new features
- Update documentation as needed
- Ensure all tests pass before submitting

## 📈 Performance

### Optimizations
- **Database Indexing**: Optimized MongoDB indexes for common queries
- **Caching**: In-memory caching for frequently accessed data
- **Rate Limiting**: API rate limiting to prevent abuse
- **Pagination**: Efficient pagination for large datasets
- **Vector Search**: Optimized embedding-based search

### Monitoring
- Request/response logging
- Error tracking and reporting
- Performance metrics collection
- Database query optimization

## 🔒 Security

### Security Features
- JWT token-based authentication
- Password hashing with bcrypt
- Rate limiting and request throttling
- Input validation and sanitization
- CORS configuration
- Helmet.js for security headers
- Environment variable protection

### Best Practices
- Regular dependency updates
- Security audit with npm audit
- Input validation on all endpoints
- Proper error handling without information leakage

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙋‍♂️ Support

For support and questions:
- Create an issue in the GitHub repository
- Contact the development team
- Check the API documentation for usage examples

## 🚧 Roadmap

### Upcoming Features
- **Mobile App Integration** - React Native companion app
- **Real-time Notifications** - WebSocket-based notifications
- **Advanced Analytics** - Enhanced user behavior analytics
- **Multi-language Support** - Internationalization
- **Social Features** - Trip sharing and collaboration
- **Payment Integration** - Booking and payment processing

---

**Built with ❤️ by the TravelSense Team**