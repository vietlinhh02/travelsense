# Vector Search Implementation Specification

## Overview
The Vector Search Implementation enables semantic search capabilities within the TravelSense v2 platform using MongoDB Atlas Vector Search. This service generates vector embeddings using the Gemini AI Embeddings API and stores them in MongoDB for efficient similarity searches. The implementation supports finding similar trips, destinations, and activities based on user preferences and trip characteristics.

## API Endpoints

### 1. Search for Similar Trips
- **Endpoint**: `GET /api/search/trips`
- **Description**: Finds trips similar to a given trip based on semantic similarity of trip characteristics
- **Authentication**: Required (JWT)

#### Request Parameters
```json
{
  "tripId": "string", // Optional ID of trip to find similar trips for
  "query": "string", // Optional text query for semantic search
  "limit": "number", // Optional number of results to return (default: 10, max: 50)
  "filters": {
    "destination": "string", // Optional destination filter
    "budgetRange": "string", // Optional budget range filter
    "travelStyle": "string", // Optional travel style filter
    "duration": {
      "min": "number", // Minimum trip duration in days
      "max": "number" // Maximum trip duration in days
    }
  }
}
```

#### Field Validations
- `tripId`:
  - Optional field
  - Must be a valid MongoDB ObjectId if provided
- `query`:
  - Optional field
  - Maximum length: 500 characters
- `limit`:
  - Optional field
  - Must be a positive integer
  - Minimum value: 1
  - Maximum value: 50
  - Defaults to 10 if not specified
- `filters.destination`:
  - Optional field
  - Maximum length: 100 characters
- `filters.budgetRange`:
  - Optional field
  - Must be one of: "low", "medium", "high", "luxury"
- `filters.travelStyle`:
  - Optional field
  - Must be one of: "budget", "luxury", "adventure", "cultural", "family", "business"
- `filters.duration.min`:
  - Optional field
  - Must be a positive integer
  - Maximum value: 365
- `filters.duration.max`:
  - Optional field
  - Must be a positive integer
  - Maximum value: 365
  - Must be greater than or equal to min if both are specified

#### Response Codes
- `200 OK`: Similar trips successfully found
- `400 Bad Request`: Invalid input data or validation errors
- `401 Unauthorized`: Missing or invalid authentication token
- `404 Not Found`: Reference trip not found (if tripId provided)
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate JWT token from Authorization header
2. Extract user ID from token payload
3. Validate input parameters according to validation rules
4. If tripId is provided, retrieve reference trip from database
5. If tripId is provided, verify user has access to the reference trip
6. If tripId is provided and trip not found, return 404 Not Found
7. Prepare search query based on provided parameters:
   - If tripId provided, use trip characteristics for semantic search
   - If query provided, use text query for semantic search
   - Apply filters if specified
8. Generate vector embedding for search query using Gemini Embeddings API
9. Execute vector search against trips collection in MongoDB
10. Apply additional filtering based on provided filters
11. Sort results by similarity score
12. Limit results to specified limit
13. Format and return search results with similarity scores

### 2. Search Destinations
- **Endpoint**: `GET /api/search/destinations`
- **Description**: Finds destinations similar to user preferences and trip requirements
- **Authentication**: Required (JWT)

#### Request Parameters
```json
{
  "query": "string", // Optional text query for semantic search
  "tripId": "string", // Optional ID of trip to consider for destination search
  "limit": "number", // Optional number of results to return (default: 10, max: 50)
  "filters": {
    "country": "string", // Optional country filter
    "region": "string", // Optional region filter
    "climate": "string", // Optional climate filter
    "popularity": "string" // Optional popularity filter
  }
}
```

#### Field Validations
- `query`:
  - Optional field
  - Maximum length: 500 characters
- `tripId`:
  - Optional field
  - Must be a valid MongoDB ObjectId if provided
- `limit`:
  - Optional field
  - Must be a positive integer
  - Minimum value: 1
  - Maximum value: 50
  - Defaults to 10 if not specified
- `filters.country`:
  - Optional field
  - Maximum length: 50 characters
- `filters.region`:
  - Optional field
  - Maximum length: 50 characters
- `filters.climate`:
  - Optional field
  - Must be one of: "tropical", "arid", "temperate", "continental", "polar"
- `filters.popularity`:
  - Optional field
  - Must be one of: "hidden-gem", "upcoming", "popular", "crowded"

