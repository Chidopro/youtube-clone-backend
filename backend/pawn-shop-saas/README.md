# PawnPay - Pawn Shop Payment SaaS Platform

A modern, scalable SaaS solution for pawn shops to offer online loan payments to their customers. Built with React, Node.js, and Stripe integration.

## 🚀 Features

### Customer Portal
- **Loan Lookup**: Customers can find their loans using receipt numbers
- **Secure Payments**: Multiple payment options (credit card, bank transfer)
- **Payment History**: Complete transaction history with filtering
- **Digital Receipts**: QR-coded receipts for verification
- **Mobile-First Design**: Responsive design for all devices

### Admin Portal (Coming Soon)
- **Loan Management**: Create and manage pawn loans
- **Customer Database**: Track customer information
- **Payment Processing**: Monitor and process payments
- **Reporting**: Analytics and financial reports
- **Multi-tenant**: Each pawn shop gets their own branded portal

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS
- **Backend**: Node.js, Express (planned)
- **Database**: PostgreSQL (planned)
- **Payment Processing**: Stripe
- **Authentication**: Supabase Auth (planned)
- **Deployment**: Vercel/Netlify

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd pawn-shop-saas
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to `http://localhost:3000`

## 🎯 Demo

Try the demo with these sample data:
- **Receipt Number**: `R12345`
- **Loan Amount**: $150.00
- **Monthly Interest**: $7.50
- **Due Date**: December 15, 2024

## 🏗️ Project Structure

```
src/
├── components/
│   ├── customer/          # Customer portal components
│   │   ├── CustomerLayout.jsx
│   │   ├── LoanLookup.jsx
│   │   ├── PaymentForm.jsx
│   │   ├── PaymentHistory.jsx
│   │   └── ReceiptDownload.jsx
│   ├── admin/            # Admin portal components (planned)
│   └── shared/           # Shared components
├── context/
│   └── PawnShopContext.jsx
├── hooks/               # Custom hooks (planned)
├── utils/               # Utility functions (planned)
└── App.jsx
```

## 🔧 Configuration

### Environment Variables
Create a `.env` file in the root directory:

```env
VITE_API_URL=http://localhost:5000/api
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_key
```

### Multi-tenancy Setup
Each pawn shop gets their own subdomain or URL parameter:
- `demo.pawnpay.com` → Demo Pawn Shop
- `goldenpawn.pawnpay.com` → Golden Pawn Shop
- `cashpawn.pawnpay.com` → Cash Pawn Shop

## 💰 Revenue Model

- **Setup Fee**: $500-1000 per pawn shop
- **Monthly Fee**: $50-100/month per shop
- **Transaction Fee**: 2-3% per payment (optional)

## 🔒 Security Features

- **SSL Encryption**: All data transmitted securely
- **PCI Compliance**: Stripe handles payment security
- **Data Isolation**: Multi-tenant architecture
- **Audit Logs**: Complete payment history tracking

## 🚀 Deployment

### Frontend (Vercel)
```bash
npm run build
vercel --prod
```

### Backend (Railway/Render)
```bash
# Backend deployment instructions coming soon
```

## 📱 Mobile Responsiveness

The platform is designed mobile-first with:
- Touch-friendly interfaces
- Responsive navigation
- Optimized forms for mobile input
- Fast loading times

## 🔄 API Integration

### Planned Endpoints
```
GET    /api/loans/:receiptNumber    # Find loan by receipt
POST   /api/payments                # Process payment
GET    /api/payments/:loanId        # Get payment history
GET    /api/shops/:subdomain        # Get shop info
```

## 🎨 Customization

Each pawn shop can customize:
- **Branding**: Logo, colors, shop name
- **Contact Info**: Address, phone, email
- **Payment Options**: Which payment methods to accept
- **Terms**: Custom terms and conditions

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

This project is proprietary software. All rights reserved.

## 📞 Support

For support or questions:
- Email: support@pawnpay.com
- Documentation: docs.pawnpay.com

---

**Built with ❤️ for the pawn shop industry** 