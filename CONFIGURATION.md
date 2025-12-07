# Configuration Guide

## Environment Variables

The API function supports the following environment variables (for Vercel deployment):

### `STATION_ID`
- **Default**: `LJPC1`
- **Description**: NOAA NDBC station identifier
- **Example**: `STATION_ID=LJPC1`

### `ALLOWED_ORIGINS`
- **Default**: `*` (all origins) in development, restricted in production
- **Description**: Comma-separated list of allowed CORS origins
- **Example**: `ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com`

### `NODE_ENV`
- **Default**: `development`
- **Description**: Environment mode (`development` or `production`)
- **Note**: In production, detailed error messages are hidden from clients

## Vercel Configuration

To set environment variables in Vercel:

1. Go to your project settings
2. Navigate to "Environment Variables"
3. Add the variables listed above

## Local Development

For local development, create a `.env` file (not committed to git):

```env
STATION_ID=LJPC1
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
NODE_ENV=development
```

## API Endpoints

- **GET** `/api/surf/scripps` - Fetches current surf conditions from NOAA NDBC

## Features

### Caching
- In-memory cache with 5-minute TTL
- Reduces load on NOAA servers
- Improves response time

### Timeouts
- 10-second timeout on fetch requests
- Prevents hanging requests

### Retry Logic
- Frontend retries failed requests up to 3 times
- Exponential backoff: 1s, 2s, 4s

### Data Validation
- Validates wave height (0-50 ft)
- Validates period (3-30 seconds)
- Validates wind speed (0-100 knots)
- Validates temperatures (reasonable ranges)
- Logs warnings in development mode

### Security
- CORS restrictions (configurable)
- Error details hidden in production
- User-Agent header for requests

