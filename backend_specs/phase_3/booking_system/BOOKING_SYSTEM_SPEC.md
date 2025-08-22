# Booking System Specification

## Overview
The Booking System manages all aspects of service reservations on the TravelSense v2 platform. This service handles the complete booking workflow from creation to confirmation, manages booking status changes, processes cancellations, and integrates with payment systems. It provides a seamless experience for users to reserve services from providers and track their reservations.

## API Endpoints

### 1. Create Booking
- **Endpoint**: `POST /api/bookings`
- **Description**: Creates a new booking for a service
- **Authentication**: Required (JWT)

#### Request Body
```json
{
  "serviceId": "string",
  "tripId": "string", // Optional: link to trip
  "date": "ISO 8601 date",
  "time": "string", // Optional time in HH:MM format
  "travelers": {
    "adults": "number",
    "children": "number",
    "infants": "number"
  },
  "notes": "string" // Optional special requests
}
```

#### Field Validations
- `serviceId`:
  - Required field
  - Must be a valid MongoDB ObjectId
- `tripId`:
  - Optional field
  - Must be a valid MongoDB ObjectId if provided
- `date`:
  - Required field
  - Must be a valid date
  - Must be in the future (not in the past)
- `time`:
  - Optional field
  - Must be in HH:MM format if provided
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
- `notes`:
  - Optional field
  - Maximum length: 500 characters

#### Response Codes
- `201 Created`: Booking successfully created
- `400 Bad Request`: Invalid input data or validation errors
- `401 Unauthorized`: Missing or invalid authentication token
- `404 Not Found`: Service or trip not found
- `409 Conflict`: Service not available for requested date/time
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate JWT token from Authorization header
2. Extract user ID from token payload
3. Validate input fields according to validation rules
4. Retrieve service record from database by serviceId
5. If service not found, return 404 Not Found
6. If tripId is provided, retrieve trip record and verify user access
7. If tripId is provided and trip not found, return 404 Not Found
8. Check service availability for requested date/time
9. If service is not available, return 409 Conflict
10. Calculate total price based on service pricing and traveler counts
11. Generate a unique booking ID
12. Set booking status to "pending"
13. Set payment status to "pending"
14. Set createdAt and updatedAt timestamps
15. Create booking record in database
16. Send booking confirmation email to user
17. Return created booking data

### 2. Get User Bookings
- **Endpoint**: `GET /api/bookings`
- **Description**: Retrieves a list of bookings for the authenticated user with optional filtering and pagination
- **Authentication**: Required (JWT)

#### Request Parameters
```json
{
  "status": "string", // Optional filter by booking status
  "dateFrom": "ISO 8601 date", // Optional start date filter
  "dateTo": "ISO 8601 date", // Optional end date filter
  "limit": "number", // Optional number of results (default: 20, max: 50)
  "offset": "number", // Optional offset for pagination (default: 0)
  "sortBy": "string", // Optional sort field (date, createdAt, status)
 "sortOrder": "string" // Optional sort order (asc, desc)
}
```

#### Field Validations
- `status`:
  - Optional field
  - Must be one of: "pending", "confirmed", "cancelled", "completed"
- `dateFrom`:
  - Optional field
  - Must be a valid date if provided
- `dateTo`:
  - Optional field
  - Must be a valid date if provided
  - Must be after dateFrom if both are specified
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
- `sortBy`:
  - Optional field
  - Must be one of: "date", "createdAt", "status"
- `sortOrder`:
  - Optional field
  - Must be one of: "asc", "desc"

#### Response Codes
- `200 OK`: Bookings successfully retrieved
- `400 Bad Request`: Invalid query parameters
- `401 Unauthorized`: Missing or invalid authentication token
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate JWT token from Authorization header
2. Extract user ID from token payload
3. Validate query parameters according to validation rules
4. Build database query based on user ID and provided filters
5. Apply pagination parameters
6. Execute query to retrieve bookings
7. Format results for response
8. Return bookings list with pagination metadata

### 3. Get Booking Details
- **Endpoint**: `GET /api/bookings/:id`
- **Description**: Retrieves detailed information for a specific booking
- **Authentication**: Required (JWT)

#### Request Parameters
- `id`: Booking ID (URL parameter)

