# Map Integration Specification

## Overview
The Map Integration service provides mapping capabilities for the TravelSense v2 platform, integrating with OpenStreetMap and Mapbox APIs. This service enables location search, route planning, geocoding, reverse geocoding, and map visualization features. It supports trip planning with location-based recommendations, activity mapping, and navigation assistance for travelers.

## API Endpoints

### 1. Geocode Address
- **Endpoint**: `GET /api/maps/geocode`
- **Description**: Converts an address into geographic coordinates (latitude and longitude)
- **Authentication**: Not required (public endpoint)

#### Request Parameters
```json
{
  "address": "string", // Required address to geocode
  "country": "string" // Optional country code to limit search
}
```

#### Field Validations
- `address`:
  - Required field
  - Minimum length: 1 character
  - Maximum length: 200 characters
- `country`:
  - Optional field
  - Must be a valid ISO 3166-1 alpha-2 country code if provided
  - Maximum length: 2 characters

#### Response Codes
- `200 OK`: Address successfully geocoded
- `400 Bad Request`: Invalid input data or validation errors
- `404 Not Found`: Address not found
- `500 Internal Server Error`: Unexpected server error
- `502 Bad Gateway`: Map service error

#### Business Logic
1. Validate input fields according to validation rules
2. Check cache for previously geocoded address
3. If found in cache, return cached result
4. If not in cache, call geocoding API (OpenStreetMap or Mapbox)
5. Process and validate geocoding response
6. Cache successful geocoding results
7. Format coordinates for response
8. Return geocoded address with coordinates

### 2. Reverse Geocode Coordinates
- **Endpoint**: `GET /api/maps/reverse-geocode`
- **Description**: Converts geographic coordinates into a human-readable address
- **Authentication**: Not required (public endpoint)

#### Request Parameters
```json
{
  "lat": "number", // Required latitude
  "lng": "number" // Required longitude
}
```

#### Field Validations
- `lat`:
  - Required field
  - Must be a number between -90 and 90
- `lng`:
 - Required field
  - Must be a number between -180 and 180

#### Response Codes
- `200 OK`: Coordinates successfully reverse geocoded
- `400 Bad Request`: Invalid input data or validation errors
- `404 Not Found`: Location not found
- `500 Internal Server Error`: Unexpected server error
- `502 Bad Gateway`: Map service error

#### Business Logic
1. Validate input fields according to validation rules
2. Check cache for previously reverse geocoded coordinates
3. If found in cache, return cached result
4. If not in cache, call reverse geocoding API (OpenStreetMap or Mapbox)
5. Process and validate reverse geocoding response
6. Cache successful reverse geocoding results
7. Format address for response
8. Return reverse geocoded address

### 3. Search Places
- **Endpoint**: `GET /api/maps/places`
- **Description**: Searches for places of interest near a location
- **Authentication**: Not required (public endpoint)

#### Request Parameters
```json
{
  "query": "string", // Required search query
  "lat": "number", // Required latitude
  "lng": "number", // Required longitude
  "radius": "number", // Optional search radius in meters
  "categories": ["string"], // Optional place categories
  "limit": "number" // Optional number of results (default: 20, max: 50)
}
```

#### Field Validations
- `query`:
  - Required field
  - Minimum length: 1 character
  - Maximum length: 100 characters
- `lat`:
  - Required field
  - Must be a number between -90 and 90
- `lng`:
  - Required field
  - Must be a number between -180 and 180
- `radius`:
  - Optional field
  - Must be a positive number
  - Minimum value: 10
  - Maximum value: 50000
  - Defaults to 1000 if not specified
- `categories`:
  - Optional field
  - Must be an array if provided
  - Each item must be one of: "accommodation", "restaurant", "attraction", "activity", "transport"
- `limit`:
  - Optional field
  - Must be a positive integer
  - Minimum value: 1
  - Maximum value: 50
  - Defaults to 20 if not specified

#### Response Codes
- `200 OK`: Places successfully retrieved
- `400 Bad Request`: Invalid input data or validation errors
- `500 Internal Server Error`: Unexpected server error
- `502 Bad Gateway`: Map service error

#### Business Logic
1. Validate input fields according to validation rules
2. Build place search query for map service API
3. Call place search API (OpenStreetMap or Mapbox)
4. Process and validate place search response
5. Apply category filters if specified
6. Limit results to specified limit
7. Format places for response
8. Return places list

### 4. Calculate Route
- **Endpoint**: `POST /api/maps/route`
- **Description**: Calculates the optimal route between multiple waypoints
- **Authentication**: Not required (public endpoint)

