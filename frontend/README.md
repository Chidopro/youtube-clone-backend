# ScreenMerch Frontend

This is the frontend application for ScreenMerch, a platform that allows users to create custom merchandise from video content, including screenshots and thumbnails.

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
- API Key: `0ad53ac2845ce2e134e2ac07e4cc935e-0ce15100-34973130`
- From: `Team ScreenMerch <support@screenmerch.com>`

## Running the Application

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the development server:**
   ```bash
   npm run dev
   ```

3. **Build for production:**
   ```bash
   npm run build
   ```

4. **Access the application:**
   - Development: http://localhost:5173
   - Production: Deployed to Netlify

## Troubleshooting

- **CORS Error:** Make sure the backend is running on port 3001
- **Connection Error:** Check that both frontend and backend are running
- **Email Not Sending:** Verify Mailgun credentials and domain verification 