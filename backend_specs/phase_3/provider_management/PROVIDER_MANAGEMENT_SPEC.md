# Provider Management System Specification

## Overview
The Provider Management System handles all functionality related to travel service providers on the TravelSense v2 platform. This service enables providers to register, manage their business profiles, list services, and handle verification processes. It also provides tools for users to discover and interact with providers through ratings and reviews.

## API Endpoints

### 1. Provider Registration
- **Endpoint**: `POST /api/providers/register`
- **Description**: Registers a new service provider on the platform
- **Authentication**: Required (JWT)

#### Request Body
```json
{
  "businessName": "string",
  "businessType": "string",
  "description": "string",
  "contact": {
    "email": "string",
    "phone": "string",
    "website": "string",
    "address": {
      "street": "string",
      "city": "string",
      "country": "string",
      "postalCode": "string"
    }
  },
  "userId": "string" // Optional: Link to existing user account
}
```

#### Field Validations
- `businessName`:
  - Required field
  - Minimum length: 2 characters
  - Maximum length: 100 characters
- `businessType`:
  - Required field
  - Must be one of: "accommodation", "transportation", "activity", "tour", "restaurant", "other"
- `description`:
  - Required field
  - Minimum length: 10 characters
  - Maximum length: 1000 characters
- `contact.email`:
  - Required field
  - Must be a valid email format
  - Maximum length: 254 characters
- `contact.phone`:
  - Required field
  - Must be a valid phone number format
  - Maximum length: 20 characters
- `contact.website`:
  - Optional field
  - Must be a valid URL format if provided
  - Maximum length: 200 characters
- `contact.address.street`:
  - Required field
  - Maximum length: 100 characters
- `contact.address.city`:
  - Required field
  - Maximum length: 50 characters
- `contact.address.country`:
  - Required field
  - Maximum length: 50 characters
- `contact.address.postalCode`:
  - Required field
  - Maximum length: 20 characters
- `userId`:
  - Optional field
  - Must be a valid MongoDB ObjectId if provided

#### Response Codes
- `201 Created`: Provider successfully registered
- `400 Bad Request`: Invalid input data or validation errors
- `401 Unauthorized`: Missing or invalid authentication token
- `409 Conflict`: Provider with same business name or email already exists
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate JWT token from Authorization header
2. Extract user ID from token payload
3. Validate input fields according to validation rules
4. Check if a provider with the same business name or email already exists
5. If duplicate found, return 409 Conflict
6. If userId is provided, verify it belongs to the authenticated user
7. Generate a unique provider ID
8. Initialize verification status to "pending"
9. Set createdAt and updatedAt timestamps
10. Create provider record in database
11. Send verification email to provider contact email
12. Return created provider data (excluding sensitive information)

### 2. Get Provider List
- **Endpoint**: `GET /api/providers`
- **Description**: Retrieves a list of providers with optional filtering and pagination
- **Authentication**: Not required (public endpoint)

#### Request Parameters
```json
{
  "businessType": "string", // Optional filter by business type
  "verified": "boolean", // Optional filter by verification status
  "location": "string", // Optional location filter
  "rating": "number", // Optional minimum rating filter
  "limit": "number", // Optional number of results (default: 20, max: 100)
  "offset": "number", // Optional offset for pagination (default: 0)
  "sortBy": "string", // Optional sort field (rating, createdAt, name)
  "sortOrder": "string" // Optional sort order (asc, desc)
}
```

#### Field Validations
- `businessType`:
  - Optional field
  - Must be one of: "accommodation", "transportation", "activity", "tour", "restaurant", "other"
- `verified`:
  - Optional field
  - Boolean value
- `location`:
  - Optional field
  - Maximum length: 100 characters
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
  - Must be one of: "rating", "createdAt", "name"
- `sortOrder`:
  - Optional field
  - Must be one of: "asc", "desc"

#### Response Codes
- `200 OK`: Providers successfully retrieved
- `400 Bad Request`: Invalid query parameters
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate query parameters according to validation rules
2. Build database query based on provided filters
3. Apply pagination parameters
4. Execute query to retrieve providers
5. Format results for response
6. Return providers list with pagination metadata

