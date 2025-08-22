# Search Engine Capabilities Specification

## Overview
The Search Engine Capabilities service provides advanced search functionality for the TravelSense v2 platform, integrating MongoDB Atlas Vector Search and Elasticsearch for comprehensive search capabilities. This service enables semantic search, faceted search, autocomplete, and personalized recommendations based on user preferences and behavior. It powers the platform's discovery features for trips, destinations, activities, and providers.

## API Endpoints

### 1. Semantic Search
- **Endpoint**: `POST /api/search/semantic`
- **Description**: Performs semantic search using vector embeddings to find contextually relevant results
- **Authentication**: Not required (public endpoint)

#### Request Body
```json
{
  "query": "string", // Required search query
  "type": "string", // Optional search type
  "filters": {
    "categories": ["string"], // Optional category filters
    "location": "string", // Optional location filter
    "priceRange": {
      "min": "number", // Optional minimum price
      "max": "number" // Optional maximum price
    },
    "rating": "number" // Optional minimum rating
 },
  "limit": "number", // Optional number of results (default: 10, max: 50)
  "offset": "number" // Optional offset for pagination (default: 0)
}
```

#### Field Validations
- `query`:
  - Required field
  - Minimum length: 1 character
  - Maximum length: 500 characters
- `type`:
  - Optional field
  - Must be one of: "trip", "destination", "activity", "provider"
- `filters.categories`:
  - Optional field
  - Must be an array if provided
  - Each item maximum 50 characters
- `filters.location`:
  - Optional field
  - Maximum length: 100 characters
- `filters.priceRange.min`:
  - Optional field
  - Must be a non-negative number
- `filters.priceRange.max`:
  - Optional field
  - Must be a positive number
  - Must be greater than min if both are specified
- `filters.rating`:
  - Optional field
  - Must be a number between 0 and 5
- `limit`:
  - Optional field
  - Must be a positive integer
  - Minimum value: 1
  - Maximum value: 50
  - Defaults to 10 if not specified
- `offset`:
  - Optional field
  - Must be a non-negative integer
  - Defaults to 0 if not specified

#### Response Codes
- `200 OK`: Search results successfully retrieved
- `400 Bad Request`: Invalid input data or validation errors
- `500 Internal Server Error`: Unexpected server error
- `503 Service Unavailable`: Search service temporarily unavailable

#### Business Logic
1. Validate input fields according to validation rules
2. Generate vector embedding for search query using AI service
3. Perform vector search against MongoDB Atlas Vector Search
4. Apply additional filters if specified
5. Score and rank results based on similarity and relevance
6. Apply pagination parameters
7. Format results for response
8. Log search query for analytics
9. Return search results

### 2. Faceted Search
- **Endpoint**: `POST /api/search/faceted`
- **Description**: Performs faceted search with filter options and aggregations
- **Authentication**: Not required (public endpoint)

#### Request Body
```json
{
  "query": "string", // Optional search query
  "type": "string", // Required search type
  "filters": "object", // Optional filters
  "facets": ["string"], // Optional facets to retrieve
  "limit": "number", // Optional number of results (default: 10, max: 50)
  "offset": "number" // Optional offset for pagination (default: 0)
}
```

#### Field Validations
- `query`:
  - Optional field
  - Maximum length: 500 characters
- `type`:
  - Required field
  - Must be one of: "trip", "destination", "activity", "provider"
- `filters`:
  - Optional field
  - Must be a valid JSON object if provided
- `facets`:
  - Optional field
  - Must be an array if provided
  - Each item must be one of: "category", "location", "priceRange", "rating", "duration"
- `limit`:
  - Optional field
  - Must be a positive integer
  - Minimum value: 1
  - Maximum value: 50
  - Defaults to 10 if not specified
- `offset`:
  - Optional field
  - Must be a non-negative integer
  - Defaults to 0 if not specified

