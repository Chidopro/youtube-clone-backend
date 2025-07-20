import React from 'react'
import { Routes, Route } from 'react-router-dom'
import { useQuery } from 'react-query'
import axios from 'axios'

// Customer Portal Components
import CustomerLayout from './components/customer/CustomerLayout'
import LoanLookup from './components/customer/LoanLookup'
import PaymentForm from './components/customer/PaymentForm'
import PaymentHistory from './components/customer/PaymentHistory'
import ReceiptDownload from './components/customer/ReceiptDownload'

// Admin Portal Components
import AdminLayout from './components/admin/AdminLayout'
import AdminDashboard from './components/admin/AdminDashboard'
import LoanManagement from './components/admin/LoanManagement'
import CustomerManagement from './components/admin/CustomerManagement'
import PaymentProcessing from './components/admin/PaymentProcessing'

// Shared Components
import LoadingSpinner from './components/shared/LoadingSpinner'
import ErrorBoundary from './components/shared/ErrorBoundary'

// Context
import { PawnShopProvider } from './context/PawnShopContext'

// API Configuration
axios.defaults.baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

function App() {
  return (
    <ErrorBoundary>
      <PawnShopProvider>
        <div className="min-h-screen bg-gray-50">
          <Routes>
            {/* Customer Portal Routes */}
            <Route path="/" element={<CustomerLayout />}>
              <Route index element={<LoanLookup />} />
              <Route path="payment/:loanId" element={<PaymentForm />} />
              <Route path="history/:loanId" element={<PaymentHistory />} />
              <Route path="receipt/:paymentId" element={<ReceiptDownload />} />
            </Route>
            
            {/* Admin Portal Routes */}
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="loans" element={<LoanManagement />} />
              <Route path="customers" element={<CustomerManagement />} />
              <Route path="payments" element={<PaymentProcessing />} />
            </Route>
            
            {/* 404 Route */}
            <Route path="*" element={
              <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                  <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
                  <p className="text-gray-600 mb-8">Page not found</p>
                  <a href="/" className="btn-primary">Go Home</a>
                </div>
              </div>
            } />
          </Routes>
        </div>
      </PawnShopProvider>
    </ErrorBoundary>
  )
}

export default App 