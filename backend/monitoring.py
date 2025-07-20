# Monitoring and Alerting for ScreenMerch
import logging
import requests
from datetime import datetime
import os

logger = logging.getLogger(__name__)

class SecurityMonitor:
    """Monitor security events and system health"""
    
    def __init__(self):
        self.security_events = []
        self.error_count = 0
        self.alert_threshold = 10
        
    def log_security_event(self, event_type, details, ip_address=None):
        """Log security events"""
        event = {
            'timestamp': datetime.now().isoformat(),
            'type': event_type,
            'details': details,
            'ip_address': ip_address
        }
        
        self.security_events.append(event)
        logger.warning(f"SECURITY EVENT: {event_type} - {details} - IP: {ip_address}")
        
        # Send alert if threshold exceeded
        if len(self.security_events) > self.alert_threshold:
            self.send_security_alert()
    
    def send_security_alert(self):
        """Send security alert via email"""
        try:
            # Use Resend to send security alert
            alert_data = {
                "from": "onboarding@resend.dev",
                "to": [os.getenv("MAIL_TO", "alancraigdigital@gmail.com")],
                "subject": "🚨 ScreenMerch Security Alert",
                "html": f"""
                <h1>Security Alert</h1>
                <p>Multiple security events detected on ScreenMerch:</p>
                <ul>
                    {''.join([f'<li>{event["type"]}: {event["details"]}</li>' for event in self.security_events[-5:]])}
                </ul>
                <p>Total events: {len(self.security_events)}</p>
                <p>Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
                """
            }
            
            response = requests.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {os.getenv('RESEND_API_KEY')}",
                    "Content-Type": "application/json"
                },
                json=alert_data
            )
            
            if response.status_code == 200:
                logger.info("Security alert sent successfully")
            else:
                logger.error(f"Failed to send security alert: {response.text}")
                
        except Exception as e:
            logger.error(f"Error sending security alert: {str(e)}")
    
    def log_error(self, error_type, error_message, context=None):
        """Log application errors"""
        self.error_count += 1
        logger.error(f"ERROR: {error_type} - {error_message} - Context: {context}")
        
        # Send alert if too many errors
        if self.error_count > self.alert_threshold:
            self.send_error_alert()
    
    def send_error_alert(self):
        """Send error alert"""
        try:
            alert_data = {
                "from": "onboarding@resend.dev",
                "to": [os.getenv("MAIL_TO", "alancraigdigital@gmail.com")],
                "subject": "⚠️ ScreenMerch Error Alert",
                "html": f"""
                <h1>Error Alert</h1>
                <p>Multiple errors detected on ScreenMerch:</p>
                <p>Error count: {self.error_count}</p>
                <p>Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
                <p>Check your application logs for details.</p>
                """
            }
            
            response = requests.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {os.getenv('RESEND_API_KEY')}",
                    "Content-Type": "application/json"
                },
                json=alert_data
            )
            
            if response.status_code == 200:
                logger.info("Error alert sent successfully")
            else:
                logger.error(f"Failed to send error alert: {response.text}")
                
        except Exception as e:
            logger.error(f"Error sending error alert: {str(e)}")

# Initialize security monitor
security_monitor = SecurityMonitor() 