### 3. Get Provider Details
- **Endpoint**: `GET /api/providers/:id`
- **Description**: Retrieves detailed information for a specific provider
- **Authentication**: Not required (public endpoint)

#### Request Parameters
- `id`: Provider ID (URL parameter)

#### Response Codes
- `200 OK`: Provider details successfully retrieved
- `400 Bad Request`: Invalid provider ID format
- `404 Not Found`: Provider not found
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate provider ID format
2. Retrieve provider record from database by ID
3. If provider not found, return 404 Not Found
4. Retrieve associated services for the provider
5. Retrieve rating statistics for the provider
6. Format provider details for response
7. Return provider details including services and ratings

### 4. Update Provider Profile
- **Endpoint**: `PUT /api/providers/:id`
- **Description**: Updates provider profile information
- **Authentication**: Required (JWT) - Provider owner or admin only

#### Request Body
```json
{
  "businessName": "string",
  "businessType": "string",
  "description": "string",
  "contact": {
    "email": "string",
    "phone": "string",
    "website": "string",
    "address": {
      "street": "string",
      "city": "string",
      "country": "string",
      "postalCode": "string"
    }
  }
}
```

#### Field Validations
Same as Provider Registration endpoint, but all fields are optional for updates.

#### Response Codes
- `200 OK`: Provider profile successfully updated
- `400 Bad Request`: Invalid input data or validation errors
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: User does not have permission to update this provider
- `404 Not Found`: Provider not found
- `409 Conflict`: Provider with same business name or email already exists
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate JWT token from Authorization header
2. Extract user ID from token payload
3. Validate provider ID format
4. Retrieve provider record from database by ID
5. If provider not found, return 404 Not Found
6. Verify user has permission to update this provider (owner or admin)
7. If user lacks permission, return 403 Forbidden
8. Validate input fields according to validation rules
9. Check if updating businessName or contact.email would create a conflict
10. If conflict found, return 409 Conflict
11. Update provider fields with provided values
12. Update updatedAt timestamp
13. Save updated provider record to database
14. Return updated provider data

### 5. Verify Provider
- **Endpoint**: `POST /api/providers/:id/verify`
- **Description**: Verifies a provider's business information (admin only)
- **Authentication**: Required (JWT) - Admin only

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
1. Validate JWT token from Authorization header
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

### 6. Upload Verification Documents
- **Endpoint**: `POST /api/providers/:id/documents`
- **Description**: Uploads verification documents for a provider
- **Authentication**: Required (JWT) - Provider owner only

#### Request Body
```json
{
  "documents": ["string"] // Array of document URLs or file identifiers
}
```

#### Field Validations
- `documents`:
  - Required field
  - Must be an array
  - Minimum of 1 item
  - Maximum of 10 items
  - Each item must be a valid URL or file identifier

#### Response Codes
- `200 OK`: Documents successfully uploaded
- `400 Bad Request`: Invalid input data or validation errors
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: User does not have permission to upload documents for this provider
- `404 Not Found`: Provider not found
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate JWT token from Authorization header
2. Extract user ID from token payload
3. Validate provider ID format
4. Retrieve provider record from database by ID
5. If provider not found, return 404 Not Found
6. Verify user is the owner of this provider
7. If user is not owner, return 403 Forbidden
8. Validate input fields according to validation rules
9. Process and store document uploads
10. Update provider record with document references
11. Update updatedAt timestamp
12. Save updated provider record to database
13. Return updated provider data

### 7. Get Provider Services
- **Endpoint**: `GET /api/providers/:id/services`
- **Description**: Retrieves services offered by a specific provider
- **Authentication**: Not required (public endpoint)

#### Request Parameters
- `id`: Provider ID (URL parameter)
- `category`: Optional filter by service category
- `limit`: Optional number of results (default: 20, max: 50)
- `offset`: Optional offset for pagination (default: 0)

#### Response Codes
- `200 OK`: Services successfully retrieved
- `400 Bad Request`: Invalid provider ID format or query parameters
- `404 Not Found`: Provider not found
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate provider ID format
2. Retrieve provider record from database by ID
3. If provider not found, return 404 Not Found
4. Validate query parameters according to validation rules
5. Build database query for services based on provider ID and filters
6. Apply pagination parameters
7. Execute query to retrieve services
8. Format results for response
9. Return services list with pagination metadata

