import React from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { usePawnShop } from '../../context/PawnShopContext'
import { Shield, CreditCard, History, Download, Menu, X } from 'lucide-react'
import { useState } from 'react'

const CustomerLayout = () => {
  const { currentShop } = usePawnShop()
  const location = useLocation()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const navigation = [
    { name: 'Find My Loan', href: '/', icon: Shield },
    { name: 'Payment History', href: '/history', icon: History },
    { name: 'Download Receipt', href: '/receipt', icon: Download },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo and Shop Name */}
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <img
                  className="h-8 w-auto"
                  src={currentShop?.logo || '/logo.png'}
                  alt={currentShop?.name || 'Pawn Shop'}
                />
              </div>
              <div className="ml-3">
                <h1 className="text-lg font-semibold text-gray-900">
                  {currentShop?.name || 'Pawn Shop'}
                </h1>
                <p className="text-sm text-gray-500">Secure Online Payments</p>
              </div>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex space-x-8">
              {navigation.map((item) => {
                const Icon = item.icon
                const isActive = location.pathname === item.href
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
                      isActive
                        ? 'bg-primary-100 text-primary-700'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {item.name}
                  </Link>
                )
              })}
            </nav>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
              >
                {isMobileMenuOpen ? (
                  <X className="w-6 h-6" />
                ) : (
                  <Menu className="w-6 h-6" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-white border-t border-gray-200">
              {navigation.map((item) => {
                const Icon = item.icon
                const isActive = location.pathname === item.href
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center px-3 py-2 text-base font-medium rounded-md transition-colors duration-200 ${
                      isActive
                        ? 'bg-primary-100 text-primary-700'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-5 h-5 mr-3" />
                    {item.name}
                  </Link>
                )
              })}
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Shop Info */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">
                {currentShop?.name || 'Pawn Shop'}
              </h3>
              <p className="text-sm text-gray-600 mb-2">
                {currentShop?.address || '123 Main St, Demo City, DC 12345'}
              </p>
              <p className="text-sm text-gray-600">
                {currentShop?.phone || '(555) 123-4567'}
              </p>
            </div>

            {/* Security Info */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">
                Security & Trust
              </h3>
              <div className="flex items-center space-x-4">
                <div className="flex items-center text-sm text-gray-600">
                  <Shield className="w-4 h-4 mr-1 text-success-600" />
                  SSL Secured
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <CreditCard className="w-4 h-4 mr-1 text-primary-600" />
                  PCI Compliant
                </div>
              </div>
            </div>

            {/* Support */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">
                Need Help?
              </h3>
              <p className="text-sm text-gray-600 mb-2">
                Contact us for support
              </p>
              <a
                href={`mailto:${currentShop?.email || 'support@example.com'}`}
                className="text-sm text-primary-600 hover:text-primary-700"
              >
                {currentShop?.email || 'support@example.com'}
              </a>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              © 2024 {currentShop?.name || 'Pawn Shop'}. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default CustomerLayout 