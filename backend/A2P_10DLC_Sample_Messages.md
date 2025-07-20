# A2P 10DLC Sample Messages for ScreenMerch
*Required for Campaign Registration*

## Campaign Information
- **Company:** ScreenMerch
- **Campaign Type:** Customer Service (Order notifications)
- **Website:** screenmerch.com
- **Contact:** support@screenmerch.com

---

## 1. Opt-In Message
*Sent when customer first consents to SMS*

```
Welcome to ScreenMerch SMS notifications! You'll receive order updates and customer service messages. Reply STOP to opt-out, HELP for support. Message & data rates may apply. Frequency varies.
```

## 2. Opt-Out Confirmation Message  
*Sent when customer replies "STOP"*

```
You have successfully unsubscribed from ScreenMerch SMS notifications. No further messages will be sent. Reply START to opt back in to communication with ScreenMerch.
```

## 3. Help Message
*Sent when customer replies "HELP"*

```
ScreenMerch Help: For support visit screenmerch.com or email support@screenmerch.com. Reply STOP to opt-out. Msg & data rates may apply. Reply START to restart getting messages from ScreenMerch.
```

---

## 4. Sample Operational Messages

### Order Confirmation
```
ScreenMerch: Your order #{{ORDER_ID}} has been confirmed! We're preparing your custom merchandise. You'll receive shipping updates here. Reply STOP to opt-out.
```

### Order Processing  
```
ScreenMerch: Good news! Your order #{{ORDER_ID}} is now in production. Estimated completion: 3-5 business days. Track progress at screenmerch.com/orders
```

### Shipping Notification
```
ScreenMerch: Your order #{{ORDER_ID}} has shipped! Tracking: {{TRACKING_NUMBER}}. Expected delivery: {{DATE}}. Thanks for choosing ScreenMerch!
```

### Delivery Confirmation
```
ScreenMerch: Your order #{{ORDER_ID}} was delivered! Hope you love your custom merchandise. Questions? Reply or email support@screenmerch.com
```

### Customer Service
```
ScreenMerch: Thanks for contacting us! Your support ticket #{{TICKET_ID}} has been created. We'll respond within 24 hours. For urgent matters, email support@screenmerch.com
```

---

## 5. Call-to-Action (CTA) Description for Registration

**Primary CTA Location:** Checkout page during order process

**CTA Process:**
1. Customer adds products to cart
2. Proceeds to checkout at `/checkout/{product_id}`
3. Sees required SMS consent checkbox with text: "I consent to receive SMS notifications from ScreenMerch regarding my order status, shipping updates, and customer service communications"
4. Must check box to proceed with payment
5. Automatically enrolled in SMS notifications upon order completion

**Secondary CTA:** Contact form (future implementation)

---

## 6. Website Compliance Elements

### SMS Consent Language (Checkout Page)
```
* Required: I consent to receive SMS notifications from ScreenMerch regarding my order status, shipping updates, and customer service communications. Message frequency varies. Reply STOP to opt-out, HELP for support. Message and data rates may apply.
```

### SMS Disclosure Box
```
SMS Disclosure:
Who: ScreenMerch
What: Order notifications and customer service  
When: Order updates and as needed
Where: Privacy Policy (screenmerch.com/privacy-policy)
How: Reply STOP to unsubscribe, HELP for assistance
Cost: Message and data rates may apply
```

---

## 7. Privacy Policy Compliance

**Location:** screenmerch.com/privacy-policy

**Key SMS Sections Include:**
- SMS consent and usage explanation
- Message frequency details
- Opt-out process (STOP/HELP commands)
- Data protection and security
- Contact information for support

---

## 8. Business Information Summary

**Legal Business Name:** ScreenMerch  
**Business Type:** E-commerce (Custom Merchandise)  
**EIN:** [To be provided during registration]  
**Business Address:** [To be provided during registration]  
**Contact Email:** support@screenmerch.com  
**Website:** screenmerch.com  
**Primary Use Case:** Customer Service / Order Notifications  

---

## 9. Campaign Registration Notes

✅ **Ready for Registration:**
- Website has compliant SMS opt-in flow
- Privacy policy includes required SMS language  
- Sample messages prepared for all scenarios
- Business documentation ready

🚀 **Next Steps:**
1. Deploy website to production (screenmerch.com)
2. Complete A2P 10DLC Brand registration
3. Submit Campaign registration with these sample messages
4. Wait for approval (3-7 days expected)
5. Test SMS functionality once approved

---

*Document prepared for A2P 10DLC compliance - January 2025* 