#### Request Body
```json
{
  "waypoints": [
    {
      "lat": "number", // Required latitude
      "lng": "number", // Required longitude
      "name": "string" // Optional waypoint name
    }
  ],
  "mode": "string", // Optional transport mode
  "optimize": "boolean" // Optional route optimization
}
```

#### Field Validations
- `waypoints`:
  - Required field
  - Must be an array
  - Minimum of 2 items
  - Maximum of 25 items
- `waypoints[].lat`:
  - Required field
  - Must be a number between -90 and 90
- `waypoints[].lng`:
  - Required field
  - Must be a number between -180 and 180
- `waypoints[].name`:
  - Optional field
  - Maximum length: 100 characters
- `mode`:
  - Optional field
  - Must be one of: "driving", "walking", "cycling", "transit"
  - Defaults to "driving" if not specified
- `optimize`:
  - Optional field
  - Boolean value
  - Defaults to false if not specified

#### Response Codes
- `200 OK`: Route successfully calculated
- `400 Bad Request`: Invalid input data or validation errors
- `500 Internal Server Error`: Unexpected server error
- `502 Bad Gateway`: Map service error

#### Business Logic
1. Validate input fields according to validation rules
2. Validate that at least 2 waypoints are provided
3. Check cache for previously calculated route with same waypoints
4. If found in cache, return cached result
5. If not in cache, call routing API (OpenStreetMap or Mapbox)
6. Process and validate routing response
7. Calculate additional metrics (distance, duration, etc.)
8. Cache successful routing results
9. Format route for response
10. Return calculated route

### 5. Get Map Image
- **Endpoint**: `GET /api/maps/image`
- **Description**: Generates a static map image with markers and routes
- **Authentication**: Not required (public endpoint)

#### Request Parameters
```json
{
  "centerLat": "number", // Required center latitude
  "centerLng": "number", // Required center longitude
  "zoom": "number", // Optional zoom level
  "width": "number", // Optional image width
  "height": "number", // Optional image height
  "markers": [
    {
      "lat": "number", // Required marker latitude
      "lng": "number", // Required marker longitude
      "label": "string" // Optional marker label
    }
  ],
  "routes": [
    {
      "coordinates": [
        {
          "lat": "number", // Required latitude
          "lng": "number" // Required longitude
        }
      ],
      "color": "string" // Optional route color
    }
  ]
}
```

#### Field Validations
- `centerLat`:
  - Required field
  - Must be a number between -90 and 90
- `centerLng`:
  - Required field
  - Must be a number between -180 and 180
- `zoom`:
  - Optional field
  - Must be a number between 1 and 20
  - Defaults to 13 if not specified
- `width`:
  - Optional field
  - Must be a positive integer
  - Minimum value: 100
  - Maximum value: 2000
  - Defaults to 600 if not specified
- `height`:
  - Optional field
  - Must be a positive integer
  - Minimum value: 100
  - Maximum value: 2000
  - Defaults to 400 if not specified
- `markers`:
  - Optional field
  - Must be an array if provided
  - Maximum of 50 items
- `markers[].lat`:
  - Required field
  - Must be a number between -90 and 90
- `markers[].lng`:
  - Required field
  - Must be a number between -180 and 180
- `markers[].label`:
  - Optional field
  - Maximum length: 10 characters
- `routes`:
  - Optional field
  - Must be an array if provided
  - Maximum of 5 items
- `routes[].coordinates`:
  - Required field
  - Must be an array
  - Minimum of 2 items
  - Maximum of 100 items
- `routes[].coordinates[].lat`:
  - Required field
  - Must be a number between -90 and 90
- `routes[].coordinates[].lng`:
  - Required field
  - Must be a number between -180 and 180
- `routes[].color`:
  - Optional field
  - Must be a valid hex color code if provided
  - Maximum length: 7 characters

#### Response Codes
- `200 OK`: Map image successfully generated
- `400 Bad Request`: Invalid input data or validation errors
- `500 Internal Server Error`: Unexpected server error
- `502 Bad Gateway`: Map service error

#### Business Logic
1. Validate input fields according to validation rules
2. Check cache for previously generated map image with same parameters
3. If found in cache, return cached image
4. If not in cache, call static map API (OpenStreetMap or Mapbox)
5. Process and validate map image response
6. Cache generated map image
7. Return map image as response with appropriate content type