#### Response Codes
- `200 OK`: Search results successfully retrieved
- `400 Bad Request`: Invalid input data or validation errors
- `500 Internal Server Error`: Unexpected server error
- `503 Service Unavailable`: Search service temporarily unavailable

#### Business Logic
1. Validate input fields according to validation rules
2. Build Elasticsearch query with faceted search parameters
3. Execute faceted search against Elasticsearch cluster
4. Apply filters if specified
5. Retrieve facet aggregations
6. Apply pagination parameters
7. Format results for response including facets
8. Return search results with facet information

### 3. Autocomplete Search
- **Endpoint**: `GET /api/search/autocomplete`
- **Description**: Provides autocomplete suggestions for search queries
- **Authentication**: Not required (public endpoint)

#### Request Parameters
```json
{
  "query": "string", // Required partial query
  "type": "string", // Optional search type
  "limit": "number" // Optional number of suggestions (default: 5, max: 20)
}
```

#### Field Validations
- `query`:
  - Required field
  - Minimum length: 1 character
  - Maximum length: 100 characters
- `type`:
  - Optional field
  - Must be one of: "trip", "destination", "activity", "provider"
- `limit`:
  - Optional field
  - Must be a positive integer
  - Minimum value: 1
  - Maximum value: 20
  - Defaults to 5 if not specified

#### Response Codes
- `200 OK`: Autocomplete suggestions successfully retrieved
- `400 Bad Request`: Invalid input data or validation errors
- `500 Internal Server Error`: Unexpected server error
- `503 Service Unavailable`: Search service temporarily unavailable

#### Business Logic
1. Validate input fields according to validation rules
2. Build autocomplete query for Elasticsearch
3. Execute autocomplete search against Elasticsearch cluster
4. Limit results to specified limit
5. Format suggestions for response
6. Return autocomplete suggestions

### 4. Personalized Recommendations
- **Endpoint**: `GET /api/search/recommendations`
- **Description**: Provides personalized recommendations based on user preferences and behavior
- **Authentication**: Required (JWT)

#### Request Parameters
```json
{
  "type": "string", // Optional recommendation type
  "limit": "number" // Optional number of recommendations (default: 10, max: 30)
}
```

#### Field Validations
- `type`:
  - Optional field
  - Must be one of: "trip", "destination", "activity", "provider"
- `limit`:
  - Optional field
  - Must be a positive integer
  - Minimum value: 1
  - Maximum value: 30
  - Defaults to 10 if not specified

#### Response Codes
- `200 OK`: Recommendations successfully retrieved
- `400 Bad Request`: Invalid input data or validation errors
- `401 Unauthorized`: Missing or invalid authentication token
- `500 Internal Server Error`: Unexpected server error
- `503 Service Unavailable`: Search service temporarily unavailable

#### Business Logic
1. Validate JWT token from Authorization header
2. Extract user ID from token payload
3. Validate input fields according to validation rules
4. Retrieve user preferences and behavior history
5. Generate personalized query based on user profile
6. Perform hybrid search combining semantic and faceted search
7. Apply personalization scoring based on user preferences
8. Limit results to specified limit
9. Format recommendations for response
10. Return personalized recommendations

### 5. Similar Items Search
- **Endpoint**: `GET /api/search/similar/:id`
- **Description**: Finds items similar to a reference item using vector similarity
- **Authentication**: Not required (public endpoint)

#### Request Parameters
- `id`: Reference item ID (URL parameter)
- `type`: Reference item type (query parameter)
- `limit`: Number of similar items (query parameter)

#### Field Validations
- `id`:
  - Required field
  - Must be a valid MongoDB ObjectId
- `type`:
  - Required field
  - Must be one of: "trip", "destination", "activity", "provider"
- `limit`:
  - Optional field
  - Must be a positive integer
  - Minimum value: 1
  - Maximum value: 30
  - Defaults to 10 if not specified

