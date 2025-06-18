const express = require('express');
const cors = require('cors');
const FormData = require('form-data');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mailgun configuration
const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN;
const FROM_EMAIL = process.env.FROM_EMAIL;
const FROM_NAME = process.env.FROM_NAME;

// Debugging: Log Mailgun environment variables (mask API key)
console.log('MAILGUN_API_KEY:', process.env.MAILGUN_API_KEY ? process.env.MAILGUN_API_KEY.slice(0, 4) + '...' : 'undefined');
console.log('MAILGUN_DOMAIN:', process.env.MAILGUN_DOMAIN);
console.log('FROM_EMAIL:', process.env.FROM_EMAIL);
console.log('FROM_NAME:', process.env.FROM_NAME);

// Send subscription email endpoint
app.post('/api/send-subscription-email', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    try {
        // Generate approval link
        const approvalLink = `http://localhost:5173/approve-subscription?email=${encodeURIComponent(email)}&token=${Date.now()}`;
        
        // Prepare email data using form-data package
        const formData = new FormData();
        formData.append('from', `${FROM_NAME} <${FROM_EMAIL}>`);
        formData.append('to', email);
        formData.append('subject', 'VidTube Subscription Approval Required');
        formData.append('html', `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #ff0000; color: white; padding: 20px; text-align: center;">
                    <h1 style="margin: 0;">VidTube</h1>
                </div>
                <div style="padding: 30px; background: #f9f9f9;">
                    <h2 style="color: #333;">Welcome to VidTube!</h2>
                    <p style="color: #666; line-height: 1.6;">
                        You've requested to subscribe to our platform. Please click the button below to approve your subscription:
                    </p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${approvalLink}" 
                           style="background: #ff0000; color: white; padding: 12px 30px; 
                                  text-decoration: none; border-radius: 5px; display: inline-block;">
                            Approve Subscription
                        </a>
                    </div>
                    <p style="color: #666; font-size: 14px;">
                        If you didn't request this, please ignore this email.
                    </p>
                    <p style="color: #666; font-size: 14px;">
                        Thanks,<br>
                        Team ScreenMerch
                    </p>
                </div>
            </div>
        `);

        // Send email using Mailgun API
        const response = await fetch(`https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${Buffer.from(`api:${MAILGUN_API_KEY}`).toString('base64')}`,
                ...formData.getHeaders()
            },
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Mailgun API error:', response.status, errorText);
            throw new Error(`Mailgun API error: ${response.status}`);
        }

        const result = await response.json();
        console.log('Email sent successfully:', result);

        res.status(200).json({ 
            success: true, 
            message: 'Subscription email sent successfully!',
            messageId: result.id 
        });

    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({ 
            error: 'Failed to send email', 
            details: error.message 
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(port, () => {
    console.log(`Backend server running on port ${port}`);
    console.log(`Health check: http://localhost:${port}/health`);
});

module.exports = app; 