#### Response Codes
- `200 OK`: Destinations successfully found
- `400 Bad Request`: Invalid input data or validation errors
- `401 Unauthorized`: Missing or invalid authentication token
- `404 Not Found`: Reference trip not found (if tripId provided)
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate JWT token from Authorization header
2. Extract user ID from token payload
3. Validate input parameters according to validation rules
4. If tripId is provided, retrieve reference trip from database
5. If tripId is provided, verify user has access to the reference trip
6. If tripId is provided and trip not found, return 404 Not Found
7. Prepare search query based on provided parameters:
   - Use user preferences and trip requirements for semantic search
   - Apply filters if specified
8. Generate vector embedding for search query using Gemini Embeddings API
9. Execute vector search against destinations collection in MongoDB
10. Apply additional filtering based on provided filters
11. Sort results by similarity score
12. Limit results to specified limit
13. Format and return search results with similarity scores and destination details

### 3. Search Activities
- **Endpoint**: `GET /api/search/activities`
- **Description**: Finds activities similar to user interests and trip preferences
- **Authentication**: Required (JWT)

#### Request Parameters
```json
{
  "query": "string", // Optional text query for semantic search
  "tripId": "string", // Optional ID of trip to consider for activity search
  "date": "ISO 8601 date", // Optional specific date for activity search
  "limit": "number", // Optional number of results to return (default: 10, max: 50)
  "filters": {
    "category": "string", // Optional activity category filter
    "priceRange": "string", // Optional price range filter
    "duration": "string", // Optional duration filter
    "suitableFor": "string" // Optional suitability filter
  }
}
```

#### Field Validations
- `query`:
  - Optional field
  - Maximum length: 500 characters
- `tripId`:
  - Optional field
  - Must be a valid MongoDB ObjectId if provided
- `date`:
  - Optional field
  - Must be a valid date
- `limit`:
  - Optional field
  - Must be a positive integer
  - Minimum value: 1
  - Maximum value: 50
  - Defaults to 10 if not specified
- `filters.category`:
  - Optional field
  - Must be one of: "cultural", "adventure", "relaxation", "food", "shopping", "nature", "nightlife"
- `filters.priceRange`:
  - Optional field
  - Must be one of: "free", "low", "medium", "high", "luxury"
- `filters.duration`:
  - Optional field
  - Must be one of: "short", "medium", "long", "full-day"
- `filters.suitableFor`:
  - Optional field
  - Must be one of: "solo", "couple", "family", "group", "elderly", "children"

#### Response Codes
- `200 OK`: Activities successfully found
- `400 Bad Request`: Invalid input data or validation errors
- `401 Unauthorized`: Missing or invalid authentication token
- `404 Not Found`: Reference trip not found (if tripId provided)
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate JWT token from Authorization header
2. Extract user ID from token payload
3. Validate input parameters according to validation rules
4. If tripId is provided, retrieve reference trip from database
5. If tripId is provided, verify user has access to the reference trip
6. If tripId is provided and trip not found, return 404 Not Found
7. If date is provided, verify it's within the trip date range (if tripId provided)
8. Prepare search query based on provided parameters:
   - Use user interests and trip preferences for semantic search
   - Apply filters if specified
9. Generate vector embedding for search query using Gemini Embeddings API
10. Execute vector search against activities collection in MongoDB
1. Apply additional filtering based on provided filters
12. Sort results by similarity score
13. Limit results to specified limit
14. Format and return search results with similarity scores and activity details

### 4. Generate Embeddings
- **Endpoint**: `POST /api/search/embeddings`
- **Description**: Generates vector embeddings for text content (internal use primarily)
- **Authentication**: Required (JWT) - Admin only

#### Request Body
```json
{
  "texts": ["string"], // Array of texts to generate embeddings for
  "context": "string" // Optional context for embedding generation
}
```

#### Field Validations
- `texts`:
  - Required field
  - Must be an array
  - Minimum of 1 item
  - Maximum of 100 items
  - Each item must be a string with maximum 1000 characters
- `context`:
  - Optional field
  - Maximum length: 200 characters

#### Response Codes
- `200 OK`: Embeddings successfully generated
- `400 Bad Request`: Invalid input data or validation errors
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: User does not have admin privileges
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Unexpected server error
- `503 Service Unavailable`: AI service temporarily unavailable

