# Gemini AI Integration Specification

## Overview
The Gemini AI Integration service provides the core artificial intelligence capabilities for the TravelSense v2 platform. This service implements a dual-model approach using Gemini Flash for chat and ideation tasks and Gemini Pro for validation and complex reasoning. The service handles API communication, rate limiting, response validation, and integration with other platform services.

## API Endpoints

### 1. Chat with AI
- **Endpoint**: `POST /api/ai/chat`
- **Description**: Engages in conversational interaction with the AI for trip planning ideation and suggestions
- **Authentication**: Required (JWT)

#### Request Body
```json
{
  "message": "string",
  "context": {
    "tripId": "string",
    "conversationHistory": [
      {
        "role": "string",
        "content": "string",
        "timestamp": "ISO 8601 date"
      }
    ]
  },
  "model": "string" // Optional: specify which model to use (flash or pro)
}
```

#### Field Validations
- `message`:
  - Required field
  - Minimum length: 1 character
  - Maximum length: 2000 characters
- `context.tripId`:
  - Optional field
  - Must be a valid MongoDB ObjectId if provided
- `context.conversationHistory`:
  - Optional array
  - Maximum of 10 conversation exchanges
  - Each exchange must have role and content fields
- `context.conversationHistory[].role`:
  - Must be one of: "user", "assistant"
- `context.conversationHistory[].content`:
  - Must be a string with maximum 2000 characters
- `model`:
  - Optional field
  - Must be one of: "flash", "pro"
  - Defaults to "flash" if not specified

#### Response Codes
- `200 OK`: Successful AI response
- `400 Bad Request`: Invalid input data or validation errors
- `401 Unauthorized`: Missing or invalid authentication token
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Unexpected server error
- `503 Service Unavailable`: AI service temporarily unavailable

#### Business Logic
1. Validate JWT token from Authorization header
2. Extract user ID from token payload
3. Validate input fields according to validation rules
4. If tripId is provided, verify user has access to the trip
5. Determine which model to use (Flash by default, or as specified)
6. Check rate limits for the selected model
7. If rate limit exceeded, return 429 Too Many Requests
8. Prepare conversation context with user message
9. Call appropriate Gemini API endpoint
10. Process and validate AI response
11. Apply response refinement based on conversation history
12. Log interaction for analytics and improvement
13. Return AI response to client

### 2. Generate Trip Itinerary
- **Endpoint**: `POST /api/ai/generate-itinerary`
- **Description**: Generates a complete trip itinerary based on user preferences and constraints using Gemini Pro for structured output
- **Authentication**: Required (JWT)

#### Request Body
```json
{
  "tripId": "string",
  "focus": "string" // Optional focus for itinerary generation
}
```

#### Field Validations
- `tripId`:
  - Required field
  - Must be a valid MongoDB ObjectId
- `focus`:
  - Optional field
  - Must be one of: "cultural", "adventure", "relaxation", "family", "business", "romantic"
  - Maximum length: 20 characters

#### Response Codes
- `200 OK`: Itinerary successfully generated
- `400 Bad Request`: Invalid input data or validation errors
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: User does not have access to this trip
- `404 Not Found`: Trip not found
- `409 Conflict`: Trip already has a complete itinerary
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Unexpected server error
- `503 Service Unavailable`: AI service temporarily unavailable

#### Business Logic
1. Validate JWT token from Authorization header
2. Extract user ID from token payload
3. Validate trip ID format
4. Validate focus field if provided
5. Retrieve trip record from database by ID
6. Verify user has access to this trip
7. If trip not found, return 404 Not Found
8. Check if trip already has a complete itinerary, if so return 409 Conflict
9. Extract trip details, preferences, and constraints
10. Prepare structured prompt for Gemini Pro with all relevant information
11. Check rate limits for Gemini Pro (2 requests per minute)
12. If rate limit exceeded, return 429 Too Many Requests
13. Call Gemini Pro API to generate structured itinerary
14. Process and validate AI response for consistency and completeness
15. Validate that generated itinerary respects user constraints
16. Format response into trip service compatible structure
17. Return generated itinerary data

### 3. Optimize Trip Schedule
- **Endpoint**: `POST /api/ai/optimize-schedule`
- **Description**: Optimizes an existing trip schedule for better flow, efficiency, and constraint satisfaction
- **Authentication**: Required (JWT)

#### Request Body
```json
{
  "tripId": "string",
  "focus": "string", // Optional focus for optimization
  "parameters": {
    "timeEfficiency": "boolean",
    "costEfficiency": "boolean",
    "distanceMinimization": "boolean"
  }
}
```

#### Field Validations
- `tripId`:
  - Required field
  - Must be a valid MongoDB ObjectId
- `focus`:
  - Optional field
  - Must be one of: "time", "cost", "distance"
  - Maximum length: 10 characters
- `parameters.timeEfficiency`:
  - Optional field
  - Boolean value
- `parameters.costEfficiency`:
  - Optional field
  - Boolean value
- `parameters.distanceMinimization`:
  - Optional field
  - Boolean value

#### Response Codes
- `200 OK`: Schedule successfully optimized
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
4. Validate focus and parameters fields
5. Retrieve trip record from database by ID
6. Verify user has access to this trip
7. If trip not found, return 404 Not Found
8. Check if trip has an itinerary, if not return 400 Bad Request
9. Extract current itinerary and trip details
10. Prepare optimization prompt for Gemini Pro with current schedule and optimization focus
11. Check rate limits for Gemini Pro
12. If rate limit exceeded, return 429 Too Many Requests
13. Call Gemini Pro API to generate optimized schedule
14. Process and validate AI response for consistency
15. Ensure optimized schedule still meets user constraints
16. Format response into trip service compatible structure
17. Return optimized schedule data

