'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  XMarkIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CreditCardIcon,
  WalletIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline'

interface PaymentFlowProps {
  type: 'deposit' | 'withdraw' | 'swap'
  asset: string
  amount: string
  onSubmit: (data: any) => void
  onCancel: () => void
}

type FlowStep = 'confirm' | 'processing' | 'success' | 'error'

export default function PaymentFlow({ type, asset, amount, onSubmit, onCancel }: PaymentFlowProps) {
  const [currentStep, setCurrentStep] = useState<FlowStep>('confirm')
  const [transactionHash, setTransactionHash] = useState('')
  const [error, setError] = useState('')

  const handleConfirm = async () => {
    setCurrentStep('processing')
    
    // Simulate transaction processing
    setTimeout(() => {
      // Simulate random success/failure
      if (Math.random() > 0.2) {
        setTransactionHash('0x1234567890abcdef1234567890abcdef12345678')
        setCurrentStep('success')
        setTimeout(() => {
          onSubmit({
            type,
            asset,
            amount,
            txHash: transactionHash
          })
        }, 2000)
      } else {
        setError('Transaction failed: Insufficient gas or network congestion')
        setCurrentStep('error')
      }
    }, 3000)
  }

  const handleRetry = () => {
    setError('')
    setCurrentStep('confirm')
  }

  const getStepContent = () => {
    switch (currentStep) {
      case 'confirm':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-primary-600 to-accent-600 rounded-full flex items-center justify-center mx-auto mb-4">
                {type === 'deposit' ? (
                  <WalletIcon className="h-8 w-8 text-white" />
                ) : type === 'withdraw' ? (
                  <CreditCardIcon className="h-8 w-8 text-white" />
                ) : (
                  <ArrowRightIcon className="h-8 w-8 text-white" />
                )}
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Confirm {type.charAt(0).toUpperCase() + type.slice(1)}
              </h2>
              <p className="text-gray-300">
                Review your transaction details before proceeding
              </p>
            </div>

            {/* Transaction Details */}
            <div className="bg-dark-800 rounded-lg p-6 space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-400">Type:</span>
                <span className="text-white font-semibold capitalize">{type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Asset:</span>
                <span className="text-white font-semibold">{asset}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Amount:</span>
                <span className="text-white font-semibold">{amount} {asset}</span>
              </div>
              <div className="border-t border-gray-600 pt-4">
                <div className="flex justify-between">
                  <span className="text-gray-400">Network Fee:</span>
                  <span className="text-white">~$5.20</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Service Fee:</span>
                  <span className="text-white">$2.50</span>
                </div>
                <div className="flex justify-between font-semibold border-t border-gray-600 pt-2 mt-2">
                  <span className="text-gray-300">Total Cost:</span>
                  <span className="text-white">{amount} {asset} + $7.70</span>
                </div>
              </div>
            </div>

            {/* Warning */}
            <div className="bg-yellow-900/20 border border-yellow-400/30 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400 mt-0.5" />
                <div>
                  <p className="text-yellow-300 text-sm font-medium">Important Notice</p>
                  <p className="text-yellow-200 text-xs mt-1">
                    Make sure you have enough {asset} and ETH for gas fees. 
                    This transaction cannot be reversed once confirmed.
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-4">
              <button
                onClick={onCancel}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-3 px-6 rounded-lg font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 bg-primary-600 hover:bg-primary-700 text-white py-3 px-6 rounded-lg font-semibold transition-colors"
              >
                Confirm Transaction
              </button>
            </div>
          </div>
        )

      case 'processing':
        return (
          <div className="text-center space-y-6">
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <ClockIcon className="h-8 w-8 text-white animate-spin" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Processing Transaction</h2>
              <p className="text-gray-300 mb-4">
                Please wait while your transaction is being processed...
              </p>
              <div className="flex justify-center space-x-2">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-3 h-3 bg-primary-600 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.1}s` }}
                  />
                ))}
              </div>
            </div>
            <div className="bg-blue-900/20 border border-blue-400/30 rounded-lg p-4">
              <p className="text-blue-300 text-sm">
                🔄 Broadcasting to network...<br />
                ⛽ Estimating gas fees...<br />
                📡 Waiting for confirmation...
              </p>
            </div>
          </div>
        )

      case 'success':
        return (
          <div className="text-center space-y-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4"
            >
              <CheckCircleIcon className="h-8 w-8 text-white" />
            </motion.div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Transaction Successful!</h2>
              <p className="text-gray-300">
                Your {type} of {amount} {asset} has been completed
              </p>
            </div>

            {/* Transaction Details */}
            <div className="bg-green-900/20 border border-green-400/30 rounded-lg p-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-green-300">Status:</span>
                  <span className="text-green-400 font-semibold">Confirmed</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-green-300">Transaction Hash:</span>
                  <a
                    href={`https://etherscan.io/tx/${transactionHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-400 hover:text-primary-300 font-mono text-xs"
                  >
                    {transactionHash.slice(0, 10)}...{transactionHash.slice(-8)}
                  </a>
                </div>
                <div className="flex justify-between">
                  <span className="text-green-300">Block Confirmations:</span>
                  <span className="text-green-400">12/12</span>
                </div>
              </div>
            </div>

            <button
              onClick={onCancel}
              className="w-full bg-primary-600 hover:bg-primary-700 text-white py-3 px-6 rounded-lg font-semibold transition-colors"
            >
              Continue
            </button>
          </div>
        )

      case 'error':
        return (
          <div className="text-center space-y-6">
            <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <XMarkIcon className="h-8 w-8 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Transaction Failed</h2>
              <p className="text-gray-300 mb-4">
                Your transaction could not be completed
              </p>
            </div>

            {/* Error Details */}
            <div className="bg-red-900/20 border border-red-400/30 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-400 mt-0.5" />
                <div className="text-left">
                  <p className="text-red-300 text-sm font-medium">Error Details</p>
                  <p className="text-red-200 text-xs mt-1">{error}</p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-4">
              <button
                onClick={onCancel}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-3 px-6 rounded-lg font-semibold transition-colors"
              >
                Close
              </button>
              <button
                onClick={handleRetry}
                className="flex-1 bg-primary-600 hover:bg-primary-700 text-white py-3 px-6 rounded-lg font-semibold transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="glass-effect p-8 rounded-xl max-w-lg w-full mx-4 relative"
      >
        {/* Close Button */}
        {currentStep !== 'processing' && (
          <button
            onClick={onCancel}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white transition-colors"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        )}

        {/* Step Indicator */}
        <div className="flex justify-center space-x-2 mb-8">
          {(['confirm', 'processing', 'success'] as FlowStep[]).map((step, index) => (
            <div
              key={step}
              className={`w-2 h-2 rounded-full transition-colors ${
                step === currentStep ? 'bg-primary-600' :
                ['confirm', 'processing', 'success'].indexOf(currentStep) > index ? 'bg-green-600' :
                'bg-gray-600'
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {getStepContent()}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  )
}