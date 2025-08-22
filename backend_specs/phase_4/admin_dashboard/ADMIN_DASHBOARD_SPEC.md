# Admin Dashboard Backend Specification

## Overview
The Admin Dashboard Backend provides the API endpoints and business logic for the administrative interface of the TravelSense v2 platform. This service enables administrators to manage users, providers, bookings, content, and monitor platform performance. It includes reporting capabilities, user management tools, and system configuration options.

## API Endpoints

### 1. Admin Authentication
- **Endpoint**: `POST /api/admin/login`
- **Description**: Authenticates admin users and provides access token
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
2. Retrieve admin user record by email from database
3. If admin user not found, return 401 Unauthorized
4. Compare provided password with stored hashed password
5. If password mismatch, return 401 Unauthorized
6. Update admin user's lastLogin timestamp
7. Generate JWT admin access token with appropriate expiration
8. Generate refresh token for session management
9. Store refresh token in database
10. Set refresh token in HTTP-only cookie
11. Return admin user data (excluding password) and access token

### 2. Get Dashboard Statistics
- **Endpoint**: `GET /api/admin/dashboard/stats`
- **Description**: Retrieves key platform statistics for admin dashboard
- **Authentication**: Required (Admin JWT)

#### Request Parameters
- None

#### Response Codes
- `200 OK`: Statistics successfully retrieved
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: User does not have admin privileges
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate admin JWT token from Authorization header
2. Extract user ID and role from token payload
3. Verify user has admin privileges
4. If user not admin, return 403 Forbidden
5. Calculate key platform statistics:
   - Total users
   - Total providers
   - Total bookings
   - Revenue metrics
   - User engagement metrics
   - System performance metrics
6. Format statistics for response
7. Return dashboard statistics

### 3. Get User List
- **Endpoint**: `GET /api/admin/users`
- **Description**: Retrieves list of all users with filtering and pagination
- **Authentication**: Required (Admin JWT)

#### Request Parameters
```json
{
  "search": "string", // Optional search term
  "status": "string", // Optional filter by user status
  "role": "string", // Optional filter by user role
  "limit": "number", // Optional number of results (default: 20, max: 100)
  "offset": "number", // Optional offset for pagination (default: 0)
  "sortBy": "string", // Optional sort field (createdAt, lastLogin, email)
  "sortOrder": "string" // Optional sort order (asc, desc)
}
```

#### Field Validations
- `search`:
  - Optional field
  - Maximum length: 100 characters
- `status`:
  - Optional field
  - Must be one of: "active", "suspended", "deleted"
- `role`:
  - Optional field
  - Must be one of: "user", "provider", "admin"
- `limit`:
  - Optional field
  - Must be a positive integer
  - Minimum value: 1
  - Maximum value: 100
  - Defaults to 20 if not specified
- `offset`:
  - Optional field
  - Must be a non-negative integer
  - Defaults to 0 if not specified
- `sortBy`:
  - Optional field
  - Must be one of: "createdAt", "lastLogin", "email"
- `sortOrder`:
  - Optional field
  - Must be one of: "asc", "desc"

#### Response Codes
- `200 OK`: Users successfully retrieved
- `400 Bad Request`: Invalid query parameters
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: User does not have admin privileges
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate admin JWT token from Authorization header
2. Extract user ID and role from token payload
3. Verify user has admin privileges
4. If user not admin, return 403 Forbidden
5. Validate query parameters according to validation rules
6. Build database query based on provided filters
7. Apply pagination parameters
8. Execute query to retrieve users
9. Format results for response (exclude sensitive information)
10. Return users list with pagination metadata

### 4. Get User Details
- **Endpoint**: `GET /api/admin/users/:id`
- **Description**: Retrieves detailed information for a specific user
- **Authentication**: Required (Admin JWT)

#### Request Parameters
- `id`: User ID (URL parameter)

#### Response Codes
- `200 OK`: User details successfully retrieved
- `400 Bad Request`: Invalid user ID format
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: User does not have admin privileges
- `404 Not Found`: User not found
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate admin JWT token from Authorization header
2. Extract user ID and role from token payload
3. Verify user has admin privileges
4. If user not admin, return 403 Forbidden
5. Validate user ID format
6. Retrieve user record from database by ID
7. If user not found, return 404 Not Found
8. Format user details for response (exclude sensitive information)
9. Return user details

### 5. Update User
- **Endpoint**: `PUT /api/admin/users/:id`
- **Description**: Updates user information (admin only)
- **Authentication**: Required (Admin JWT)

#### Request Body
```json
{
  "email": "string",
  "firstName": "string",
  "lastName": "string",
  "status": "string", // User account status
  "role": "string" // User role
}
```

#### Field Validations
- `email`:
  - Optional field
  - Must be a valid email format
  - Maximum length: 254 characters
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
- `status`:
  - Optional field
  - Must be one of: "active", "suspended", "deleted"
