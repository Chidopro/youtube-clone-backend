import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useQuery } from 'react-query'
import { usePawnShop } from '../../context/PawnShopContext'
import { Search, AlertCircle, CheckCircle, DollarSign, Calendar, Package } from 'lucide-react'
import axios from 'axios'
import toast from 'react-hot-toast'

const LoanLookup = () => {
  const { currentShop } = usePawnShop()
  const navigate = useNavigate()
  const [searchPerformed, setSearchPerformed] = useState(false)
  
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch
  } = useForm()

  const receiptNumber = watch('receiptNumber')

  // Mock loan data for demonstration
  const mockLoanData = {
    id: 'LOAN-12345',
    receiptNumber: 'R12345',
    customerName: 'John Doe',
    itemDescription: 'Gold Ring - 14K, 5.2g',
    loanAmount: 150.00,
    currentBalance: 150.00,
    interestRate: 0.05, // 5% monthly
    monthlyInterest: 7.50,
    dueDate: '2024-12-15',
    status: 'active',
    createdAt: '2024-11-15',
    lastPaymentDate: null,
    totalPaid: 0.00
  }

  const onSubmit = async (data) => {
    try {
      setSearchPerformed(true)
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // For demo purposes, we'll use mock data
      // In production, this would be: const response = await axios.get(`/loans/${data.receiptNumber}`)
      
      toast.success('Loan found successfully!')
      
      // Navigate to payment form with loan data
      navigate(`/payment/${mockLoanData.id}`, { 
        state: { loanData: mockLoanData }
      })
      
    } catch (error) {
      console.error('Error finding loan:', error)
      toast.error('Unable to find loan. Please check your receipt number.')
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Hero Section */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Find Your Loan & Make a Payment
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Enter your receipt number to find your loan and make secure online payments.
          No account required - just your receipt number.
        </p>
      </div>

      {/* Search Form */}
      <div className="card max-w-md mx-auto mb-8">
        <div className="card-header">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <Search className="w-5 h-5 mr-2" />
            Find My Loan
          </h2>
        </div>
        
        <div className="card-body">
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="form-group">
              <label htmlFor="receiptNumber" className="form-label">
                Receipt Number
              </label>
              <input
                {...register('receiptNumber', {
                  required: 'Receipt number is required',
                  minLength: {
                    value: 3,
                    message: 'Receipt number must be at least 3 characters'
                  }
                })}
                type="text"
                id="receiptNumber"
                placeholder="Enter your receipt number"
                className="input-field"
              />
              {errors.receiptNumber && (
                <p className="form-error">{errors.receiptNumber.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full flex items-center justify-center"
            >
              {isSubmitting ? (
                <>
                  <div className="loading-spinner mr-2"></div>
                  Searching...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  Find My Loan
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Demo Section */}
      {!searchPerformed && (
        <div className="card max-w-2xl mx-auto">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <AlertCircle className="w-5 h-5 mr-2 text-warning-600" />
              Demo Mode
            </h3>
          </div>
          
          <div className="card-body">
            <p className="text-gray-600 mb-4">
              This is a demonstration. Try searching with receipt number: <strong>R12345</strong>
            </p>
            
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">Sample Loan Details:</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="flex items-center">
                  <Package className="w-4 h-4 mr-2 text-gray-500" />
                  <span>Gold Ring - 14K, 5.2g</span>
                </div>
                <div className="flex items-center">
                  <DollarSign className="w-4 h-4 mr-2 text-gray-500" />
                  <span>Loan Amount: $150.00</span>
                </div>
                <div className="flex items-center">
                  <Calendar className="w-4 h-4 mr-2 text-gray-500" />
                  <span>Due Date: Dec 15, 2024</span>
                </div>
                <div className="flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2 text-success-600" />
                  <span>Status: Active</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Features Section */}
      <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="text-center">
          <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-6 h-6 text-primary-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Secure Payments</h3>
          <p className="text-gray-600">
            All payments are processed securely with bank-level encryption
          </p>
        </div>
        
        <div className="text-center">
          <div className="w-12 h-12 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-6 h-6 text-success-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Instant Confirmation</h3>
          <p className="text-gray-600">
            Receive immediate confirmation and digital receipt for your payment
          </p>
        </div>
        
        <div className="text-center">
          <div className="w-12 h-12 bg-secondary-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Download className="w-6 h-6 text-secondary-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Digital Receipts</h3>
          <p className="text-gray-600">
            Download and print your payment receipt anytime
          </p>
        </div>
      </div>
    </div>
  )
}

export default LoanLookup 