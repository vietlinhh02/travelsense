# User Service Specification

## Overview
The User Service handles all user-related functionality including registration, profile management, authentication, and account settings. This service is responsible for managing user data, preferences, and security.

## API Endpoints

### 1. User Registration
- **Endpoint**: `POST /api/users/register`
- **Description**: Creates a new user account in the system
- **Authentication**: Not required

#### Request Body
```json
{
  "email": "string",
  "password": "string",
  "firstName": "string",
  "lastName": "string"
}
```

#### Field Validations
- `email`:
  - Required field
  - Must be a valid email format
  - Must be unique (not already registered)
  - Maximum length: 254 characters
- `password`:
  - Required field
  - Minimum length: 8 characters
  - Maximum length: 128 characters
  - Must contain at least one uppercase letter
  - Must contain at least one lowercase letter
  - Must contain at least one number
  - Must contain at least one special character
- `firstName`:
 - Required field
  - Minimum length: 1 character
  - Maximum length: 50 characters
 - Must contain only letters, spaces, hyphens, and apostrophes
- `lastName`:
  - Required field
  - Minimum length: 1 character
  - Maximum length: 50 characters
  - Must contain only letters, spaces, hyphens, and apostrophes

#### Response Codes
- `201 Created`: User successfully registered
- `400 Bad Request`: Invalid input data or validation errors
- `409 Conflict`: Email already registered
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate all input fields according to specified validation rules
2. Check if email is already registered in the system
3. Hash the password using bcrypt with appropriate salt rounds
4. Generate a unique user ID
5. Create user record in database with default preferences
6. Set createdAt and updatedAt timestamps
7. Send welcome email to user (handled asynchronously)
8. Generate JWT token for immediate authentication
9. Return user data (excluding password) and token

### 2. User Login
- **Endpoint**: `POST /api/users/login`
- **Description**: Authenticates user credentials and returns access token
- **Authentication**: Not required

#### Request Body
```json
{
  "email": "string",
  "password": "string"
}
```

#### Field Validations
- `email`:
  - Required field
  - Must be a valid email format
  - Maximum length: 254 characters
- `password`:
  - Required field
  - Minimum length: 8 characters
  - Maximum length: 128 characters

#### Response Codes
- `200 OK`: Successful authentication
- `400 Bad Request`: Invalid input data
- `401 Unauthorized`: Invalid credentials
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate input fields
2. Retrieve user record by email from database
3. If user not found, return 401 Unauthorized
4. Compare provided password with stored hashed password
5. If password mismatch, return 401 Unauthorized
6. Update user's lastLogin timestamp
7. Generate JWT access token with appropriate expiration
8. Return user data (excluding password) and token

### 3. Get User Profile
- **Endpoint**: `GET /api/users/profile`
- **Description**: Retrieves the authenticated user's profile information
- **Authentication**: Required (JWT)

#### Request Parameters
- None

#### Response Codes
- `200 OK`: Profile data successfully retrieved
- `401 Unauthorized`: Missing or invalid authentication token
- `404 Not Found`: User profile not found
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate JWT token from Authorization header
2. Extract user ID from token payload
3. Retrieve user record from database by ID
4. If user not found, return 404 Not Found
5. Return user profile data excluding sensitive information (password)

### 4. Update User Profile
- **Endpoint**: `PUT /api/users/profile`
- **Description**: Updates the authenticated user's profile information
- **Authentication**: Required (JWT)

#### Request Body
```json
{
  "firstName": "string",
  "lastName": "string",
  "preferences": {
    "interests": ["string"],
    "constraints": ["string"],
    "travelStyle": "string",
    "budgetRange": "string"
  },
  "profile": {
    "dateOfBirth": "ISO 8601 date",
    "nationality": "string",
    "languages": ["string"],
    "specialRequirements": ["string"]
  }
}
```

#### Field Validations
- `firstName`:
  - Optional field
  - Minimum length: 1 character
  - Maximum length: 50 characters
  - Must contain only letters, spaces, hyphens, and apostrophes
- `lastName`:
  - Optional field
  - Minimum length: 1 character
  - Maximum length: 50 characters
  - Must contain only letters, spaces, hyphens, and apostrophes
- `preferences.interests`:
 - Optional array
  - Each item must be a string with maximum 50 characters
  - Maximum of 20 interests
