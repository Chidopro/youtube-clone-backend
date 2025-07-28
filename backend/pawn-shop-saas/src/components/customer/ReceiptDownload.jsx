import React, { useState, useEffect } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { usePawnShop } from '../../context/PawnShopContext'
import { 
  Download, 
  Printer, 
  CheckCircle, 
  Share2, 
  ArrowLeft,
  QrCode
} from 'lucide-react'
import { format } from 'date-fns'
import QRCode from 'react-qr-code'
import toast from 'react-hot-toast'

const ReceiptDownload = () => {
  const { paymentId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { currentShop } = usePawnShop()
  const [isPrinting, setIsPrinting] = useState(false)
  
  // Get payment and loan data from navigation state
  const paymentData = location.state?.paymentData || {
    id: paymentId,
    loanId: 'LOAN-12345',
    amount: 7.50,
    paymentMethod: 'card',
    processedAt: new Date().toISOString(),
    receiptNumber: `R${Date.now()}`
  }
  
  const loanData = location.state?.loanData || {
    id: 'LOAN-12345',
    receiptNumber: 'R12345',
    customerName: 'John Doe',
    itemDescription: 'Gold Ring - 14K, 5.2g',
    loanAmount: 150.00,
    currentBalance: 142.50,
    interestRate: 0.05,
    monthlyInterest: 7.50,
    dueDate: '2024-12-15',
    status: 'active'
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const handlePrint = () => {
    setIsPrinting(true)
    setTimeout(() => {
      window.print()
      setIsPrinting(false)
    }, 100)
  }

  const handleDownload = () => {
    // In production, this would generate a PDF
    toast.success('Receipt downloaded successfully!')
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Payment Receipt',
          text: `Payment receipt for ${currentShop?.name}`,
          url: window.location.href
        })
      } catch (error) {
        console.error('Error sharing:', error)
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href)
      toast.success('Receipt link copied to clipboard!')
    }
  }

  const qrCodeData = JSON.stringify({
    receiptNumber: paymentData.receiptNumber,
    paymentId: paymentData.id,
    amount: paymentData.amount,
    shopId: currentShop?.id
  })

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate('/')}
          className="flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Loan Lookup
        </button>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={handleDownload}
            className="btn-secondary flex items-center"
          >
            <Download className="w-4 h-4 mr-2" />
            Download
          </button>
          
          <button
            onClick={handlePrint}
            disabled={isPrinting}
            className="btn-secondary flex items-center"
          >
            {isPrinting ? (
              <div className="loading-spinner mr-2"></div>
            ) : (
              <Printer className="w-4 h-4 mr-2" />
            )}
            Print
          </button>
          
          <button
            onClick={handleShare}
            className="btn-secondary flex items-center"
          >
            <Share2 className="w-4 h-4 mr-2" />
            Share
          </button>
        </div>
      </div>

      {/* Receipt */}
      <div className="card print:shadow-none print:border-none">
        <div className="card-body p-8">
          {/* Receipt Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-success-600 mr-3" />
              <h1 className="text-2xl font-bold text-gray-900">Payment Successful</h1>
            </div>
            <p className="text-gray-600">
              Your payment has been processed successfully
            </p>
          </div>

          {/* Shop Information */}
          <div className="text-center mb-8 pb-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {currentShop?.name || 'Pawn Shop'}
            </h2>
            <p className="text-gray-600 mb-1">
              {currentShop?.address || '123 Main St, Demo City, DC 12345'}
            </p>
            <p className="text-gray-600 mb-1">
              {currentShop?.phone || '(555) 123-4567'}
            </p>
            <p className="text-gray-600">
              {currentShop?.email || 'info@demopawnshop.com'}
            </p>
          </div>

          {/* Payment Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div>
              <h3 className="font-semibold text-gray-900 mb-4">Payment Information</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Receipt Number:</span>
                  <span className="font-medium">{paymentData.receiptNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Payment ID:</span>
                  <span className="font-medium">{paymentData.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Payment Method:</span>
                  <span className="font-medium capitalize">{paymentData.paymentMethod}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Processed Date:</span>
                  <span className="font-medium">
                    {format(new Date(paymentData.processedAt), 'MMM d, yyyy h:mm a')}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-4">Loan Information</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Loan ID:</span>
                  <span className="font-medium">{loanData.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Item:</span>
                  <span className="font-medium">{loanData.itemDescription}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Customer:</span>
                  <span className="font-medium">{loanData.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Original Loan:</span>
                  <span className="font-medium">{formatCurrency(loanData.loanAmount)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Amount */}
          <div className="text-center mb-8 p-6 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-2">Payment Amount</p>
            <p className="text-3xl font-bold text-gray-900">
              {formatCurrency(paymentData.amount)}
            </p>
          </div>

          {/* QR Code */}
          <div className="text-center mb-8">
            <h3 className="font-semibold text-gray-900 mb-4">Verification QR Code</h3>
            <div className="inline-block p-4 bg-white border border-gray-200 rounded-lg">
              <QRCode
                value={qrCodeData}
                size={128}
                level="M"
                includeMargin={true}
              />
            </div>
            <p className="text-sm text-gray-600 mt-2">
              Scan this QR code to verify this receipt
            </p>
          </div>

          {/* Terms and Conditions */}
          <div className="text-xs text-gray-500 text-center border-t border-gray-200 pt-6">
            <p className="mb-2">
              This receipt serves as proof of payment for your pawn loan.
            </p>
            <p>
              For questions or concerns, please contact {currentShop?.name || 'the pawn shop'}.
            </p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-8 text-center">
        <button
          onClick={() => navigate('/')}
          className="btn-primary"
        >
          Make Another Payment
        </button>
      </div>
    </div>
  )
}

export default ReceiptDownload 