#### Response Codes
- `200 OK`: Booking details successfully retrieved
- `400 Bad Request`: Invalid booking ID format
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: User does not have access to this booking
- `404 Not Found`: Booking not found
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate JWT token from Authorization header
2. Extract user ID from token payload
3. Validate booking ID format
4. Retrieve booking record from database by ID
5. If booking not found, return 404 Not Found
6. Verify user has access to this booking
7. If user lacks access, return 403 Forbidden
8. Retrieve associated service and provider details
9. Format booking details for response
10. Return booking details including service and provider information

### 4. Update Booking
- **Endpoint**: `PUT /api/bookings/:id`
- **Description**: Updates booking information (limited fields)
- **Authentication**: Required (JWT)

#### Request Body
```json
{
  "travelers": {
    "adults": "number",
    "children": "number",
    "infants": "number"
  },
  "notes": "string"
}
```

#### Field Validations
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
- `notes`:
  - Optional field
  - Maximum length: 500 characters

#### Response Codes
- `200 OK`: Booking successfully updated
- `400 Bad Request`: Invalid input data or validation errors
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: User does not have access to this booking
- `404 Not Found`: Booking not found
- `409 Conflict`: Booking cannot be modified (status restrictions)
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate JWT token from Authorization header
2. Extract user ID from token payload
3. Validate booking ID format
4. Retrieve booking record from database by ID
5. If booking not found, return 404 Not Found
6. Verify user has access to this booking
7. If user lacks access, return 403 Forbidden
8. Check if booking can be modified based on status
9. If booking cannot be modified, return 409 Conflict
10. Validate input fields according to validation rules
11. Update booking fields with provided values
12. Recalculate total price if traveler counts changed
13. Update updatedAt timestamp
14. Save updated booking record to database
15. Return updated booking data

### 5. Cancel Booking
- **Endpoint**: `DELETE /api/bookings/:id`
- **Description**: Cancels a booking (subject to provider cancellation policy)
- **Authentication**: Required (JWT)

#### Request Parameters
- `id`: Booking ID (URL parameter)

#### Request Body
```json
{
  "reason": "string" // Optional cancellation reason
}
```

#### Field Validations
- `reason`:
  - Optional field
  - Maximum length: 200 characters

#### Response Codes
- `200 OK`: Booking successfully cancelled
- `400 Bad Request`: Invalid booking ID format or input data
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: User does not have access to this booking
- `404 Not Found`: Booking not found
- `409 Conflict`: Booking cannot be cancelled (status or policy restrictions)
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate JWT token from Authorization header
2. Extract user ID from token payload
3. Validate booking ID format
4. Retrieve booking record from database by ID
5. If booking not found, return 404 Not Found
6. Verify user has access to this booking
7. If user lacks access, return 403 Forbidden
8. Check if booking can be cancelled based on status and provider policy
9. If booking cannot be cancelled, return 409 Conflict
10. Validate reason field if provided
11. Set booking status to "cancelled"
12. Set cancellation timestamp
13. Process refund according to provider policy and payment status
14. Update updatedAt timestamp
15. Save updated booking record to database
16. Send cancellation confirmation email to user
17. Notify provider of cancellation
18. Return updated booking data

### 6. Confirm Booking
- **Endpoint**: `POST /api/bookings/:id/confirm`
- **Description**: Confirms a booking (provider or admin action)
- **Authentication**: Required (JWT) - Provider or admin only

#### Request Parameters
- `id`: Booking ID (URL parameter)

#### Request Body
```json
{
  "confirmationCode": "string" // Optional provider confirmation code
}
```

#### Field Validations
- `confirmationCode`:
  - Optional field
  - Maximum length: 50 characters

#### Response Codes
- `200 OK`: Booking successfully confirmed
- `400 Bad Request`: Invalid booking ID format or input data
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: User does not have permission to confirm this booking
- `404 Not Found`: Booking not found
- `409 Conflict`: Booking cannot be confirmed (status restrictions)
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate JWT token from Authorization header
2. Extract user ID and role from token payload
3. Validate booking ID format
4. Retrieve booking record from database by ID
5. If booking not found, return 404 Not Found
6. Verify user has permission to confirm this booking (provider or admin)
7. If user lacks permission, return 403 Forbidden
8. Check if booking can be confirmed based on status
9. If booking cannot be confirmed, return 409 Conflict
10. Validate confirmationCode if provided
11. Set booking status to "confirmed"
12. Set confirmation timestamp
13. Generate and store confirmation code if not provided
14. Update updatedAt timestamp
15. Save updated booking record to database
16. Send confirmation email to user with details and confirmation code
17. Return updated booking data