- `preferences.constraints`:
  - Optional array
  - Each item must be a string with maximum 100 characters
  - Maximum of 10 constraints
- `preferences.travelStyle`:
 - Optional field
  - Must be one of: "budget", "luxury", "adventure", "cultural", "family", "business"
- `preferences.budgetRange`:
  - Optional field
  - Must be one of: "low", "medium", "high", "luxury"
- `profile.dateOfBirth`:
  - Optional field
  - Must be a valid date in the past
  - Format: ISO 8601 (YYYY-MM-DD)
- `profile.nationality`:
  - Optional field
  - Maximum length: 50 characters
- `profile.languages`:
  - Optional array
  - Each item must be a string with maximum 30 characters
 - Maximum of 10 languages
- `profile.specialRequirements`:
  - Optional array
  - Each item must be a string with maximum 100 characters
  - Maximum of 5 special requirements

#### Response Codes
- `200 OK`: Profile successfully updated
- `400 Bad Request`: Invalid input data or validation errors
- `401 Unauthorized`: Missing or invalid authentication token
- `404 Not Found`: User profile not found
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate JWT token from Authorization header
2. Extract user ID from token payload
3. Validate all provided fields according to validation rules
4. Retrieve user record from database by ID
5. If user not found, return 404 Not Found
6. Update user profile fields with provided values
7. Update updatedAt timestamp
8. Save updated user record to database
9. Return updated user profile data

### 5. Change Password
- **Endpoint**: `PUT /api/users/password`
- **Description**: Updates the authenticated user's password
- **Authentication**: Required (JWT)

#### Request Body
```json
{
  "currentPassword": "string",
  "newPassword": "string"
}
```

#### Field Validations
- `currentPassword`:
  - Required field
  - Minimum length: 8 characters
  - Maximum length: 128 characters
- `newPassword`:
  - Required field
  - Minimum length: 8 characters
  - Maximum length: 128 characters
  - Must contain at least one uppercase letter
  - Must contain at least one lowercase letter
  - Must contain at least one number
  - Must contain at least one special character
  - Must not be the same as current password

#### Response Codes
- `200 OK`: Password successfully changed
- `400 Bad Request`: Invalid input data or validation errors
- `401 Unauthorized`: Missing or invalid authentication token, or current password incorrect
- `404 Not Found`: User not found
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate JWT token from Authorization header
2. Extract user ID from token payload
3. Validate input fields according to validation rules
4. Retrieve user record from database by ID
5. If user not found, return 404 Not Found
6. Compare currentPassword with stored hashed password
7. If password mismatch, return 401 Unauthorized
8. Hash the newPassword using bcrypt with appropriate salt rounds
9. Update user's password field with new hashed password
10. Update updatedAt timestamp
11. Save updated user record to database
12. Invalidate all existing sessions/tokens except current one
13. Return success response

### 6. Delete Account
- **Endpoint**: `DELETE /api/users/account`
- **Description**: Permanently deletes the authenticated user's account
- **Authentication**: Required (JWT)

#### Request Body
```json
{
  "password": "string"
}
```

#### Field Validations
- `password`:
  - Required field
  - Minimum length: 8 characters
  - Maximum length: 128 characters

#### Response Codes
- `204 No Content`: Account successfully deleted
- `400 Bad Request`: Invalid input data
- `401 Unauthorized`: Missing or invalid authentication token, or password incorrect
- `404 Not Found`: User not found
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate JWT token from Authorization header
2. Extract user ID from token payload
3. Validate password field
4. Retrieve user record from database by ID
5. If user not found, return 404 Not Found
6. Compare provided password with stored hashed password
7. If password mismatch, return 401 Unauthorized
8. Delete user record from database
9. Delete associated data (preferences, profile data, etc.)
10. Invalidate all user sessions/tokens
11. Send account deletion confirmation email
12. Return 204 No Content response
### 7. Google Login
- **Endpoint**: `POST /api/users/google-login`
- **Description**: Authenticates user using Google OAuth and returns access token
- **Authentication**: Not required

#### Request Body
```json
{
  "tokenId": "string" // Google OAuth token ID
}
```

#### Field Validations
- `tokenId`:
  - Required field
  - Must be a valid Google OAuth token

