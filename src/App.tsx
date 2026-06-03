import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './lib/auth-context'
import { LoginPage } from './pages/Login_Page'
import { DashboardPage } from './pages/DashboardPage'
import { ContactsPage } from './pages/ContactsPage'
import { UploadPage } from './pages/UploadPage'
import { SettingsPage } from './pages/SettingsPage'
import { AdminOverviewPage } from './pages/admin/AdminOverviewPage'
import { AdminTenantsPage } from './pages/admin/AdminTenantsPage'
import { AdminTenantDetailPage } from './pages/admin/AdminTenantDetailPage'
import { AdminUsersPage } from './pages/admin/AdminUsersPage'
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage'
import AppLayout from './layouts/AppLayout'
import ProtectedRoute from './routes/ProtectedRoute'

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          
          {/* Protected App Shell */}
          <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/contacts" element={<ContactsPage />} />
            <Route path="/contacts/upload" element={<UploadPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            
            {/* Super Admin Console */}
            <Route path="/admin" element={<ProtectedRoute requireAdmin={true}><AdminOverviewPage /></ProtectedRoute>} />
            <Route path="/admin/tenants" element={<ProtectedRoute requireAdmin={true}><AdminTenantsPage /></ProtectedRoute>} />
            <Route path="/admin/tenants/:id" element={<ProtectedRoute requireAdmin={true}><AdminTenantDetailPage /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute requireAdmin={true}><AdminUsersPage /></ProtectedRoute>} />
            <Route path="/admin/settings" element={<ProtectedRoute requireAdmin={true}><AdminSettingsPage /></ProtectedRoute>} />
          </Route>

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App