#### Business Logic
1. Validate JWT token from Authorization header
2. Extract user ID and role from token payload
3. Verify user has admin privileges
4. If user not admin, return 403 Forbidden
5. Validate input fields according to validation rules
6. Check rate limits for Gemini Embeddings API
7. If rate limit exceeded, return 429 Too Many Requests
8. For each text in the array:
   - Preprocess text by removing sensitive information
   - Generate vector embedding using Gemini Embeddings API
   - Store embedding in appropriate collection with metadata
9. Return generated embeddings with metadata

## Data Models

### Trip Embedding
```javascript
{
  _id: ObjectId,
  tripId: ObjectId,
  embedding: [Number], // Vector embedding of trip characteristics
  metadata: {
    destination: String,
    duration: Number, // In days
    budget: Number,
    interests: [String],
    constraints: [String],
    travelStyle: String,
    createdAt: Date,
    updatedAt: Date
  }
}
```

### Destination Embedding
```javascript
{
  _id: ObjectId,
  destinationId: ObjectId, // Reference to destination in destinations collection
  embedding: [Number], // Vector embedding of destination characteristics
  metadata: {
    name: String,
    country: String,
    region: String,
    climate: String,
    popularity: String,
    activities: [String],
    createdAt: Date,
    updatedAt: Date
  }
}
```

### Activity Embedding
```javascript
{
  _id: ObjectId,
  activityId: ObjectId, // Reference to activity in activities collection
  embedding: [Number], // Vector embedding of activity characteristics
  metadata: {
    title: String,
    description: String,
    category: String,
    priceRange: String,
    duration: String,
    suitableFor: [String],
    location: {
      name: String,
      coordinates: {
        lat: Number,
        lng: Number
      }
    },
    createdAt: Date,
    updatedAt: Date
  }
}
```

### Search Query Log
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  queryType: String, // "trips", "destinations", "activities"
  queryText: String, // Text query if provided
  parameters: Object, // Search parameters used
  resultsCount: Number, // Number of results returned
  timestamp: Date,
  responseTime: Number // In milliseconds
}
```

## Vector Search Implementation Details

### MongoDB Atlas Vector Search Configuration
- **Index Name**: `vector_search_index`
- **Fields Indexed**:
  - `embedding` (trip embeddings)
  - `metadata.interests` (for filtering)
  - `metadata.destination` (for filtering)
  - `metadata.budget` (for filtering)
  - `metadata.travelStyle` (for filtering)

### Search Algorithm
1. **Embedding Generation**:
   - Use Gemini Embeddings API to convert text to vector representations
   - Normalize embeddings to unit vectors
   - Store embeddings with associated metadata

2. **Similarity Calculation**:
   - Use cosine similarity to measure similarity between query and stored embeddings
   - Score range: 0 (completely different) to 1 (identical)

3. **Search Process**:
   - Generate embedding for search query
   - Execute vector search with specified parameters
   - Apply additional filters on search results
   - Sort by similarity score
   - Return top N results

### Performance Optimization
1. **Caching**:
   - Cache frequently requested embeddings
   - Cache common search results with short expiration
   - Use Redis for caching layer

2. **Indexing**:
   - Create appropriate indexes for filtering fields
   - Regular index optimization and maintenance
   - Monitor search performance and adjust indexes as needed

3. **Batch Processing**:
   - Batch embedding generation for better API utilization
   - Asynchronous processing of embedding generation tasks
   - Queue management for high-volume embedding requests

## Rate Limiting and Error Handling

### Rate Limits
- **Embedding Generation**: 10 requests per minute per user
- **Search Operations**: 30 requests per minute per user
- **Admin Operations**: 100 requests per minute

### Error Handling
- **API Errors**: Implement retry logic with exponential backoff
- **Rate Limiting**: Return 429 with retry-after header
- **Invalid Embeddings**: Log and skip invalid embedding generation requests
- **Search Failures**: Return partial results or appropriate error messages

## Security Considerations
1. All endpoints require authentication via JWT tokens
2. Admin-only endpoints require additional role verification
3. Input validation prevents injection attacks
4. Sensitive information is not included in embeddings or search queries
5. Search query logs do not store sensitive user information
6. HTTPS must be enforced in production environments
7. API keys for Gemini Embeddings API must be securely stored