### 7. Complete Booking
- **Endpoint**: `POST /api/bookings/:id/complete`
- **Description**: Marks a booking as completed (after service delivery)
- **Authentication**: Required (JWT) - Provider or admin only

#### Request Parameters
- `id`: Booking ID (URL parameter)

#### Response Codes
- `200 OK`: Booking successfully completed
- `400 Bad Request`: Invalid booking ID format
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: User does not have permission to complete this booking
- `404 Not Found`: Booking not found
- `409 Conflict`: Booking cannot be completed (status restrictions)
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate JWT token from Authorization header
2. Extract user ID and role from token payload
3. Validate booking ID format
4. Retrieve booking record from database by ID
5. If booking not found, return 404 Not Found
6. Verify user has permission to complete this booking (provider or admin)
7. If user lacks permission, return 403 Forbidden
8. Check if booking can be completed based on status
9. If booking cannot be completed, return 409 Conflict
10. Set booking status to "completed"
11. Set completion timestamp
12. Update updatedAt timestamp
13. Save updated booking record to database
14. Trigger review request notification to user
15. Return updated booking data

### 8. Get Booking Availability
- **Endpoint**: `GET /api/bookings/availability/:serviceId`
- **Description**: Checks availability for a service on specific dates
- **Authentication**: Not required (public endpoint)

#### Request Parameters
- `serviceId`: Service ID (URL parameter)
- `dateFrom`: Start date for availability check
- `dateTo`: End date for availability check (optional)
- `travelers`: Number of travelers (optional)

#### Response Codes
- `200 OK`: Availability information successfully retrieved
- `400 Bad Request`: Invalid service ID format or query parameters
- `404 Not Found`: Service not found
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate service ID format
2. Retrieve service record from database by serviceId
3. If service not found, return 404 Not Found
4. Validate dateFrom and dateTo parameters
5. Check service availability for requested date range
6. Consider existing bookings and service capacity
7. Format availability information for response
8. Return availability data including available dates/times

## Data Models

### Booking
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  providerId: ObjectId,
  serviceId: ObjectId,
  tripId: ObjectId, // Optional link to trip
  details: {
    serviceName: String,
    providerName: String,
    date: Date,
    time: String, // Optional time in HH:MM format
    travelers: {
      adults: Number,
      children: Number,
      infants: Number
    },
    totalPrice: Number,
    currency: String,
    notes: String // Special requests
  },
  status: String, // "pending", "confirmed", "cancelled", "completed"
  payment: {
    status: String, // "pending", "paid", "refunded", "failed"
    method: String, // "credit_card", "paypal", "bank_transfer"
    transactionId: String,
    paidAt: Date
  },
  confirmation: {
    code: String,
    sentAt: Date,
    confirmedAt: Date
  },
  cancellation: {
    reason: String,
    cancelledAt: Date,
    refundAmount: Number,
    refundTransactionId: String
  },
  completion: {
    completedAt: Date
  },
  createdAt: Date,
  updatedAt: Date
}
```

### Booking Availability Cache
```javascript
{
  _id: ObjectId,
  serviceId: ObjectId,
  date: Date,
  availability: {
    totalCapacity: Number,
    bookedCount: Number,
    availableCount: Number,
    timeSlots: [{
      time: String, // HH:MM format
      capacity: Number,
      booked: Number,
      available: Number
    }]
  },
  lastUpdated: Date
}
```

## Booking Workflow

### Status Transitions
1. **pending** → **confirmed**: Booking confirmed by provider
2. **pending** → **cancelled**: Booking cancelled by user
3. **confirmed** → **completed**: Booking marked as completed after service delivery
4. **confirmed** → **cancelled**: Booking cancelled (with possible refund)
5. **completed** → **cancelled**: Exceptional cancellation (with possible refund)

### Payment Integration Points
1. Booking creation triggers payment processing
2. Booking cancellation triggers refund processing
3. Booking status changes update payment status
4. Payment webhook updates booking payment status

## Security Considerations
1. All endpoints require authentication via JWT tokens (except availability check)
2. Users can only access their own bookings
3. Providers can only confirm/complete bookings for their services
4. Admins have full access to all bookings
5. Input validation must be performed on all fields
6. Sensitive payment information is not stored in booking records
7. Rate limiting must be implemented to prevent abuse
8. HTTPS must be enforced in production environments