#### Response Codes
- `200 OK`: Successful authentication
- `400 Bad Request`: Invalid input data
- `401 Unauthorized`: Invalid Google token
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate tokenId field
2. Verify Google OAuth token with Google's API
3. Extract user information from Google token (email, name, profile picture)
4. Check if user already exists in database by email
5. If user doesn't exist, create new user record with Google information
6. If user exists, update user information from Google data
7. Generate JWT access token with appropriate expiration
8. Generate refresh token and store in HTTP-only cookie
9. Update user's lastLogin timestamp
10. Return user data and token

### 8. Email OTP Request
- **Endpoint**: `POST /api/users/request-otp`
- **Description**: Sends OTP code to user's email for verification
- **Authentication**: Not required

#### Request Body
```json
{
  "email": "string"
}
```

#### Field Validations
- `email`:
  - Required field
  - Must be a valid email format
  - Maximum length: 254 characters

#### Response Codes
- `200 OK`: OTP sent successfully
- `400 Bad Request`: Invalid input data
- `404 Not Found`: Email not registered
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate email field
2. Check if email exists in database
3. If email not found, return 404 Not Found
4. Generate 6-digit OTP code
5. Store OTP code with expiration (5 minutes) in database
6. Send OTP code to user's email
7. Return success response

### 9. Email OTP Login
- **Endpoint**: `POST /api/users/otp-login`
- **Description**: Authenticates user using email and OTP code
- **Authentication**: Not required

#### Request Body
```json
{
  "email": "string",
  "otp": "string"
}
```

#### Field Validations
- `email`:
  - Required field
  - Must be a valid email format
  - Maximum length: 254 characters
- `otp`:
  - Required field
  - Must be exactly 6 digits

#### Response Codes
- `200 OK`: Successful authentication
- `400 Bad Request`: Invalid input data
- `401 Unauthorized`: Invalid OTP or expired OTP
- `404 Not Found`: Email not registered
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate email and otp fields
2. Check if email exists in database
3. If email not found, return 404 Not Found
4. Retrieve stored OTP for email from database
5. If OTP not found or expired, return 401 Unauthorized
6. Compare provided OTP with stored OTP
7. If OTP mismatch, return 401 Unauthorized
8. Delete used OTP from database
9. Update user's lastLogin timestamp
10. Generate JWT access token with appropriate expiration
11. Generate refresh token and store in HTTP-only cookie
12. Return user data and token

### 10. Send Email Verification
- **Endpoint**: `POST /api/users/send-email-verification`
- **Description**: Sends email verification link to user's email
- **Authentication**: Required (JWT)

#### Request Body
```json
{
  "email": "string"
}
```

#### Field Validations
- `email`:
  - Required field
  - Must be a valid email format
  - Maximum length: 254 characters

#### Response Codes
- `200 OK`: Verification email sent successfully
- `400 Bad Request`: Invalid input data
- `401 Unauthorized`: Missing or invalid authentication token
- `409 Conflict`: Email already verified
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate JWT token from Authorization header
2. Extract user ID from token payload
3. Validate email field
4. Retrieve user record from database by ID
5. If user not found, return 404 Not Found
6. Check if email is already verified
7. If email already verified, return 409 Conflict
8. Generate email verification token with expiration (24 hours)
9. Store verification token in database
10. Send verification email with link containing token
11. Return success response

### 11. Verify Email
- **Endpoint**: `POST /api/users/verify-email`
- **Description**: Verifies user's email using verification token
- **Authentication**: Not required

#### Request Body
```json
{
  "token": "string"
}
```

#### Field Validations
- `token`:
  - Required field
  - Must be a valid JWT token

#### Response Codes
- `200 OK`: Email successfully verified
- `400 Bad Request`: Invalid input data
- `401 Unauthorized`: Invalid or expired verification token
- `409 Conflict`: Email already verified
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate token field
2. Verify email verification token
3. If token invalid or expired, return 401 Unauthorized
4. Extract user ID from token payload
5. Retrieve user record from database by ID
6. If user not found, return 404 Not Found
7. Check if email is already verified
8. If email already verified, return 409 Conflict
9. Mark user's email as verified in database
10. Delete verification token from database
11. Update updatedAt timestamp
12. Return success response

