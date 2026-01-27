"""Email service for sending notifications"""
import os
import logging
import requests

logger = logging.getLogger(__name__)


def send_order_email(order_details, admin_email=None):
    """Send order notification email instead of SMS"""
    admin_email = admin_email or os.getenv("MAIL_TO") or os.getenv("ADMIN_EMAIL")
    
    if not admin_email:
        logger.warning("Admin email not set. Email notification not sent.")
        return
    
    logger.info(f"📧 Attempting to send order notification email...")
    logger.info(f"  To: {admin_email}")
    logger.info(f"  Subject: New ScreenMerch Order")
    
    try:
        # Use your existing email service (Resend/Mailgun)
        resend_api_key = os.getenv("RESEND_API_KEY")
        if resend_api_key:
            # Use Resend
            headers = {
                'Authorization': f'Bearer {resend_api_key}',
                'Content-Type': 'application/json'
            }
            
            data = {
                'from': os.getenv("RESEND_FROM", 'noreply@screenmerch.com'),
                'to': [admin_email],
                'subject': '🛍️ New ScreenMerch Order Received!',
                'html': f"""
                <h2>New Order Notification</h2>
                <p>You have received a new order on ScreenMerch!</p>
                <div style="background: #f5f5f5; padding: 15px; border-radius: 5px;">
                    {order_details.replace(chr(10), '<br>')}
                </div>
                <p><small>This is an automated notification from ScreenMerch</small></p>
                """
            }
            
            response = requests.post('https://api.resend.com/emails', headers=headers, json=data)
            
            if response.status_code == 200:
                logger.info(f"✅ Order notification email sent successfully!")
                logger.info(f"  Email ID: {response.json().get('id', 'N/A')}")
            else:
                logger.error(f"❌ Error sending email: {response.status_code} - {response.text}")
                
        else:
            logger.error("❌ No email service configured (RESEND_API_KEY not found)")
            
    except Exception as e:
        logger.error(f"❌ Error sending order notification email: {str(e)}")
