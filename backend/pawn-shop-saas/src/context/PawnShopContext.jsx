import React, { createContext, useContext, useState, useEffect } from 'react'
import { useQuery } from 'react-query'
import axios from 'axios'

const PawnShopContext = createContext()

export const usePawnShop = () => {
  const context = useContext(PawnShopContext)
  if (!context) {
    throw new Error('usePawnShop must be used within a PawnShopProvider')
  }
  return context
}

export const PawnShopProvider = ({ children }) => {
  const [currentShop, setCurrentShop] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  // Get shop info based on subdomain or URL parameter
  const { data: shopInfo, error: shopError } = useQuery(
    ['shop-info'],
    async () => {
      const subdomain = window.location.hostname.split('.')[0]
      const response = await axios.get(`/shops/${subdomain}`)
      return response.data
    },
    {
      retry: false,
      onSuccess: (data) => {
        setCurrentShop(data)
        setIsLoading(false)
      },
      onError: () => {
        // Fallback to default shop for development
        setCurrentShop({
          id: 'demo-shop',
          name: 'Demo Pawn Shop',
          logo: '/logo.png',
          primaryColor: '#0ea5e9',
          secondaryColor: '#d946ef',
          address: '123 Main St, Demo City, DC 12345',
          phone: '(555) 123-4567',
          email: 'info@demopawnshop.com',
          website: 'https://demopawnshop.com'
        })
        setIsLoading(false)
      }
    }
  )

  const value = {
    currentShop,
    isLoading,
    shopError,
    setCurrentShop
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="loading-spinner mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <PawnShopContext.Provider value={value}>
      {children}
    </PawnShopContext.Provider>
  )
} 