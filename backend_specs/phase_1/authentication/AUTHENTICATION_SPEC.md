# Authentication Service Specification

## Overview
The Authentication Service handles all aspects of user authentication and authorization for the TravelSense v2 platform. This service implements JWT-based authentication with secure token management, refresh mechanisms, and role-based access control.

## API Endpoints

### 1. Token Refresh
- **Endpoint**: `POST /api/auth/refresh`
- **Description**: Refreshes an expired JWT token using a refresh token
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
6. Generate new access token with appropriate expiration
7. Generate new refresh token with appropriate expiration
8. Update refresh token in database for user
9. Set new refresh token in HTTP-only cookie
10. Return new access token and user data

### 2. Token Revoke
- **Endpoint**: `POST /api/auth/revoke`
- **Description**: Revokes a refresh token, effectively logging out the user
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
  - Must match the refresh token stored for the user

#### Response Codes
- `204 No Content`: Token successfully revoked
- `400 Bad Request`: Invalid input data
- `401 Unauthorized`: Invalid refresh token
- `404 Not Found`: Refresh token not found
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate refresh token from request body and HTTP-only cookie
2. Verify refresh token signature
3. Retrieve user associated with refresh token from database
4. If user not found, return 404 Not Found
5. If refresh token is invalid, return 401 Unauthorized
6. Remove refresh token from database for user
7. Clear refresh token from HTTP-only cookie
8. Return 204 No Content response

### 3. Session Validation
- **Endpoint**: `GET /api/auth/validate`
- **Description**: Validates if an access token is still valid
- **Authentication**: Required (JWT Access Token)

#### Request Parameters
- None

#### Response Codes
- `200 OK`: Token is valid
- `401 Unauthorized`: Invalid or expired access token
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate JWT access token from Authorization header
2. Verify token signature and expiration
3. If token is invalid or expired, return 401 Unauthorized
4. Retrieve user associated with token from database
5. If user not found, return 401 Unauthorized
6. Return success response with user data

## Token Management

### Access Tokens
- **Purpose**: Used for authenticating API requests
- **Expiration**: 15 minutes
- **Storage**: HTTP Authorization header (Bearer token)
- **Payload**:
  ```json
  {
    "userId": "string",
    "email": "string",
    "iat": "timestamp",
    "exp": "timestamp"
  }
  ```

### Refresh Tokens
- **Purpose**: Used to obtain new access tokens without re-authentication
- **Expiration**: 7 days
- **Storage**: HTTP-only cookie with SameSite=Strict and Secure flags
- **Payload**:
  ```json
  {
    "userId": "string",
    "tokenId": "string",
    "iat": "timestamp",
    "exp": "timestamp"
  }
  ```

## Security Mechanisms

### Rate Limiting
- **Authentication endpoints**: 10 requests per minute per IP
- **Token refresh**: 5 requests per minute per user
- **Token revoke**: 10 requests per minute per user

### Token Rotation
- Refresh tokens are rotated on each use
- Previous refresh tokens are invalidated when a new one is issued
- Compromised tokens can be detected and blacklisted

### Token Blacklisting
- Invalidated refresh tokens are stored in a blacklist until expiration
- Blacklisted tokens cannot be used for token refresh
- Blacklist is automatically cleaned of expired tokens

## Business Logic Details

### Token Generation Process
1. Generate unique token ID for refresh token
2. Create JWT payload with user information and token ID
3. Sign JWT with secret key using HS256 algorithm
4. Store refresh token metadata in database
5. Set appropriate HTTP-only cookie for refresh token
6. Return access token in response body

### Token Validation Process
1. Extract token from Authorization header or cookie
2. Verify token signature using secret key
3. Check if token is expired
4. For refresh tokens, check if token is blacklisted
5. Retrieve user associated with token from database
6. Return validation result

### Session Management
1. Track active sessions per user
2. Allow users to view and manage active sessions
3. Enable force logout from specific sessions
4. Automatically expire sessions after inactivity

## Data Models

### Refresh Token
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  tokenId: String, // Unique identifier for the token
  expiresAt: Date, // Expiration timestamp
  createdAt: Date,
  lastUsedAt: Date
}
```

### Token Blacklist
```javascript
{
  _id: ObjectId,
  tokenId: String, // Token ID of blacklisted token
  userId: ObjectId, // User associated with token
  blacklistedAt: Date, // When token was blacklisted
  expiresAt: Date // When blacklisted entry should be removed
}
```

## Security Considerations
1. All tokens must be signed using strong secret keys
2. HTTPS must be enforced in production environments
3. HTTP-only cookies must be used for refresh tokens
4. SameSite=Strict and Secure flags must be set on cookies
5. Rate limiting must be implemented to prevent abuse
6. Token rotation must be implemented to prevent replay attacks
7. Refresh token theft detection mechanisms must be in place
8. Proper CORS configuration must be implemented
9. Input validation must be performed on all fields
10. Sensitive information must never be logged

## Error Handling
1. Invalid token errors return 401 Unauthorized
2. Expired token errors return 401 Unauthorized with specific message
3. Rate limit exceeded errors return 429 Too Many Requests
4. Database errors return 500 Internal Server Error
5. All errors include appropriate error messages for debugging