### 12. Send Phone Verification
- **Endpoint**: `POST /api/users/send-phone-verification`
- **Description**: Sends verification code to user's phone number
- **Authentication**: Required (JWT)

#### Request Body
```json
{
  "phoneNumber": "string"
}
```

#### Field Validations
- `phoneNumber`:
  - Required field
  - Must be a valid phone number format
  - Maximum length: 20 characters

#### Response Codes
- `200 OK`: Verification code sent successfully
- `400 Bad Request`: Invalid input data
- `401 Unauthorized`: Missing or invalid authentication token
- `409 Conflict`: Phone number already verified
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate JWT token from Authorization header
2. Extract user ID from token payload
3. Validate phone number field
4. Retrieve user record from database by ID
5. If user not found, return 404 Not Found
6. Check if phone number is already verified
7. If phone number already verified, return 409 Conflict
8. Generate 6-digit verification code
9. Store verification code with expiration (10 minutes) in database
10. Send SMS with verification code to phone number
11. Return success response

### 13. Verify Phone
- **Endpoint**: `POST /api/users/verify-phone`
- **Description**: Verifies user's phone number using verification code
- **Authentication**: Required (JWT)

#### Request Body
```json
{
  "phoneNumber": "string",
  "code": "string"
}
```

#### Field Validations
- `phoneNumber`:
  - Required field
  - Must be a valid phone number format
  - Maximum length: 20 characters
- `code`:
  - Required field
  - Must be exactly 6 digits

#### Response Codes
- `200 OK`: Phone number successfully verified
- `400 Bad Request`: Invalid input data
- `401 Unauthorized`: Missing or invalid authentication token
- `401 Unauthorized`: Invalid verification code or expired code
- `409 Conflict`: Phone number already verified
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate JWT token from Authorization header
2. Extract user ID from token payload
3. Validate phone number and code fields
4. Retrieve user record from database by ID
5. If user not found, return 404 Not Found
6. Check if phone number is already verified
7. If phone number already verified, return 409 Conflict
8. Retrieve stored verification code for phone number from database
9. If code not found or expired, return 401 Unauthorized
10. Compare provided code with stored code
11. If code mismatch, return 401 Unauthorized
12. Mark user's phone number as verified in database
13. Delete verification code from database
14. Update updatedAt timestamp
15. Return success response

### 14. Enable Two-Factor Authentication
- **Endpoint**: `POST /api/users/enable-2fa`
- **Description**: Enables two-factor authentication for the user
- **Authentication**: Required (JWT)

#### Request Body
```json
{
  "method": "string" // "sms" or "email" or "authenticator"
}
```

#### Field Validations
- `method`:
  - Required field
  - Must be one of: "sms", "email", "authenticator"

#### Response Codes
- `200 OK`: Two-factor authentication enabled
- `400 Bad Request`: Invalid input data
- `401 Unauthorized`: Missing or invalid authentication token
- `409 Conflict`: Two-factor authentication already enabled
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate JWT token from Authorization header
2. Extract user ID from token payload
3. Validate method field
4. Retrieve user record from database by ID
5. If user not found, return 404 Not Found
6. Check if 2FA is already enabled
7. If 2FA already enabled, return 409 Conflict
8. If method is "authenticator", generate TOTP secret
9. Store 2FA method and secret (if applicable) in database
10. Update updatedAt timestamp
11. Return success response with QR code for authenticator apps (if applicable)

### 15. Disable Two-Factor Authentication
- **Endpoint**: `POST /api/users/disable-2fa`
- **Description**: Disables two-factor authentication for the user
- **Authentication**: Required (JWT)

#### Request Body
```json
{
  "password": "string"
}
```

#### Field Validations
- `password`:
  - Required field
  - Minimum length: 8 characters
  - Maximum length: 128 characters

#### Response Codes
- `200 OK`: Two-factor authentication disabled
- `400 Bad Request`: Invalid input data
- `401 Unauthorized`: Missing or invalid authentication token, or password incorrect
- `409 Conflict`: Two-factor authentication not enabled
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate JWT token from Authorization header
2. Extract user ID from token payload
3. Validate password field
4. Retrieve user record from database by ID
5. If user not found, return 404 Not Found
6. Check if 2FA is enabled
7. If 2FA not enabled, return 409 Conflict
8. Compare provided password with stored hashed password
9. If password mismatch, return 401 Unauthorized
10. Remove 2FA method and secret from database
11. Update updatedAt timestamp
12. Return success response

