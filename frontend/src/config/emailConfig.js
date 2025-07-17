// Mailgun Configuration
// Configured with actual credentials

export const mailgunConfig = {
    domain: 'mg.screenmerch.com',                        // Your Mailgun domain
    apiKey: '0ad53ac2845ce2e134e2ac07e4cc935e-0ce15100-34973130',      // Your Mailgun API key
    fromEmail: 'support@screenmerch.com',                // From email address
    fromName: 'Team ScreenMerch'                         // From name
};

// Note: For security, you should ideally handle Mailgun API calls on your backend
// This frontend implementation is for demo purposes
// In production, create an API endpoint on your server to send emails