- `role`:
  - Optional field
  - Must be one of: "user", "provider", "admin"

#### Response Codes
- `200 OK`: User successfully updated
- `400 Bad Request`: Invalid input data or validation errors
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: User does not have admin privileges
- `404 Not Found`: User not found
- `409 Conflict`: Email already registered
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate admin JWT token from Authorization header
2. Extract user ID and role from token payload
3. Verify user has admin privileges
4. If user not admin, return 403 Forbidden
5. Validate user ID format
6. Retrieve user record from database by ID
7. If user not found, return 404 Not Found
8. Validate input fields according to validation rules
9. If email is being updated, check if it's already registered
10. If email conflict found, return 409 Conflict
1. Update user fields with provided values
12. Update updatedAt timestamp
13. Save updated user record to database
14. Return updated user data

### 6. Suspend User
- **Endpoint**: `POST /api/admin/users/:id/suspend`
- **Description**: Suspends a user account (admin only)
- **Authentication**: Required (Admin JWT)

#### Request Parameters
- `id`: User ID (URL parameter)

#### Request Body
```json
{
  "reason": "string", // Optional suspension reason
  "duration": "number" // Optional suspension duration in days
}
```

#### Field Validations
- `reason`:
  - Optional field
  - Maximum length: 200 characters
- `duration`:
  - Optional field
  - Must be a positive integer
  - Maximum value: 365

#### Response Codes
- `200 OK`: User successfully suspended
- `400 Bad Request`: Invalid input data or validation errors
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: User does not have admin privileges
- `404 Not Found`: User not found
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate admin JWT token from Authorization header
2. Extract user ID and role from token payload
3. Verify user has admin privileges
4. If user not admin, return 403 Forbidden
5. Validate user ID format
6. Retrieve user record from database by ID
7. If user not found, return 404 Not Found
8. Validate input fields according to validation rules
9. Set user status to "suspended"
10. Record suspension reason and duration if provided
11. Set suspension start and end dates
12. Update updatedAt timestamp
13. Save updated user record to database
14. Send suspension notification email to user
15. Return updated user data

### 7. Get Provider List
- **Endpoint**: `GET /api/admin/providers`
- **Description**: Retrieves list of all providers with filtering and pagination
- **Authentication**: Required (Admin JWT)

#### Request Parameters
```json
{
  "search": "string", // Optional search term
  "status": "string", // Optional filter by verification status
  "businessType": "string", // Optional filter by business type
  "rating": "number", // Optional minimum rating filter
  "limit": "number", // Optional number of results (default: 20, max: 100)
  "offset": "number", // Optional offset for pagination (default: 0)
  "sortBy": "string", // Optional sort field (createdAt, rating, name)
  "sortOrder": "string" // Optional sort order (asc, desc)
}
```

#### Field Validations
- `search`:
  - Optional field
  - Maximum length: 100 characters
- `status`:
  - Optional field
  - Must be one of: "pending", "verified", "rejected"
- `businessType`:
  - Optional field
  - Must be one of: "accommodation", "transportation", "activity", "tour", "restaurant", "other"
- `rating`:
  - Optional field
  - Must be a number between 0 and 5
- `limit`:
  - Optional field
  - Must be a positive integer
  - Minimum value: 1
  - Maximum value: 100
  - Defaults to 20 if not specified
- `offset`:
  - Optional field
  - Must be a non-negative integer
  - Defaults to 0 if not specified
- `sortBy`:
  - Optional field
  - Must be one of: "createdAt", "rating", "name"
- `sortOrder`:
  - Optional field
  - Must be one of: "asc", "desc"

#### Response Codes
- `200 OK`: Providers successfully retrieved
- `400 Bad Request`: Invalid query parameters
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: User does not have admin privileges
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate admin JWT token from Authorization header
2. Extract user ID and role from token payload
3. Verify user has admin privileges
4. If user not admin, return 403 Forbidden
5. Validate query parameters according to validation rules
6. Build database query based on provided filters
7. Apply pagination parameters
8. Execute query to retrieve providers
9. Format results for response
10. Return providers list with pagination metadata

### 8. Verify Provider
- **Endpoint**: `POST /api/admin/providers/:id/verify`
- **Description**: Verifies a provider's business information (admin only)
- **Authentication**: Required (Admin JWT)

#### Request Parameters
- `id`: Provider ID (URL parameter)

#### Request Body
```json
{
  "status": "string", // Required verification status
  "notes": "string" // Optional verification notes
}
```

#### Field Validations
- `status`:
  - Required field
  - Must be one of: "verified", "rejected"
- `notes`:
  - Optional field
  - Maximum length: 500 characters

