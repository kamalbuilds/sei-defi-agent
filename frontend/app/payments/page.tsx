'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  CreditCardIcon,
  BanknotesIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  PlusIcon
} from '@heroicons/react/24/outline'
import Navigation from '@/components/ui/Navigation'
import PaymentFlow from '@/components/PaymentFlow'

const paymentHistory = [
  {
    id: '1',
    type: 'deposit',
    amount: '$5,000.00',
    asset: 'USDC',
    status: 'completed',
    timestamp: '2024-01-15 14:30:00',
    txHash: '0x1234...5678',
    fee: '$2.50'
  },
  {
    id: '2',
    type: 'withdrawal',
    amount: '$1,250.00',
    asset: 'ETH',
    status: 'pending',
    timestamp: '2024-01-15 12:15:00',
    txHash: '0x5678...9abc',
    fee: '$15.75'
  },
  {
    id: '3',
    type: 'swap',
    amount: '$2,500.00',
    asset: 'ETH → USDC',
    status: 'completed',
    timestamp: '2024-01-14 16:45:00',
    txHash: '0x9abc...def0',
    fee: '$8.20'
  },
  {
    id: '4',
    type: 'deposit',
    amount: '$10,000.00',
    asset: 'BTC',
    status: 'failed',
    timestamp: '2024-01-14 09:20:00',
    txHash: '0xdef0...1234',
    fee: '$0.00'
  }
]

const supportedAssets = [
  { symbol: 'ETH', name: 'Ethereum', balance: '12.5', value: '$31,250.00' },
  { symbol: 'BTC', name: 'Bitcoin', balance: '0.75', value: '$32,250.00' },
  { symbol: 'USDC', name: 'USD Coin', balance: '15,000', value: '$15,000.00' },
  { symbol: 'USDT', name: 'Tether', balance: '5,000', value: '$5,000.00' },
  { symbol: 'UNI', name: 'Uniswap', balance: '500', value: '$3,500.00' },
  { symbol: 'LINK', name: 'Chainlink', balance: '200', value: '$2,934.00' }
]