### 6. Get Elevation Data
- **Endpoint**: `POST /api/maps/elevation`
- **Description**: Retrieves elevation data for a set of coordinates
- **Authentication**: Not required (public endpoint)

#### Request Body
```json
{
  "coordinates": [
    {
      "lat": "number", // Required latitude
      "lng": "number" // Required longitude
    }
  ]
}
```

#### Field Validations
- `coordinates`:
  - Required field
  - Must be an array
  - Minimum of 1 item
  - Maximum of 100 items
- `coordinates[].lat`:
 - Required field
  - Must be a number between -90 and 90
- `coordinates[].lng`:
  - Required field
  - Must be a number between -180 and 180

#### Response Codes
- `200 OK`: Elevation data successfully retrieved
- `400 Bad Request`: Invalid input data or validation errors
- `500 Internal Server Error`: Unexpected server error
- `502 Bad Gateway`: Map service error

#### Business Logic
1. Validate input fields according to validation rules
2. Call elevation API (OpenStreetMap or Mapbox)
3. Process and validate elevation response
4. Format elevation data for response
5. Return elevation data for all coordinates

### 7. Get Timezone Information
- **Endpoint**: `GET /api/maps/timezone`
- **Description**: Retrieves timezone information for a location
- **Authentication**: Not required (public endpoint)

#### Request Parameters
```json
{
  "lat": "number", // Required latitude
  "lng": "number" // Required longitude
}
```

#### Field Validations
- `lat`:
  - Required field
  - Must be a number between -90 and 90
- `lng`:
  - Required field
  - Must be a number between -180 and 180

#### Response Codes
- `200 OK`: Timezone information successfully retrieved
- `400 Bad Request`: Invalid input data or validation errors
- `500 Internal Server Error`: Unexpected server error
- `502 Bad Gateway`: Map service error

#### Business Logic
1. Validate input fields according to validation rules
2. Check cache for previously retrieved timezone information
3. If found in cache, return cached result
4. If not in cache, call timezone API (OpenStreetMap or Mapbox)
5. Process and validate timezone response
6. Cache successful timezone results
7. Format timezone information for response
8. Return timezone data

## Data Models

### Geocoded Address
```javascript
{
  _id: ObjectId,
  address: String, // Original address
  coordinates: {
    lat: Number, // Latitude
    lng: Number // Longitude
  },
  formattedAddress: String, // Formatted address
  components: {
    street: String,
    city: String,
    state: String,
    country: String,
    postalCode: String
  },
  source: String, // "openstreetmap" or "mapbox"
  createdAt: Date,
  updatedAt: Date
}
```

### Place
```javascript
{
  _id: ObjectId,
  name: String, // Place name
  coordinates: {
    lat: Number, // Latitude
    lng: Number // Longitude
  },
  address: String, // Place address
  category: String, // Place category
  rating: Number, // Place rating (0-5)
  contact: {
    phone: String,
    website: String
  },
  openingHours: [{
    day: String, // "monday", "tuesday", etc.
    open: String, // "09:00"
    close: String // "17:00"
  }],
  source: String, // "openstreetmap" or "mapbox"
  sourceId: String, // ID from source provider
  createdAt: Date,
  updatedAt: Date
}
```

### Route
```javascript
{
  _id: ObjectId,
  waypoints: [{
    lat: Number, // Latitude
    lng: Number, // Longitude
    name: String // Waypoint name
  }],
  mode: String, // Transport mode
  distance: Number, // Total distance in meters
  duration: Number, // Estimated duration in seconds
  coordinates: [{
    lat: Number, // Latitude
    lng: Number // Longitude
  }],
  legs: [{
    start: {
      lat: Number,
      lng: Number
    },
    end: {
      lat: Number,
      lng: Number
    },
    distance: Number, // Leg distance in meters
    duration: Number // Leg duration in seconds
  }],
  source: String, // "openstreetmap" or "mapbox"
  sourceId: String, // ID from source provider
  createdAt: Date,
  updatedAt: Date
}
```

### Map Image Cache
```javascript
{
  _id: ObjectId,
  parameters: Object, // Map generation parameters
  imageUrl: String, // URL to cached image
  expiresAt: Date, // Expiration timestamp
  createdAt: Date
}
```

## Map Service Integration

### OpenStreetMap Integration
1. **Nominatim API**: Geocoding and reverse geocoding services
2. **Overpass API**: Place search and data extraction
3. **OSRM**: Routing and navigation services
4. **Static Map API**: Static map image generation

