# Mobile API Gateway Service Specification

## Overview
The Mobile API Gateway Service acts as a centralized entry point for all mobile application requests to the TravelSense v2 backend services. This service provides request routing, authentication, rate limiting, request/response transformation, and monitoring specifically tailored for mobile clients. It optimizes communication patterns for mobile networks, handles intermittent connectivity, and provides a unified interface that simplifies mobile development.

## Key Features and Functionality
1. **Request Routing**: Routes incoming mobile requests to appropriate backend services
2. **Authentication & Authorization**: Validates mobile client credentials and user tokens
3. **Rate Limiting**: Implements adaptive rate limiting based on client type and usage patterns
4. **Request/Response Transformation**: Transforms data formats between mobile-optimized and backend service formats
5. **Caching**: Implements intelligent caching strategies for frequently accessed data
6. **Compression**: Applies response compression to reduce data usage
7. **Monitoring & Analytics**: Collects mobile-specific metrics and usage patterns
8. **Error Handling**: Provides consistent error responses tailored for mobile clients
9. **Version Management**: Supports API versioning for mobile app updates
10. **Fallback Mechanisms**: Implements graceful degradation during service outages

## Technical Requirements
- **Runtime**: Node.js 18+
- **Framework**: Express.js with custom middleware
- **Load Balancing**: Round-robin or weighted distribution
- **Caching**: Redis for response caching
- **Monitoring**: Integration with Prometheus and Grafana
- **Logging**: Structured logging with Winston
- **Security**: HTTPS enforcement, CORS configuration, input validation
- **Scalability**: Horizontal scaling with auto-scaling groups
- **Resilience**: Circuit breaker patterns, retry mechanisms

## API Endpoints

### 1. Health Check
- **Endpoint**: `GET /api/mobile/health`
- **Description**: Checks the health status of the mobile API gateway
- **Authentication**: None

#### Response Codes
- `200 OK`: Gateway is healthy
- `503 Service Unavailable`: Gateway is unhealthy

#### Business Logic
1. Check connectivity to core backend services
2. Verify database connectivity
3. Check cache availability
4. Return health status with details

### 2. User Authentication
- **Endpoint**: `POST /api/mobile/auth/login`
- **Description**: Authenticates mobile users and provides access tokens
- **Authentication**: None

#### Request Body
```json
{
  "email": "string",
  "password": "string",
  "deviceId": "string"
}
```

#### Field Validations
- `email`:
 - Required field
  - Must be a valid email format
- `password`:
  - Required field
  - Minimum length: 8 characters
- `deviceId`:
  - Required field
  - Must be a valid device identifier

#### Response Codes
- `200 OK`: Authentication successful
- `400 Bad Request`: Invalid input data
- `401 Unauthorized`: Invalid credentials
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate input fields
2. Verify user credentials with Authentication Service
3. Generate mobile-specific access and refresh tokens
4. Register device ID with user account
5. Return tokens and user data

### 3. Refresh Token
- **Endpoint**: `POST /api/mobile/auth/refresh`
- **Description**: Refreshes expired access tokens for mobile users
- **Authentication**: Required (Refresh Token in HTTP-only cookie)

#### Request Body
```json
{
  "refreshToken": "string"
}
```

#### Field Validations
- `refreshToken`:
  - Required field
  - Must be a valid JWT refresh token format
  - Must not be expired
  - Must match the refresh token stored for the user

#### Response Codes
- `200 OK`: Token successfully refreshed
- `400 Bad Request`: Invalid input data
- `401 Unauthorized`: Invalid or expired refresh token
- `404 Not Found`: Refresh token not found
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate refresh token from request body and HTTP-only cookie
2. Verify refresh token signature and expiration
3. Retrieve user associated with refresh token from database
4. If user not found, return 404 Not Found
5. If refresh token is invalid or expired, return 401 Unauthorized
6. Generate new mobile-specific access token with appropriate expiration
7. Generate new refresh token with appropriate expiration
8. Update refresh token in database for user
9. Set new refresh token in HTTP-only cookie
10. Return new access token and user data

### 4. Get User Profile
- **Endpoint**: `GET /api/mobile/users/profile`
- **Description**: Retrieves the authenticated user's profile information
- **Authentication**: Required (JWT Access Token)

#### Response Codes
- `200 OK`: Profile successfully retrieved
- `401 Unauthorized`: Invalid or expired access token
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate JWT access token from Authorization header
2. Extract user ID from token payload
3. Retrieve user profile from User Service
4. Transform profile data for mobile consumption
5. Return user profile data

### 5. Update User Profile
- **Endpoint**: `PUT /api/mobile/users/profile`
- **Description**: Updates the authenticated user's profile information
- **Authentication**: Required (JWT Access Token)

#### Request Body
```json
{
  "firstName": "string",
  "lastName": "string",
  "preferences": {
    "interests": ["string"],
    "constraints": ["string"],
    "travelStyle": "string"
  }
}
```

#### Field Validations
- `firstName`:
  - Optional field
  - Maximum length: 50 characters
- `lastName`:
  - Optional field
  - Maximum length: 50 characters
- `preferences.interests`:
  - Optional field
  - Must be an array of strings if provided
- `preferences.constraints`:
  - Optional field
  - Must be an array of strings if provided
- `preferences.travelStyle`:
  - Optional field
  - Maximum length: 50 characters

#### Response Codes
- `200 OK`: Profile successfully updated
- `400 Bad Request`: Invalid input data
- `401 Unauthorized`: Invalid or expired access token
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate JWT access token from Authorization header
2. Extract user ID from token payload
3. Validate input fields according to validation rules
4. Update user profile in User Service
5. Return updated user profile data

