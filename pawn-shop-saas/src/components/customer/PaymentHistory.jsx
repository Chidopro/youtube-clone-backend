import React, { useState } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { usePawnShop } from '../../context/PawnShopContext'
import { 
  History, 
  DollarSign, 
  Calendar, 
  Download, 
  ArrowLeft,
  Filter,
  Search
} from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const PaymentHistory = () => {
  const { loanId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { currentShop } = usePawnShop()
  const [filter, setFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  
  // Mock payment history data
  const mockPaymentHistory = [
    {
      id: 'PYMT-001',
      amount: 7.50,
      paymentMethod: 'card',
      processedAt: '2024-12-01T10:30:00Z',
      status: 'completed',
      receiptNumber: 'R001',
      description: 'Monthly interest payment'
    },
    {
      id: 'PYMT-002',
      amount: 15.00,
      paymentMethod: 'bank',
      processedAt: '2024-11-01T14:20:00Z',
      status: 'completed',
      receiptNumber: 'R002',
      description: 'Partial payment'
    },
    {
      id: 'PYMT-003',
      amount: 7.50,
      paymentMethod: 'card',
      processedAt: '2024-10-01T09:15:00Z',
      status: 'completed',
      receiptNumber: 'R003',
      description: 'Monthly interest payment'
    }
  ]

  const loanData = location.state?.loanData || {
    id: loanId,
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

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'text-success-600 bg-success-50'
      case 'pending':
        return 'text-warning-600 bg-warning-50'
      case 'failed':
        return 'text-danger-600 bg-danger-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return '✓'
      case 'pending':
        return '⏳'
      case 'failed':
        return '✗'
      default:
        return '?'
    }
  }

  const filteredPayments = mockPaymentHistory.filter(payment => {
    const matchesFilter = filter === 'all' || payment.status === filter
    const matchesSearch = payment.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         payment.receiptNumber.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesFilter && matchesSearch
  })

  const totalPaid = mockPaymentHistory.reduce((sum, payment) => sum + payment.amount, 0)

  const handleDownloadReceipt = (payment) => {
    // In production, this would download the actual receipt
    toast.success(`Receipt ${payment.receiptNumber} downloaded!`)
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate('/')}
          className="flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Loan Lookup
        </button>
        
        <h1 className="text-2xl font-bold text-gray-900">Payment History</h1>
      </div>

      {/* Loan Summary */}
      <div className="card mb-6">
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Loan Details</h3>
              <p className="text-gray-600">{loanData.itemDescription}</p>
              <p className="text-sm text-gray-500">Receipt: {loanData.receiptNumber}</p>
            </div>
            
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Payment Summary</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Paid:</span>
                  <span className="font-medium">{formatCurrency(totalPaid)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Current Balance:</span>
                  <span className="font-medium">{formatCurrency(loanData.currentBalance)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Payments Made:</span>
                  <span className="font-medium">{mockPaymentHistory.length}</span>
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Next Payment</h3>
              <p className="text-gray-600">
                Due: {format(new Date(loanData.dueDate), 'MMM d, yyyy')}
              </p>
              <p className="text-sm text-gray-500">
                Amount: {formatCurrency(loanData.monthlyInterest)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="card mb-6">
        <div className="card-body">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search payments..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input-field pl-10"
                />
              </div>
            </div>
            
            {/* Filter */}
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="input-field"
              >
                <option value="all">All Payments</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Payment History Table */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <History className="w-5 h-5 mr-2" />
            Payment History
          </h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payment ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Method
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredPayments.length > 0 ? (
                filteredPayments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{payment.id}</div>
                        <div className="text-sm text-gray-500">{payment.receiptNumber}</div>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {format(new Date(payment.processedAt), 'MMM d, yyyy')}
                      </div>
                      <div className="text-sm text-gray-500">
                        {format(new Date(payment.processedAt), 'h:mm a')}
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {formatCurrency(payment.amount)}
                      </div>
                      <div className="text-sm text-gray-500">
                        {payment.description}
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="capitalize text-sm text-gray-900">
                        {payment.paymentMethod}
                      </span>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(payment.status)}`}>
                        <span className="mr-1">{getStatusIcon(payment.status)}</span>
                        {payment.status}
                      </span>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleDownloadReceipt(payment)}
                        className="text-primary-600 hover:text-primary-900 flex items-center"
                      >
                        <Download className="w-4 h-4 mr-1" />
                        Receipt
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center">
                    <div className="text-gray-500">
                      <History className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <p className="text-lg font-medium">No payments found</p>
                      <p className="text-sm">Try adjusting your search or filter criteria</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <div className="card-body text-center">
            <div className="text-2xl font-bold text-gray-900">{mockPaymentHistory.length}</div>
            <div className="text-sm text-gray-600">Total Payments</div>
          </div>
        </div>
        
        <div className="card">
          <div className="card-body text-center">
            <div className="text-2xl font-bold text-success-600">
              {formatCurrency(totalPaid)}
            </div>
            <div className="text-sm text-gray-600">Total Paid</div>
          </div>
        </div>
        
        <div className="card">
          <div className="card-body text-center">
            <div className="text-2xl font-bold text-primary-600">
              {formatCurrency(mockPaymentHistory[0]?.amount || 0)}
            </div>
            <div className="text-sm text-gray-600">Last Payment</div>
          </div>
        </div>
        
        <div className="card">
          <div className="card-body text-center">
            <div className="text-2xl font-bold text-warning-600">
              {formatCurrency(loanData.monthlyInterest)}
            </div>
            <div className="text-sm text-gray-600">Next Payment Due</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PaymentHistory 