### Mapbox Integration
1. **Geocoding API**: Forward and reverse geocoding
2. **Places API**: Point of interest search
3. **Directions API**: Route calculation and navigation
4. **Static Images API**: Static map image generation
5. **Elevation API**: Elevation data retrieval

### Service Selection
1. **Load Balancing**: Distribution of requests between services
2. **Fallback Mechanisms**: Automatic switching when services are unavailable
3. **Performance Monitoring**: Monitoring of service performance and reliability
4. **Cost Optimization**: Selection based on cost and performance

## Map Features

### Location Services
1. **Geocoding**: Address to coordinates conversion
2. **Reverse Geocoding**: Coordinates to address conversion
3. **Place Search**: Search for points of interest
4. **Autocomplete**: Address autocomplete functionality

### Routing and Navigation
1. **Multi-waypoint Routing**: Routes with multiple stops
2. **Route Optimization**: Optimal ordering of waypoints
3. **Alternative Routes**: Multiple route options
4. **Real-time Traffic**: Traffic-aware routing

### Map Visualization
1. **Static Maps**: Image-based map generation
2. **Interactive Maps**: Dynamic map rendering
3. **Markers and Overlays**: Custom map annotations
4. **Custom Styling**: Map appearance customization

### Spatial Analysis
1. **Distance Calculation**: Distance between points
2. **Area Calculation**: Area of polygon regions
3. **Elevation Profiles**: Elevation data along routes
4. **Timezone Information**: Timezone data for locations

## Performance Optimization

### Caching
1. **Geocoding Cache**: Caching of geocoding results
2. **Route Cache**: Caching of calculated routes
3. **Map Image Cache**: Caching of generated map images
4. **Place Cache**: Caching of place search results

### Rate Limiting
1. **Service Rate Limits**: Adherence to API rate limits
2. **Request Throttling**: Throttling of high-volume requests
3. **Batch Processing**: Batch processing of multiple requests
4. **Queue Management**: Request queue management

### Data Optimization
1. **Data Compression**: Compression of map data
2. **Image Optimization**: Optimization of map images
3. **Precision Control**: Control of coordinate precision
4. **Data Filtering**: Filtering of unnecessary data

## Security Considerations

### API Security
1. **API Key Management**: Secure storage and rotation of API keys
2. **Request Signing**: Signing of API requests
3. **Access Control**: Control of API access
4. **Usage Monitoring**: Monitoring of API usage

### Data Protection
1. **Input Validation**: Validation of all map inputs
2. **Output Sanitization**: Sanitization of map outputs
3. **Rate Limiting**: Prevention of API abuse
4. **Privacy Protection**: Protection of location data

### Service Security
1. **Secure Connections**: Use of HTTPS for all API calls
2. **Certificate Validation**: Validation of service certificates
3. **Error Handling**: Secure handling of service errors
4. **Audit Logging**: Logging of map service interactions

## Error Handling

### Map Service Errors
1. **API Errors**: Handling of API error responses
2. **Network Errors**: Handling of network connectivity issues
3. **Timeout Errors**: Handling of request timeouts
4. **Rate Limit Errors**: Handling of rate limit exceeded errors

### Fallback Mechanisms
1. **Service Failover**: Automatic switching between map services
2. **Cached Data**: Use of cached data when services are unavailable
3. **Degraded Functionality**: Graceful degradation of features
4. **User Notifications**: Informing users of service issues

### Data Validation
1. **Coordinate Validation**: Validation of geographic coordinates
2. **Address Validation**: Validation of address formats
3. **Route Validation**: Validation of route data
4. **Image Validation**: Validation of map images

## Monitoring and Analytics

### Service Metrics
1. **API Usage**: Tracking of API usage by service
2. **Response Times**: Monitoring of service response times
3. **Error Rates**: Tracking of service error rates
4. **Availability**: Monitoring of service availability

### Performance Metrics
1. **Cache Hit Rates**: Tracking of cache effectiveness
2. **Request Volume**: Monitoring of request volume
3. **Data Transfer**: Tracking of data transfer volumes
4. **Processing Time**: Monitoring of processing times

### Business Metrics
1. **Location Searches**: Tracking of location search volume
2. **Route Calculations**: Tracking of route calculation volume
3. **Map Views**: Tracking of map image generation
4. **Place Searches**: Tracking of place search volume

### Audit Logging
1. **API Calls**: Logging of all map service API calls
2. **User Actions**: Logging of user map-related actions
3. **System Events**: Logging of map service system events
4. **Security Events**: Logging of potential security incidents