### 6. Get User Trips
- **Endpoint**: `GET /api/mobile/trips`
- **Description**: Retrieves trips for the authenticated user
- **Authentication**: Required (JWT Access Token)

#### Request Parameters
```json
{
  "status": "string", // Optional filter by trip status
  "limit": "number", // Optional number of results (default: 20, max: 50)
  "offset": "number" // Optional offset for pagination (default: 0)
}
```

#### Field Validations
- `status`:
  - Optional field
  - Must be one of: "draft", "planned", "in-progress", "completed"
- `limit`:
  - Optional field
  - Must be a positive integer
  - Minimum value: 1
  - Maximum value: 50
  - Defaults to 20 if not specified
- `offset`:
  - Optional field
  - Must be a non-negative integer
  - Defaults to 0 if not specified

#### Response Codes
- `200 OK`: Trips successfully retrieved
- `400 Bad Request`: Invalid query parameters
- `401 Unauthorized`: Invalid or expired access token
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate JWT access token from Authorization header
2. Extract user ID from token payload
3. Validate query parameters according to validation rules
4. Build request to Trip Service with filters
5. Transform trip data for mobile consumption
6. Apply pagination parameters
7. Return trips list with pagination metadata

### 7. Create Trip
- **Endpoint**: `POST /api/mobile/trips`
- **Description**: Creates a new trip for the authenticated user
- **Authentication**: Required (JWT Access Token)

#### Request Body
```json
{
  "name": "string",
  "destination": {
    "origin": "string",
    "destination": "string",
    "startDate": "string", // ISO 8601 date format
    "endDate": "string" // ISO 8601 date format
  }
}
```

#### Field Validations
- `name`:
  - Required field
  - Minimum length: 1 character
  - Maximum length: 100 characters
- `destination.origin`:
  - Required field
  - Minimum length: 1 character
  - Maximum length: 100 characters
- `destination.destination`:
  - Required field
  - Minimum length: 1 character
  - Maximum length: 100 characters
- `destination.startDate`:
  - Required field
  - Must be a valid ISO 8601 date
- `destination.endDate`:
  - Required field
  - Must be a valid ISO 8601 date
  - Must be after startDate

#### Response Codes
- `201 Created`: Trip successfully created
- `400 Bad Request`: Invalid input data
- `401 Unauthorized`: Invalid or expired access token
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate JWT access token from Authorization header
2. Extract user ID from token payload
3. Validate input fields according to validation rules
4. Create trip in Trip Service
5. Transform trip data for mobile consumption
6. Return created trip data with 201 status

## Data Models

### Mobile Device
```javascript
{
  _id: ObjectId,
  userId: ObjectId, // Associated user
  deviceId: String, // Unique device identifier
  deviceType: String, // "ios", "android"
  deviceName: String, // Device model name
  osVersion: String, // Operating system version
  appVersion: String, // Mobile app version
  lastAccessedAt: Date, // Last time device accessed the service
  createdAt: Date,
  updatedAt: Date
}
```

### Mobile Session
```javascript
{
  _id: ObjectId,
  userId: ObjectId, // Associated user
  deviceId: String, // Associated device
  accessToken: String, // JWT access token
  refreshToken: String, // Refresh token
  expiresAt: Date, // Access token expiration
  createdAt: Date,
  updatedAt: Date
}
```

## Integration Points with Existing Services
1. **Authentication Service**: For user authentication and token management
2. **User Service**: For user profile management
3. **Trip Service**: For trip creation and retrieval
4. **Notification Service**: For push notifications to mobile devices
5. **Analytics Service**: For collecting mobile usage metrics

## Security Considerations
1. **Transport Security**: All communications must use HTTPS
2. **Token Security**: Mobile-specific tokens with shorter expiration times
3. **Device Binding**: Tokens bound to specific device identifiers
4. **Rate Limiting**: Adaptive rate limiting based on device and user behavior
5. **Input Validation**: Strict validation of all input parameters
6. **CORS Configuration**: Restricted to mobile application domains only
7. **DDoS Protection**: Implementation of request throttling and filtering
8. **Audit Logging**: Comprehensive logging of all API interactions

## Performance Requirements
1. **Response Time**: 95% of requests should respond within 500ms
2. **Throughput**: Support for 100 concurrent mobile sessions
3. **Caching**: Cache frequently accessed data for up to 5 minutes
4. **Compression**: Enable GZIP compression for responses over 1KB
5. **Connection Pooling**: Maintain efficient database and service connections
6. **Load Balancing**: Distribute requests evenly across gateway instances
7. **Auto-scaling**: Scale horizontally based on request volume
8. **Fallback Mechanisms**: Graceful degradation during partial service outages

## Monitoring and Analytics
1. **Request Metrics**: Track request volume, response times, and error rates
2. **User Behavior**: Monitor feature usage and navigation patterns
3. **Performance Monitoring**: Continuous monitoring of system performance
4. **Error Tracking**: Capture and analyze error patterns
5. **Business Metrics**: Track key business indicators like trip creation rates
6. **Device Analytics**: Collect device-specific performance data
7. **Network Conditions**: Monitor performance under different network conditions
8. **Geographic Distribution**: Track usage patterns by geographic region

## Error Handling
1. **Standardized Responses**: Consistent error response format across all endpoints
2. **Error Logging**: Comprehensive logging of all errors with context
3. **Graceful Degradation**: Continue functioning with reduced capabilities during partial outages
4. **Retry Mechanisms**: Implement exponential backoff for failed service calls
5. **Circuit Breakers**: Prevent cascading failures during service outages
6. **User-Friendly Messages**: Provide clear error messages for mobile UI display