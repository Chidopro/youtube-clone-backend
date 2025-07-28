import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { usePawnShop } from '../../context/PawnShopContext'
import { 
  CreditCard, 
  DollarSign, 
  Calendar, 
  Package, 
  AlertCircle,
  CheckCircle,
  Lock,
  Shield
} from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import axios from 'axios'

const PaymentForm = () => {
  const { loanId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { currentShop } = usePawnShop()
  const [isProcessing, setIsProcessing] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('card')
  
  // Get loan data from navigation state or fetch from API
  const loanData = location.state?.loanData || {
    id: loanId,
    receiptNumber: 'R12345',
    customerName: 'John Doe',
    itemDescription: 'Gold Ring - 14K, 5.2g',
    loanAmount: 150.00,
    currentBalance: 150.00,
    interestRate: 0.05,
    monthlyInterest: 7.50,
    dueDate: '2024-12-15',
    status: 'active',
    createdAt: '2024-11-15',
    lastPaymentDate: null,
    totalPaid: 0.00
  }

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue
  } = useForm({
    defaultValues: {
      amount: loanData.monthlyInterest,
      paymentMethod: 'card'
    }
  })

  const watchedAmount = watch('amount')
  const watchedPaymentMethod = watch('paymentMethod')

  // Calculate payment options
  const paymentOptions = [
    {
      label: 'Monthly Interest Only',
      value: loanData.monthlyInterest,
      description: `$${loanData.monthlyInterest.toFixed(2)} - Extends loan by 30 days`
    },
    {
      label: 'Partial Payment',
      value: Math.min(loanData.currentBalance * 0.25, loanData.currentBalance),
      description: '25% of current balance'
    },
    {
      label: 'Full Payment',
      value: loanData.currentBalance,
      description: `$${loanData.currentBalance.toFixed(2)} - Pay off entire loan`
    }
  ]

  const handlePaymentOptionSelect = (option) => {
    setValue('amount', option.value)
  }

  const onSubmit = async (data) => {
    try {
      setIsProcessing(true)
      
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // In production, this would integrate with Stripe
      // const response = await axios.post('/payments', {
      //   loanId: loanData.id,
      //   amount: data.amount,
      //   paymentMethod: data.paymentMethod,
      //   // Stripe payment intent would be created here
      // })
      
      toast.success('Payment processed successfully!')
      
      // Navigate to receipt page
      navigate(`/receipt/PYMT-${Date.now()}`, {
        state: {
          paymentData: {
            id: `PYMT-${Date.now()}`,
            loanId: loanData.id,
            amount: data.amount,
            paymentMethod: data.paymentMethod,
            processedAt: new Date().toISOString(),
            receiptNumber: `R${Date.now()}`
          },
          loanData
        }
      })
      
    } catch (error) {
      console.error('Payment error:', error)
      toast.error('Payment failed. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const getDaysUntilDue = () => {
    const dueDate = new Date(loanData.dueDate)
    const today = new Date()
    const diffTime = dueDate - today
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const daysUntilDue = getDaysUntilDue()

  return (
    <div className="max-w-4xl mx-auto">
      {/* Loan Summary */}
      <div className="card mb-6">
        <div className="card-header">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <Package className="w-5 h-5 mr-2" />
            Loan Summary
          </h2>
        </div>
        
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Item Details</h3>
              <p className="text-gray-600">{loanData.itemDescription}</p>
              <p className="text-sm text-gray-500 mt-1">Receipt: {loanData.receiptNumber}</p>
            </div>
            
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Loan Information</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Original Loan:</span>
                  <span className="font-medium">{formatCurrency(loanData.loanAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Current Balance:</span>
                  <span className="font-medium">{formatCurrency(loanData.currentBalance)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Monthly Interest:</span>
                  <span className="font-medium">{formatCurrency(loanData.monthlyInterest)}</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Due Date</p>
                <p className="font-medium text-gray-900">
                  {format(new Date(loanData.dueDate), 'MMMM d, yyyy')}
                </p>
              </div>
              
              <div className="text-right">
                <p className="text-sm text-gray-600">Days Remaining</p>
                <p className={`font-medium ${daysUntilDue <= 7 ? 'text-danger-600' : 'text-gray-900'}`}>
                  {daysUntilDue} days
                </p>
              </div>
            </div>
            
            {daysUntilDue <= 7 && (
              <div className="mt-3 p-3 bg-warning-50 border border-warning-200 rounded-lg">
                <div className="flex items-center">
                  <AlertCircle className="w-4 h-4 text-warning-600 mr-2" />
                  <span className="text-sm text-warning-800">
                    Your loan is due soon! Make a payment to avoid additional fees.
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payment Form */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <CreditCard className="w-5 h-5 mr-2" />
            Make Payment
          </h2>
        </div>
        
        <div className="card-body">
          <form onSubmit={handleSubmit(onSubmit)}>
            {/* Payment Options */}
            <div className="form-group">
              <label className="form-label">Payment Amount</label>
              <div className="space-y-3">
                {paymentOptions.map((option, index) => (
                  <label key={index} className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="radio"
                      name="paymentOption"
                      value={option.value}
                      checked={watchedAmount === option.value}
                      onChange={() => handlePaymentOptionSelect(option)}
                      className="mr-3"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{option.label}</div>
                      <div className="text-sm text-gray-600">{option.description}</div>
                    </div>
                    <div className="font-semibold text-gray-900">
                      {formatCurrency(option.value)}
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Custom Amount */}
            <div className="form-group">
              <label htmlFor="customAmount" className="form-label">
                Or enter custom amount
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                <input
                  {...register('amount', {
                    required: 'Amount is required',
                    min: {
                      value: 1,
                      message: 'Amount must be at least $1.00'
                    },
                    max: {
                      value: loanData.currentBalance,
                      message: `Amount cannot exceed ${formatCurrency(loanData.currentBalance)}`
                    }
                  })}
                  type="number"
                  step="0.01"
                  min="1"
                  max={loanData.currentBalance}
                  placeholder="0.00"
                  className="input-field pl-8"
                />
              </div>
              {errors.amount && (
                <p className="form-error">{errors.amount.message}</p>
              )}
            </div>

            {/* Payment Method */}
            <div className="form-group">
              <label className="form-label">Payment Method</label>
              <div className="space-y-3">
                <label className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input
                    {...register('paymentMethod')}
                    type="radio"
                    value="card"
                    className="mr-3"
                  />
                  <div className="flex items-center">
                    <CreditCard className="w-5 h-5 mr-2 text-gray-600" />
                    <span className="font-medium">Credit/Debit Card</span>
                  </div>
                </label>
                
                <label className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input
                    {...register('paymentMethod')}
                    type="radio"
                    value="bank"
                    className="mr-3"
                  />
                  <div className="flex items-center">
                    <Shield className="w-5 h-5 mr-2 text-gray-600" />
                    <span className="font-medium">Bank Transfer (ACH)</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Security Notice */}
            <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 mb-6">
              <div className="flex items-start">
                <Lock className="w-5 h-5 text-primary-600 mr-3 mt-0.5" />
                <div>
                  <h4 className="font-medium text-primary-900 mb-1">Secure Payment</h4>
                  <p className="text-sm text-primary-700">
                    Your payment information is encrypted and secure. We use industry-standard 
                    security measures to protect your data.
                  </p>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isProcessing}
              className="btn-primary w-full flex items-center justify-center"
            >
              {isProcessing ? (
                <>
                  <div className="loading-spinner mr-2"></div>
                  Processing Payment...
                </>
              ) : (
                <>
                  <DollarSign className="w-4 h-4 mr-2" />
                  Pay {formatCurrency(watchedAmount)}
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default PaymentForm 