### 8. Add Service to Provider
- **Endpoint**: `POST /api/providers/:id/services`
- **Description**: Adds a new service to a provider's offerings
- **Authentication**: Required (JWT) - Provider owner only

#### Request Body
```json
{
  "name": "string",
  "description": "string",
  "category": "string",
  "price": {
    "amount": "number",
    "currency": "string"
  },
  "availability": {
    "days": ["string"],
    "hours": {
      "open": "string",
      "close": "string"
    }
  },
  "location": {
    "name": "string",
    "address": "string",
    "coordinates": {
      "lat": "number",
      "lng": "number"
    }
  }
}
```

#### Field Validations
- `name`:
  - Required field
  - Minimum length: 2 characters
  - Maximum length: 100 characters
- `description`:
  - Required field
  - Minimum length: 10 characters
  - Maximum length: 500 characters
- `category`:
  - Required field
  - Must be one of: "accommodation", "transportation", "activity", "tour", "dining", "other"
- `price.amount`:
  - Required field
  - Must be a positive number
  - Maximum value: 100000
- `price.currency`:
  - Required field
  - Must be a valid ISO 4217 currency code
  - Maximum length: 3 characters
- `availability.days`:
  - Required field
  - Must be an array
  - Each item must be one of: "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"
- `availability.hours.open`:
  - Required field
  - Must be in HH:MM format
- `availability.hours.close`:
  - Required field
  - Must be in HH:MM format
  - Must be later than open time
- `location.name`:
  - Required field
  - Maximum length: 100 characters
- `location.address`:
  - Required field
  - Maximum length: 200 characters
- `location.coordinates.lat`:
  - Required field
  - Must be a number between -90 and 90
- `location.coordinates.lng`:
  - Required field
  - Must be a number between -180 and 180

#### Response Codes
- `201 Created`: Service successfully added
- `400 Bad Request`: Invalid input data or validation errors
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: User does not have permission to add services for this provider
- `404 Not Found`: Provider not found
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate JWT token from Authorization header
2. Extract user ID from token payload
3. Validate provider ID format
4. Retrieve provider record from database by ID
5. If provider not found, return 404 Not Found
6. Verify user is the owner of this provider
7. If user is not owner, return 403 Forbidden
8. Validate input fields according to validation rules
9. Generate a unique service ID
10. Set createdAt and updatedAt timestamps
11. Create service record in database associated with provider
12. Return created service data

## Data Models

### Provider
```javascript
{
  _id: ObjectId,
  userId: ObjectId, // Optional link to user account
  businessName: String,
  businessType: String, // "accommodation", "transportation", "activity", "tour", "restaurant", "other"
  description: String,
  contact: {
    email: String,
    phone: String,
    website: String,
    address: {
      street: String,
      city: String,
      country: String,
      postalCode: String
    }
  },
  services: [ObjectId], // References to service documents
  verification: {
    status: String, // "pending", "verified", "rejected"
    documents: [String], // URLs to verification documents
    notes: String,
    verifiedBy: ObjectId, // Admin who verified
    verifiedAt: Date
  },
  ratings: {
    average: Number, // 0-5
    count: Number
  },
  createdAt: Date,
  updatedAt: Date
}
```

### Service
```javascript
{
  _id: ObjectId,
  providerId: ObjectId,
  name: String,
  description: String,
  category: String, // "accommodation", "transportation", "activity", "tour", "dining", "other"
  price: {
    amount: Number,
    currency: String
  },
  availability: {
    days: [String], // ["monday", "tuesday", ...]
    hours: {
      open: String, // "09:00"
      close: String // "17:0"
    }
  },
  location: {
    name: String,
    address: String,
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  createdAt: Date,
  updatedAt: Date
}
```

## Security Considerations
1. Provider registration requires authentication via JWT tokens
2. Provider profile updates are restricted to owners and admins
3. Provider verification is restricted to admins only
4. Input validation must be performed on all fields
5. Sensitive information (documents, internal notes) must not be exposed in public endpoints
6. Rate limiting must be implemented to prevent abuse
7. HTTPS must be enforced in production environments
8. File uploads must be properly validated and sanitized