### 4. Validate Trip Constraints
- **Endpoint**: `POST /api/ai/validate-constraints`
- **Description**: Validates that a trip itinerary satisfies all user constraints and identifies potential conflicts
- **Authentication**: Required (JWT)

#### Request Body
```json
{
  "tripId": "string",
  "checkType": "string" // Optional type of validation to perform
}
```

#### Field Validations
- `tripId`:
  - Required field
  - Must be a valid MongoDB ObjectId
- `checkType`:
  - Optional field
  - Must be one of: "all", "time", "budget", "preferences", "constraints"
  - Defaults to "all" if not specified

#### Response Codes
- `200 OK`: Constraint validation completed
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
4. Validate checkType field
5. Retrieve trip record from database by ID
6. Verify user has access to this trip
7. If trip not found, return 404 Not Found
8. Extract trip details, itinerary, preferences, and constraints
9. Prepare validation prompt for Gemini Pro with all relevant information
10. Check rate limits for Gemini Pro
11. If rate limit exceeded, return 429 Too Many Requests
12. Call Gemini Pro API to validate constraints
13. Process and validate AI response
14. Identify any constraint violations or potential conflicts
15. Format validation results into structured response
16. Return validation report with any identified issues

### 5. Generate Activity Suggestions
- **Endpoint**: `POST /api/ai/suggest-activities`
- **Description**: Generates personalized activity suggestions for a specific day or time period in a trip
- **Authentication**: Required (JWT)

#### Request Body
```json
{
  "tripId": "string",
  "date": "ISO 8601 date", // Optional specific date for suggestions
  "timePeriod": "string", // Optional time period (morning, afternoon, evening)
  "interests": ["string"], // Optional override of user interests
 "constraints": ["string"] // Optional override of user constraints
}
```

#### Field Validations
- `tripId`:
  - Required field
  - Must be a valid MongoDB ObjectId
- `date`:
  - Optional field
  - Must be a valid date within the trip date range
- `timePeriod`:
  - Optional field
  - Must be one of: "morning", "afternoon", "evening", "full-day"
- `interests`:
  - Optional array
  - Each item must be a string with maximum 50 characters
  - Maximum of 10 interests
- `constraints`:
  - Optional array
  - Each item must be a string with maximum 100 characters
  - Maximum of 5 constraints

#### Response Codes
- `200 OK`: Activity suggestions successfully generated
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
4. Validate date, timePeriod, interests, and constraints fields
5. Retrieve trip record from database by ID
6. Verify user has access to this trip
7. If trip not found, return 404 Not Found
8. Extract trip details, preferences, and constraints
9. If date is provided, verify it's within trip date range
10. Prepare suggestion prompt for Gemini Flash with relevant context
11. Check rate limits for Gemini Flash (15 requests per minute)
12. If rate limit exceeded, return 429 Too Many Requests
13. Call Gemini Flash API to generate activity suggestions
14. Process and validate AI response for relevance and feasibility
15. Format suggestions into structured response with details
16. Return activity suggestions with descriptions and metadata

## Data Models

### AI Interaction Log
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  tripId: ObjectId, // Optional, if interaction is trip-specific
  endpoint: String, // Which AI endpoint was called
  model: String, // Which model was used (flash or pro)
  request: {
    prompt: String,
    parameters: Object
  },
  response: {
    content: String,
    tokensUsed: Number,
    processingTime: Number // In milliseconds
  },
  timestamp: Date,
  success: Boolean,
  error: String // If applicable
}
```

### Rate Limit Tracker
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  model: String, // "flash" or "pro"
  windowStart: Date,
  requestCount: Number,
  lastRequestAt: Date
}
```

## Rate Limiting Implementation

### Gemini Flash (15 requests per minute)
- **Rate Limit**: 15 requests per user per minute
- **Purpose**: Chat, ideation, and creative suggestions
- **Fallback**: Queue requests when limit is reached

### Gemini Pro (2 requests per minute)
- **Rate Limit**: 2 requests per user per minute
- **Purpose**: Validation, structured output, and complex reasoning
- **Fallback**: Queue requests with priority for critical operations

## Error Handling and Fallbacks

### API Error Responses
- **429 Too Many Requests**: Implement request queuing with configurable timeouts
- **503 Service Unavailable**: Implement exponential backoff retry mechanism
- **Network Errors**: Implement retry logic with circuit breaker pattern

### Fallback Mechanisms
1. **Rate Limit Exceeded**:
   - Queue requests with priority based on operation type
   - Return 429 with estimated wait time
   - Process queued requests when capacity becomes available

2. **Service Unavailable**:
   - Implement exponential backoff (1s, 2s, 4s, 8s, max 30s)
   - Retry up to 5 times before failing
   - Return 503 with user-friendly message

3. **API Errors**:
   - Log detailed error information for debugging
   - Implement circuit breaker to prevent cascading failures
   - Provide graceful degradation when possible

## Security Considerations
1. All endpoints require authentication via JWT tokens
2. API keys for Gemini services must be securely stored in environment variables
3. Rate limiting prevents abuse and ensures fair usage
4. Input validation prevents injection attacks
5. Conversation history is sanitized before sending to AI services
6. User data is not stored in AI service logs
7. HTTPS must be enforced in production environments
8. Sensitive information must not be included in prompts or logs