export default function PaymentsPage() {
  const [activeTab, setActiveTab] = useState('deposit')
  const [selectedAsset, setSelectedAsset] = useState('ETH')
  const [amount, setAmount] = useState('')
  const [showPaymentFlow, setShowPaymentFlow] = useState(false)

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon className="h-5 w-5 text-green-400" />
      case 'pending':
        return <ClockIcon className="h-5 w-5 text-yellow-400" />
      case 'failed':
        return <XCircleIcon className="h-5 w-5 text-red-400" />
      default:
        return null
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-400'
      case 'pending':
        return 'text-yellow-400'
      case 'failed':
        return 'text-red-400'
      default:
        return 'text-gray-400'
    }
  }

  const handlePaymentSubmit = (paymentData: any) => {
    console.log('Processing payment:', paymentData)
    setShowPaymentFlow(false)
    // Implementation would handle the actual payment processing
  }

  return (
    <div className="min-h-screen">
      <Navigation />
      
      <div className="pt-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Payments & Transfers</h1>
            <p className="text-gray-300">
              Manage your deposits, withdrawals, and cross-chain transfers
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Payment Form */}
            <div className="lg:col-span-2">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="glass-effect p-6 rounded-xl"
              >
                {/* Tab Navigation */}
                <div className="flex space-x-1 mb-6 bg-dark-800 p-1 rounded-lg">
                  {['deposit', 'withdraw', 'swap'].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`flex-1 py-3 px-4 rounded-lg font-medium capitalize transition-colors ${
                        activeTab === tab
                          ? 'bg-primary-600 text-white'
                          : 'text-gray-300 hover:bg-white/10'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                {/* Payment Form */}
                <div className="space-y-6">
                  {/* Asset Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Select Asset
                    </label>
                    <select
                      value={selectedAsset}
                      onChange={(e) => setSelectedAsset(e.target.value)}
                      className="w-full bg-dark-800 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-primary-500 focus:outline-none"
                    >
                      {supportedAssets.map((asset) => (
                        <option key={asset.symbol} value={asset.symbol}>
                          {asset.name} ({asset.symbol}) - {asset.balance}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Amount Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Amount
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-dark-800 border border-gray-600 rounded-lg px-4 py-3 pr-16 text-white focus:border-primary-500 focus:outline-none"
                      />
                      <span className="absolute right-4 top-3 text-gray-400">
                        {selectedAsset}
                      </span>
                    </div>
                    <div className="flex justify-between mt-2 text-sm text-gray-400">
                      <span>Available: {supportedAssets.find(a => a.symbol === selectedAsset)?.balance} {selectedAsset}</span>
                      <button className="text-primary-400 hover:text-primary-300">
                        Use Max
                      </button>
                    </div>
                  </div>

                  {/* Network Selection (for deposits/withdrawals) */}
                  {activeTab !== 'swap' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Network
                      </label>
                      <select className="w-full bg-dark-800 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-primary-500 focus:outline-none">
                        <option value="ethereum">Ethereum (ETH)</option>
                        <option value="polygon">Polygon (MATIC)</option>
                        <option value="arbitrum">Arbitrum (ETH)</option>
                        <option value="optimism">Optimism (ETH)</option>
                      </select>
                    </div>
                  )}

                  {/* Address Input (for withdrawals) */}
                  {activeTab === 'withdraw' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Recipient Address
                      </label>
                      <input
                        type="text"
                        placeholder="0x..."
                        className="w-full bg-dark-800 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-primary-500 focus:outline-none"
                      />
                    </div>
                  )}

                  {/* To Asset (for swaps) */}
                  {activeTab === 'swap' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        To Asset
                      </label>
                      <select className="w-full bg-dark-800 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-primary-500 focus:outline-none">
                        {supportedAssets.filter(a => a.symbol !== selectedAsset).map((asset) => (
                          <option key={asset.symbol} value={asset.symbol}>
                            {asset.name} ({asset.symbol})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Transaction Summary */}
                  <div className="bg-dark-800 p-4 rounded-lg">
                    <h3 className="text-white font-semibold mb-3">Transaction Summary</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Amount:</span>
                        <span className="text-white">{amount || '0'} {selectedAsset}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Network Fee:</span>
                        <span className="text-white">~$5.20</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Service Fee:</span>
                        <span className="text-white">$2.50</span>
                      </div>
                      <div className="border-t border-gray-600 pt-2 flex justify-between font-semibold">
                        <span className="text-gray-300">Total:</span>
                        <span className="text-white">{amount || '0'} {selectedAsset} + $7.70</span>
                      </div>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    onClick={() => setShowPaymentFlow(true)}
                    disabled={!amount || parseFloat(amount) <= 0}
                    className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-3 px-6 rounded-lg font-semibold flex items-center justify-center space-x-2 transition-colors"
                  >
                    <span>
                      {activeTab === 'deposit' ? 'Deposit' :
                       activeTab === 'withdraw' ? 'Withdraw' : 'Swap'}
                    </span>
                    <ArrowRightIcon className="h-5 w-5" />
                  </button>
                </div>
              </motion.div>
            </div>

            {/* Asset Balances */}
            <div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="glass-effect p-6 rounded-xl mb-6"
              >
                <h2 className="text-xl font-bold text-white mb-4">Your Balances</h2>
                <div className="space-y-3">
                  {supportedAssets.map((asset) => (
                    <div key={asset.symbol} className="flex items-center justify-between p-3 bg-dark-800 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gradient-to-r from-primary-600 to-accent-600 rounded-full flex items-center justify-center">
                          <span className="text-white font-bold text-xs">{asset.symbol}</span>
                        </div>
                        <div>
                          <p className="text-white font-medium">{asset.symbol}</p>
                          <p className="text-gray-400 text-sm">{asset.balance}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-white font-semibold">{asset.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Quick Actions */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="glass-effect p-6 rounded-xl"
              >
                <h2 className="text-xl font-bold text-white mb-4">Quick Actions</h2>
                <div className="space-y-3">
                  <button className="w-full bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-lg flex items-center justify-center space-x-2 transition-colors">
                    <PlusIcon className="h-5 w-5" />
                    <span>Add Funds</span>
                  </button>
                  <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg flex items-center justify-center space-x-2 transition-colors">
                    <BanknotesIcon className="h-5 w-5" />
                    <span>Withdraw Profits</span>
                  </button>
                  <button className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 px-4 rounded-lg flex items-center justify-center space-x-2 transition-colors">
                    <CreditCardIcon className="h-5 w-5" />
                    <span>Buy with Card</span>
                  </button>
                </div>
              </motion.div>
            </div>
          </div>

          {/* Transaction History */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="glass-effect p-6 rounded-xl mt-8"
          >
            <h2 className="text-xl font-bold text-white mb-6">Transaction History</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-gray-400 text-sm border-b border-gray-700">
                    <th className="text-left py-3 px-2">Type</th>
                    <th className="text-left py-3 px-2">Amount</th>
                    <th className="text-left py-3 px-2">Asset</th>
                    <th className="text-left py-3 px-2">Status</th>
                    <th className="text-left py-3 px-2">Time</th>
                    <th className="text-left py-3 px-2">Fee</th>
                    <th className="text-left py-3 px-2">TX Hash</th>
                  </tr>
                </thead>
                <tbody className="text-white">
                  {paymentHistory.map((tx) => (
                    <tr key={tx.id} className="border-b border-gray-800 hover:bg-white/5">
                      <td className="py-4 px-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${
                          tx.type === 'deposit' ? 'bg-green-900 text-green-300' :
                          tx.type === 'withdrawal' ? 'bg-red-900 text-red-300' :
                          'bg-blue-900 text-blue-300'
                        }`}>
                          {tx.type}
                        </span>
                      </td>
                      <td className="py-4 px-2 font-semibold">{tx.amount}</td>
                      <td className="py-4 px-2">{tx.asset}</td>
                      <td className="py-4 px-2">
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(tx.status)}
                          <span className={`capitalize ${getStatusColor(tx.status)}`}>
                            {tx.status}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-2 text-gray-400 text-sm">
                        {new Date(tx.timestamp).toLocaleString()}
                      </td>
                      <td className="py-4 px-2">{tx.fee}</td>
                      <td className="py-4 px-2">
                        <a
                          href={`https://etherscan.io/tx/${tx.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary-400 hover:text-primary-300 text-sm"
                        >
                          {tx.txHash}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Payment Flow Modal */}
      {showPaymentFlow && (
        <PaymentFlow
          type={activeTab}
          asset={selectedAsset}
          amount={amount}
          onSubmit={handlePaymentSubmit}
          onCancel={() => setShowPaymentFlow(false)}
        />
      )}
    </div>
  )
}