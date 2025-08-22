# Trip Service Specification

## Overview
The Trip Service handles all trip-related functionality including trip creation, management, itinerary generation, optimization, and export capabilities. This service is responsible for managing trip data, generating intelligent schedules based on user preferences and constraints, and providing tools for users to customize their travel plans.

## API Endpoints

### 1. Create Trip
- **Endpoint**: `POST /api/trips`
- **Description**: Creates a new trip with basic information and initializes an empty itinerary
- **Authentication**: Required (JWT)

#### Request Body
```json
{
  "name": "string",
  "destination": {
    "origin": "string",
    "destination": "string",
    "startDate": "ISO 8601 date",
    "endDate": "ISO 8601 date"
  },
  "travelers": {
    "adults": "number",
    "children": "number",
    "infants": "number"
  },
  "budget": {
    "total": "number",
    "currency": "string"
  },
  "preferences": {
    "interests": ["string"],
    "constraints": ["string"],
    "specialRequests": ["string"]
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
  - Maximum length: 100 characters
- `destination.destination`:
  - Required field
  - Maximum length: 100 characters
- `destination.startDate`:
 - Required field
  - Must be a valid date
  - Must be before endDate
- `destination.endDate`:
  - Required field
  - Must be a valid date
  - Must be after startDate
- `travelers.adults`:
  - Required field
  - Must be a positive integer
  - Minimum value: 1
  - Maximum value: 20
- `travelers.children`:
  - Optional field
  - Must be a non-negative integer
  - Maximum value: 20
- `travelers.infants`:
  - Optional field
  - Must be a non-negative integer
  - Maximum value: 20
- `budget.total`:
  - Optional field
  - Must be a positive number
  - Maximum value: 1000000
- `budget.currency`:
  - Optional field
  - Must be a valid ISO 4217 currency code
  - Maximum length: 3 characters
- `preferences.interests`:
  - Optional array
  - Each item must be a string with maximum 50 characters
  - Maximum of 20 interests
- `preferences.constraints`:
  - Optional array
  - Each item must be a string with maximum 100 characters
  - Maximum of 10 constraints
- `preferences.specialRequests`:
  - Optional array
  - Each item must be a string with maximum 200 characters
  - Maximum of 10 special requests

#### Response Codes
- `201 Created`: Trip successfully created
- `400 Bad Request`: Invalid input data or validation errors
- `401 Unauthorized`: Missing or invalid authentication token
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate all input fields according to specified validation rules
2. Extract user ID from JWT token
3. Generate a unique trip ID
4. Initialize empty itinerary structure
5. Set trip status to "draft"
6. Set createdAt and updatedAt timestamps
7. Create trip record in database
8. Return created trip data

### 2. Get User Trips
- **Endpoint**: `GET /api/trips`
- **Description**: Retrieves a list of trips for the authenticated user with optional filtering and pagination
- **Authentication**: Required (JWT)

#### Request Parameters
- `status` (optional): Filter trips by status (draft, planned, in-progress, completed)
- `limit` (optional): Number of trips to return (default: 10, max: 50)
- `offset` (optional): Number of trips to skip for pagination (default: 0)
- `sortBy` (optional): Field to sort by (createdAt, updatedAt, name)
- `sortOrder` (optional): Sort order (asc, desc)

#### Response Codes
- `200 OK`: Trips successfully retrieved
- `400 Bad Request`: Invalid query parameters
- `401 Unauthorized`: Missing or invalid authentication token
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate JWT token from Authorization header
2. Extract user ID from token payload
3. Parse and validate query parameters
4. Query database for trips belonging to user with applied filters
5. Apply pagination to results
6. Return trips list with pagination metadata

### 3. Get Trip Details
- **Endpoint**: `GET /api/trips/:id`
- **Description**: Retrieves detailed information for a specific trip
- **Authentication**: Required (JWT)

#### Request Parameters
- `id`: Trip ID (URL parameter)

#### Response Codes
- `200 OK`: Trip details successfully retrieved
- `400 Bad Request`: Invalid trip ID format
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: User does not have access to this trip
- `404 Not Found`: Trip not found
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate JWT token from Authorization header
2. Extract user ID from token payload
3. Validate trip ID format
4. Retrieve trip record from database by ID
5. Verify user has access to this trip
6. If trip not found, return 404 Not Found
7. Return trip details

### 4. Update Trip
- **Endpoint**: `PUT /api/trips/:id`
- **Description**: Updates trip information
- **Authentication**: Required (JWT)

#### Request Body
```json
{
  "name": "string",
  "destination": {
    "origin": "string",
    "destination": "string",
    "startDate": "ISO 8601 date",
    "endDate": "ISO 8601 date"
  },
  "travelers": {
    "adults": "number",
    "children": "number",
    "infants": "number"
  },
  "budget": {
    "total": "number",
    "currency": "string",
    "breakdown": {
      "accommodation": "number",
      "transportation": "number",
      "food": "number",
      "activities": "number",
      "shopping": "number",
      "other": "number"
    }
  },
  "preferences": {
    "interests": ["string"],
    "constraints": ["string"],
    "specialRequests": ["string"]
  }
}
```

#### Field Validations
Same as Create Trip endpoint, but all fields are optional for updates.

#### Response Codes
- `200 OK`: Trip successfully updated
- `400 Bad Request`: Invalid input data or validation errors
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: User does not have access to this trip
- `404 Not Found`: Trip not found
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate JWT token from Authorization header
2. Extract user ID from token payload
3. Validate trip ID format
4. Validate input fields according to validation rules
5. Retrieve trip record from database by ID
6. Verify user has access to this trip
7. If trip not found, return 404 Not Found
8. Update trip fields with provided values
9. Update updatedAt timestamp
10. Save updated trip record to database
1. Return updated trip data

### 5. Delete Trip
- **Endpoint**: `DELETE /api/trips/:id`
- **Description**: Permanently deletes a trip
- **Authentication**: Required (JWT)

#### Request Parameters
- `id`: Trip ID (URL parameter)

#### Response Codes
- `204 No Content`: Trip successfully deleted
- `400 Bad Request`: Invalid trip ID format
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: User does not have access to this trip
- `404 Not Found`: Trip not found
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate JWT token from Authorization header
2. Extract user ID from token payload
3. Validate trip ID format
4. Retrieve trip record from database by ID
5. Verify user has access to this trip
6. If trip not found, return 404 Not Found
7. Delete trip record from database
8. Delete associated data (itinerary, bookings, etc.)
9. Return 204 No Content response

### 6. Generate Draft Schedule
- **Endpoint**: `POST /api/trips/:id/generate-draft`
- **Description**: Generates an initial draft schedule for the trip using AI
- **Authentication**: Required (JWT)

#### Request Body
```json
{
  "focus": "string" // Optional focus for schedule generation (e.g., "cultural", "adventure", "relaxation")
}
```

#### Field Validations
- `focus`:
  - Optional field
  - Must be one of: "cultural", "adventure", "relaxation", "family", "business", "romantic"
  - Maximum length: 20 characters

#### Response Codes
- `200 OK`: Draft schedule successfully generated
- `400 Bad Request`: Invalid input data or validation errors
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: User does not have access to this trip
- `404 Not Found`: Trip not found
- `409 Conflict`: Trip already has a schedule
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Unexpected server error
- `503 Service Unavailable`: AI service temporarily unavailable

#### Business Logic
1. Validate JWT token from Authorization header
2. Extract user ID from token payload
3. Validate trip ID format
4. Validate input fields
5. Retrieve trip record from database by ID
6. Verify user has access to this trip
7. If trip not found, return 404 Not Found
8. Check if trip already has a schedule, if so return 409 Conflict
9. Call AI service to generate draft schedule based on trip details
10. Process and validate AI response
11. Update trip itinerary with generated schedule
12. Set trip status to "planned"
13. Update updatedAt timestamp
14. Save updated trip record to database
15. Return updated trip data

### 7. Optimize Trip
- **Endpoint**: `POST /api/trips/:id/optimize`
- **Description**: Optimizes the trip schedule for better flow and efficiency
- **Authentication**: Required (JWT)

#### Request Body
```json
{
  "focus": "string" // Optional focus for optimization (e.g., "time", "cost", "distance")
}
```

#### Field Validations
- `focus`:
  - Optional field
  - Must be one of: "time", "cost", "distance"
  - Maximum length: 10 characters

#### Response Codes
- `200 OK`: Trip successfully optimized
- `400 Bad Request`: Invalid input data or validation errors
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: User does not have access to this trip
- `404 Not Found`: Trip not found
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Unexpected server error
- `503 Service Unavailable`: AI service temporarily unavailable

#### Business Logic
1. Validate JWT token from Authorization header
2. Extract user ID from token payload
3. Validate trip ID format
4. Validate input fields
5. Retrieve trip record from database by ID
6. Verify user has access to this trip
7. If trip not found, return 404 Not Found
8. Check if trip has an itinerary, if not return 400 Bad Request
9. Call AI service to optimize schedule based on trip details and focus
10. Process and validate AI response
11. Update trip itinerary with optimized schedule
12. Update updatedAt timestamp
13. Save updated trip record to database
14. Return updated trip data

### 8. Export Trip
- **Endpoint**: `POST /api/trips/:id/export`
- **Description**: Exports the trip in various formats
- **Authentication**: Required (JWT)

#### Request Body
```json
{
  "format": "string", // Required export format
  "options": {
    "includeCosts": "boolean",
    "includeNotes": "boolean",
    "timezone": "string"
  }
}
```

#### Field Validations
- `format`:
  - Required field
  - Must be one of: "pdf", "ics", "json"
- `options.includeCosts`:
  - Optional field
  - Boolean value
- `options.includeNotes`:
  - Optional field
  - Boolean value
- `options.timezone`:
  - Optional field
  - Must be a valid IANA timezone identifier
  - Maximum length: 50 characters

#### Response Codes
- `200 OK`: Trip successfully exported
- `400 Bad Request`: Invalid input data or validation errors
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: User does not have access to this trip
- `404 Not Found`: Trip not found
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate JWT token from Authorization header
2. Extract user ID from token payload
3. Validate trip ID format
4. Validate input fields according to validation rules
5. Retrieve trip record from database by ID
6. Verify user has access to this trip
7. If trip not found, return 404 Not Found
8. Generate export data based on requested format and options
9. For PDF export, generate formatted document
10. For ICS export, generate calendar events
11. For JSON export, generate structured data
12. Return export data or URL to download

## Data Models

### Trip
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  name: String,
  destination: {
    origin: String,
    destination: String,
    startDate: Date,
    endDate: Date
  },
  travelers: {
    adults: Number,
    children: Number,
    infants: Number
  },
  budget: {
    total: Number,
    currency: String,
    breakdown: {
      accommodation: Number,
      transportation: Number,
      food: Number,
      activities: Number,
      shopping: Number,
      other: Number
    }
  },
  preferences: {
    interests: [String],
    constraints: [String],
    specialRequests: [String]
  },
  itinerary: {
    days: [{
      date: Date,
      activities: [{
        time: String,
        title: String,
        description: String,
        location: {
          name: String,
          address: String,
          coordinates: {
            lat: Number,
            lng: Number
          }
        },
        duration: Number,
        cost: Number,
        category: String,
        notes: String
      }]
    }]
  },
  status: String, // draft, planned, in-progress, completed
  createdAt: Date,
  updatedAt: Date
}
```

## Security Considerations
1. All endpoints require authentication via JWT tokens
2. Users can only access their own trips
3. Input validation must be performed on all fields
4. Rate limiting must be implemented to prevent abuse
5. Sensitive information must not be logged
6. HTTPS must be enforced in production environments
7. Exported data should be securely handled and temporarily stored