#### Response Codes
- `200 OK`: Provider verification status successfully updated
- `400 Bad Request`: Invalid input data or validation errors
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: User does not have admin privileges
- `404 Not Found`: Provider not found
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate admin JWT token from Authorization header
2. Extract user ID and role from token payload
3. Verify user has admin privileges
4. If user not admin, return 403 Forbidden
5. Validate provider ID format
6. Retrieve provider record from database by ID
7. If provider not found, return 404 Not Found
8. Validate input fields according to validation rules
9. Update provider verification status
10. Record verification notes if provided
11. Set verifiedBy field to admin user ID
12. Set verifiedAt timestamp
13. Update updatedAt timestamp
14. Save updated provider record to database
15. If status is "verified", send verification confirmation email
16. If status is "rejected", send rejection notification email
17. Return updated provider data

### 9. Get System Reports
- **Endpoint**: `GET /api/admin/reports`
- **Description**: Retrieves system reports and analytics data
- **Authentication**: Required (Admin JWT)

#### Request Parameters
```json
{
  "type": "string", // Required report type
  "startDate": "ISO 8601 date", // Optional start date
  "endDate": "ISO 8601 date", // Optional end date
 "format": "string" // Optional format (json, csv)
}
```

#### Field Validations
- `type`:
  - Required field
  - Must be one of: "user_activity", "revenue", "bookings", "providers", "reviews"
- `startDate`:
  - Optional field
  - Must be a valid date if provided
- `endDate`:
  - Optional field
  - Must be a valid date if provided
  - Must be after startDate if both are specified
- `format`:
  - Optional field
  - Must be one of: "json", "csv"

#### Response Codes
- `200 OK`: Report successfully generated
- `400 Bad Request`: Invalid input data or validation errors
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: User does not have admin privileges
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate admin JWT token from Authorization header
2. Extract user ID and role from token payload
3. Verify user has admin privileges
4. If user not admin, return 403 Forbidden
5. Validate input fields according to validation rules
6. Generate requested report based on type and date range
7. Format report data according to specified format
8. Return report data or file download URL

### 10. Get System Health
- **Endpoint**: `GET /api/admin/health`
- **Description**: Retrieves system health and status information
- **Authentication**: Required (Admin JWT)

#### Request Parameters
- None

#### Response Codes
- `200 OK`: Health information successfully retrieved
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: User does not have admin privileges
- `500 Internal Server Error`: System health issues detected

#### Business Logic
1. Validate admin JWT token from Authorization header
2. Extract user ID and role from token payload
3. Verify user has admin privileges
4. If user not admin, return 403 Forbidden
5. Check system health status of all services:
   - Database connectivity
   - External API status
   - Cache service status
   - Payment provider status
   - Email service status
6. Collect performance metrics:
   - Response times
   - Error rates
   - Resource utilization
7. Format health information for response
8. Return system health status

## Data Models

### Admin User
```javascript
{
  _id: ObjectId,
  email: String,
  password: String, // Hashed
  firstName: String,
  lastName: String,
 role: String, // "admin"
  permissions: [String], // Specific admin permissions
  lastLogin: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### Admin Activity Log
```javascript
{
  _id: ObjectId,
  adminId: ObjectId,
  action: String, // Action performed
  resource: String, // Resource affected
  resourceId: ObjectId, // ID of affected resource
  details: Object, // Additional details about the action
  ipAddress: String, // IP address of admin user
  userAgent: String, // User agent string
  timestamp: Date
}
```

### System Report
```javascript
{
  _id: ObjectId,
  type: String, // Report type
  startDate: Date,
  endDate: Date,
  data: Object, // Report data
  generatedBy: ObjectId, // Admin who generated report
  generatedAt: Date
}
```

## Admin Permissions

### User Management
- View all users
- Edit user information
- Suspend/unsuspend users
- Delete users
- Reset user passwords

### Provider Management
- View all providers
- Verify/reject providers
- Edit provider information
- Suspend providers

### Content Management
- Moderate reviews
- Manage platform content
- Configure system settings

### Reporting
- Generate system reports
- View analytics data
- Export data

### System Administration
- View system health
- Configure system settings
- Manage admin users

## Security Considerations

### Authentication
1. Separate admin authentication system from regular user authentication
2. Strong password requirements for admin accounts
3. Two-factor authentication for admin users
4. Session management with secure tokens
5. IP address restrictions for admin access

### Authorization
1. Role-based access control for admin functions
2. Fine-grained permissions for specific actions
3. Activity logging for all admin actions
4. Regular permission audits

### Data Protection
1. Input validation and sanitization on all endpoints
2. Secure storage of admin credentials
3. Encryption of sensitive admin data
4. Regular security audits

### Monitoring
1. Real-time monitoring of admin activities
2. Alerting for suspicious admin actions
3. Rate limiting for admin endpoints
4. Session timeout for inactive admins

## Audit Logging

### Logged Actions
1. User management actions (create, update, delete, suspend)
2. Provider management actions (verify, reject, update)
3. Content moderation actions (approve, reject reviews)
4. System configuration changes
5. Report generation
6. Login/logout events

### Log Retention
1. Activity logs retained for 1 year
2. System logs retained for 30 days
3. Security logs retained for 1 year
4. Regular log rotation and archiving