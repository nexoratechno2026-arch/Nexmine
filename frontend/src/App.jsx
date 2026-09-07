import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AppLayout from './components/layout/AppLayout'

// Public pages
import Landing from './pages/Landing'
import Login from './pages/auth/Login'
import SignUp from './pages/auth/SignUp'
import ForgotPassword from './pages/auth/ForgotPassword'

// App pages
import Dashboard from './pages/app/Dashboard'
import DataUpload from './pages/app/DataUpload'
import DataQuality from './pages/app/DataQuality'
import CustomerIntel from './pages/app/CustomerIntel'
import ProductIntel from './pages/app/ProductIntel'
import PatternDiscovery from './pages/app/PatternDiscovery'
import AIInsights from './pages/app/AIInsights'
import AskNexMine from './pages/app/AskNexMine'
import WhatIf from './pages/app/WhatIf'
import Reports from './pages/app/Reports'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: 'var(--color-surface)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
              borderRadius: '10px',
              fontSize: '14px',
            },
          }}
        />
        <Routes>
          {/* Public */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ForgotPassword />} />

          {/* Protected app */}
          <Route
            path="/app"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/app/dashboard" replace />} />
            <Route path="dashboard"  element={<Dashboard />} />
            <Route path="upload"     element={<DataUpload />} />
            <Route path="quality"    element={<DataQuality />} />
            <Route path="customers"  element={<CustomerIntel />} />
            <Route path="products"   element={<ProductIntel />} />
            <Route path="patterns"   element={<PatternDiscovery />} />
            <Route path="insights"   element={<AIInsights />} />
            <Route path="ask"        element={<AskNexMine />} />
            <Route path="whatif"     element={<WhatIf />} />
            <Route path="reports"    element={<Reports />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
