// Mailgun Configuration
// Configured with actual credentials

export const mailgunConfig = {
    domain: 'mg.screenmerch.com',                        // Your Mailgun domain
    apiKey: 'key-9b51e73e6a4cb4b6f4d27d69f3e6ed25',      // Your Mailgun API key
    fromEmail: 'support@screenmerch.com',                // From email address
    fromName: 'Team ScreenMerch'                         // From name
};

// Note: For security, you should ideally handle Mailgun API calls on your backend
// This frontend implementation is for demo purposes
// In production, create an API endpoint on your server to send emails