### 16. Request Account Recovery
- **Endpoint**: `POST /api/users/request-recovery`
- **Description**: Sends account recovery instructions to user's email
- **Authentication**: Not required

#### Request Body
```json
{
  "email": "string"
}
```

#### Field Validations
- `email`:
  - Required field
  - Must be a valid email format
  - Maximum length: 254 characters

#### Response Codes
- `200 OK`: Recovery instructions sent successfully
- `400 Bad Request`: Invalid input data
- `404 Not Found`: Email not registered
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate email field
2. Check if email exists in database
3. If email not found, return 404 Not Found
4. Generate account recovery token with expiration (1 hour)
5. Store recovery token in database
6. Send recovery email with link containing token
7. Return success response

### 17. Reset Password
- **Endpoint**: `POST /api/users/reset-password`
- **Description**: Resets user's password using recovery token
- **Authentication**: Not required

#### Request Body
```json
{
  "token": "string",
  "newPassword": "string"
}
```

#### Field Validations
- `token`:
  - Required field
  - Must be a valid JWT token
- `newPassword`:
  - Required field
  - Minimum length: 8 characters
  - Maximum length: 128 characters
  - Must contain at least one uppercase letter
  - Must contain at least one lowercase letter
  - Must contain at least one number
  - Must contain at least one special character

#### Response Codes
- `200 OK`: Password successfully reset
- `400 Bad Request`: Invalid input data or validation errors
- `401 Unauthorized`: Invalid or expired recovery token
- `404 Not Found`: User not found
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate token and newPassword fields
2. Verify recovery token
3. If token invalid or expired, return 401 Unauthorized
4. Extract user ID from token payload
5. Retrieve user record from database by ID
6. If user not found, return 404 Not Found
7. Hash the newPassword using bcrypt with appropriate salt rounds
8. Update user's password field with new hashed password
9. Delete recovery token from database
10. Invalidate all existing sessions/tokens for user
11. Update updatedAt timestamp
12. Send password reset confirmation email
13. Return success response

## Data Models

### User Profile
```javascript
{
  _id: ObjectId,
  email: String,
  password: String, // Hashed
  firstName: String,
  lastName: String,
  emailVerified: Boolean, // Whether email has been verified
  phoneNumber: String, // User's phone number
  phoneVerified: Boolean, // Whether phone number has been verified
  googleId: String, // Google OAuth ID for Google login users
  twoFactorEnabled: Boolean, // Whether two-factor authentication is enabled
  twoFactorMethod: String, // "sms", "email", or "authenticator"
  preferences: {
    interests: [String],
    constraints: [String],
    travelStyle: String, // "budget", "luxury", "adventure", "cultural", "family", "business"
    budgetRange: String  // "low", "medium", "high", "luxury"
  },
  profile: {
    dateOfBirth: Date,
    nationality: String,
    languages: [String],
    specialRequirements: [String]
  },
  createdAt: Date,
  updatedAt: Date,
  lastLogin: Date
}
```

### Additional Authentication Models

#### Email Verification Token
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  token: String, // JWT token for email verification
  expiresAt: Date,
  createdAt: Date
}
```

#### Phone Verification Code
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  phoneNumber: String,
  code: String, // 6-digit verification code
  expiresAt: Date,
  createdAt: Date
}
```

#### OTP Code
```javascript
{
  _id: ObjectId,
  email: String,
  code: String, // 6-digit OTP code
  expiresAt: Date,
  createdAt: Date
}
```

#### Two-Factor Authentication
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  method: String, // "sms", "email", or "authenticator"
  secret: String, // TOTP secret for authenticator apps
  enabled: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

#### Account Recovery Token
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  token: String, // JWT token for account recovery
  expiresAt: Date,
  createdAt: Date
}

## Security Considerations
1. All passwords must be hashed using bcrypt with appropriate salt rounds
2. JWT tokens must have appropriate expiration times
3. Rate limiting must be implemented for authentication endpoints
4. Input validation must be performed on all fields
5. Sensitive information (passwords) must never be returned in API responses
6. HTTPS must be enforced in production environments