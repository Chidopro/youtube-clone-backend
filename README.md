# VidTube Backend Server

This backend server handles Mailgun email sending for the VidTube subscription system.

## Setup Instructions

1. **Navigate to the backend directory:**
   ```bash
   cd backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the backend server:**
   ```bash
   npm start
   ```
   
   Or for development with auto-restart:
   ```bash
   npm run dev
   ```

4. **Verify the server is running:**
   - Open http://localhost:3001/health in your browser
   - You should see: `{"status":"OK","timestamp":"..."}`

## API Endpoints

### POST /api/send-subscription-email
Sends a subscription approval email via Mailgun.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Subscription email sent successfully!",
  "messageId": "mailgun-message-id"
}
```

### GET /health
Health check endpoint.

## Configuration

The Mailgun credentials are currently hardcoded in `server.js`:
- Domain: `mg.screenmerch.com`
- API Key: `key-9b51e73e6a4cb4b6f4d27d69f3e6ed25`
- From: `Team ScreenMerch <support@screenmerch.com>`

## Running Both Frontend and Backend

1. **Terminal 1 - Backend:**
   ```bash
   cd backend
   npm install
   npm start
   ```

2. **Terminal 2 - Frontend:**
   ```bash
   cd ..  # back to main directory
   npm run dev
   ```

3. **Access the application:**
   - Frontend: http://localhost:5173
   - Backend Health Check: http://localhost:3001/health

## Troubleshooting

- **CORS Error:** Make sure the backend is running on port 3001
- **Connection Error:** Check that both frontend and backend are running
- **Email Not Sending:** Verify Mailgun credentials and domain verification 