#### Response Codes
- `200 OK`: Similar items successfully retrieved
- `400 Bad Request`: Invalid input data or validation errors
- `404 Not Found`: Reference item not found
- `500 Internal Server Error`: Unexpected server error
- `503 Service Unavailable`: Search service temporarily unavailable

#### Business Logic
1. Validate input fields according to validation rules
2. Retrieve reference item from database by ID and type
3. If reference item not found, return 404 Not Found
4. Generate vector embedding for reference item
5. Perform vector similarity search against MongoDB Atlas Vector Search
6. Exclude reference item from results
7. Limit results to specified limit
8. Format similar items for response
9. Return similar items

### 6. Search Analytics
- **Endpoint**: `GET /api/search/analytics`
- **Description**: Retrieves search analytics and popular queries (admin only)
- **Authentication**: Required (Admin JWT)

#### Request Parameters
```json
{
  "startDate": "ISO 8601 date", // Required start date
  "endDate": "ISO 8601 date", // Required end date
  "metrics": ["string"] // Optional specific metrics to retrieve
}
```

#### Field Validations
- `startDate`:
  - Required field
  - Must be a valid ISO 8601 date
  - Must not be in the future
- `endDate`:
  - Required field
  - Must be a valid ISO 8601 date
  - Must not be in the future
  - Must be after startDate
- `metrics`:
  - Optional field
  - Must be an array if provided
  - Each item must be one of: "search_volume", "popular_queries", "conversion_rate", "zero_results"

#### Response Codes
- `200 OK`: Search analytics successfully retrieved
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
6. Query analytics database for search metrics
7. Filter results by specified metrics if provided
8. Format data for response
9. Return search analytics

## Data Models

### Search Query Log
```javascript
{
  _id: ObjectId,
  userId: ObjectId, // Optional user ID
  query: String, // Search query
  type: String, // Search type
  filters: Object, // Applied filters
  resultsCount: Number, // Number of results returned
  responseTime: Number, // Response time in milliseconds
  timestamp: Date, // Query timestamp
  ipAddress: String, // Client IP address
  userAgent: String // Client user agent
}
```

### Search Index Metadata
```javascript
{
  _id: ObjectId,
  type: String, // Index type (trip, destination, activity, provider)
  name: String, // Index name
  fields: [String], // Indexed fields
  lastUpdated: Date, // Last index update timestamp
  documentCount: Number, // Number of indexed documents
  status: String // Index status (active, rebuilding, error)
}
```

### Recommendation Profile
```javascript
{
  _id: ObjectId,
  userId: ObjectId, // User ID
  preferences: {
    categories: [String], // Preferred categories
    locations: [String], // Preferred locations
    priceRanges: [String], // Preferred price ranges
    activities: [String] // Preferred activities
  },
  behavior: {
    viewedItems: [ObjectId], // Recently viewed items
    bookedItems: [ObjectId], // Booked items
    savedItems: [ObjectId], // Saved items
    searchHistory: [String] // Recent search queries
  },
  embeddings: [Number], // User preference embeddings
  lastUpdated: Date // Profile last updated timestamp
}
```

## Search Engine Integration

### MongoDB Atlas Vector Search
1. **Vector Indexes**: Vector indexes for semantic search capabilities
2. **Hybrid Search**: Combination of vector and traditional search
3. **Real-time Indexing**: Immediate indexing of new content
4. **Similarity Metrics**: Cosine similarity for vector comparisons

### Elasticsearch Integration
1. **Text Search**: Full-text search capabilities
2. **Faceted Search**: Aggregation-based faceted search
3. **Autocomplete**: Suggest-as-you-type functionality
4. **Analytics**: Search analytics and reporting

### Index Management
1. **Index Creation**: Automated index creation and updates
2. **Index Optimization**: Performance optimization of search indexes
3. **Index Monitoring**: Monitoring of index health and performance
4. **Index Rebuilding**: Scheduled rebuilding of indexes

## Search Features

### Semantic Search
1. **Natural Language Queries**: Understanding of natural language search queries
2. **Contextual Relevance**: Context-aware search results
3. **Personalization**: Personalized search results based on user profile
4. **Multilingual Support**: Support for multiple languages

### Faceted Search
1. **Dynamic Facets**: Real-time facet generation based on results
2. **Filtering**: Advanced filtering capabilities
3. **Aggregations**: Statistical aggregations and insights
4. **Range Filters**: Numerical range filtering

### Autocomplete
1. **Query Suggestions**: Intelligent query suggestions
2. **Popular Queries**: Suggestions based on popular searches
3. **Personalized Suggestions**: User-specific autocomplete
4. **Real-time Updates**: Instant updates to suggestions

### Recommendations
1. **Collaborative Filtering**: Recommendations based on similar users
2. **Content-Based Filtering**: Recommendations based on item similarity
3. **Hybrid Recommendations**: Combination of filtering approaches
4. **Real-time Updates**: Immediate updates based on user behavior

## Performance Optimization

### Caching
1. **Query Caching**: Caching of frequent search queries
2. **Result Caching**: Caching of search results
3. **Autocomplete Caching**: Caching of autocomplete suggestions
4. **Cache Invalidation**: Intelligent cache invalidation strategies

### Indexing
1. **Selective Indexing**: Indexing of only relevant fields
2. **Incremental Indexing**: Incremental updates to indexes
3. **Batch Indexing**: Efficient batch processing of large datasets
4. **Index Sharding**: Distribution of indexes across multiple nodes

### Query Optimization
1. **Query Analysis**: Analysis of query performance
2. **Query Rewriting**: Optimization of complex queries
3. **Result Pagination**: Efficient pagination of large result sets
4. **Early Termination**: Early termination of low-relevance searches

## Security Considerations

### Data Protection
1. **Input Validation**: Strict validation of all search inputs
2. **Query Sanitization**: Sanitization of search queries to prevent injection
3. **Rate Limiting**: Rate limiting of search requests
4. **Access Control**: Access control for admin search analytics

### Privacy
1. **User Privacy**: Protection of user search history
2. **Anonymous Search**: Support for anonymous search queries
3. **Data Retention**: Policies for search data retention
4. **Compliance**: Compliance with privacy regulations

### Monitoring
1. **Query Logging**: Logging of search queries for security analysis
2. **Anomaly Detection**: Detection of unusual search patterns
3. **Performance Monitoring**: Monitoring of search performance
4. **Error Tracking**: Tracking of search errors and failures

## Error Handling

### Search Errors
1. **Index Errors**: Handling of index-related errors
2. **Query Errors**: Handling of malformed search queries
3. **Service Errors**: Handling of search service failures
4. **Timeout Errors**: Handling of search query timeouts

### Fallback Mechanisms
1. **Service Degradation**: Graceful degradation when search services are unavailable
2. **Alternative Search**: Fallback to alternative search methods
3. **Cached Results**: Use of cached results when services are down
4. **Error Messages**: User-friendly error messages

## Monitoring and Analytics

### Search Metrics
1. **Query Volume**: Tracking of search query volume
2. **Response Times**: Monitoring of search response times
3. **Result Quality**: Measurement of search result relevance
4. **User Satisfaction**: Tracking of user satisfaction with search

### Performance Metrics
1. **Index Performance**: Monitoring of index performance
2. **Query Performance**: Analysis of query performance
3. **Cache Hit Rates**: Tracking of cache effectiveness
4. **Resource Usage**: Monitoring of search service resource usage

### Business Metrics
1. **Conversion Rates**: Tracking of search-to-booking conversion rates
2. **Popular Queries**: Analysis of most popular search queries
3. **Zero Results**: Tracking of searches with no results
4. **User Engagement**: Measurement of user engagement with search

### Audit Logging
1. **Query Logs**: Logging of all search queries
2. **Admin Actions**: Logging of admin actions related to search
3. **System Events**: Logging of search system events
4. **Security Events**: Logging of potential security incidents