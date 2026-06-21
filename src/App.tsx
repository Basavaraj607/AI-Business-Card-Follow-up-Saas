import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './lib/auth-context'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient()
import { LoginPage } from './pages/Login_Page'
import { DashboardPage } from './pages/DashboardPage'
import { ContactsPage } from './pages/ContactsPage'
import { ContactDetailPage } from './pages/ContactDetailPage'
import { UploadPage } from './pages/UploadPage'
import { SettingsPage } from './pages/SettingsPage'
import { FollowupsPage } from './pages/FollowupsPage'
import { EventsPage } from './pages/EventsPage'
import { AdminOverviewPage } from './pages/admin/AdminOverviewPage'
import { AdminTenantsPage } from './pages/admin/AdminTenantsPage'
import { AdminTenantDetailPage } from './pages/admin/AdminTenantDetailPage'
import { AdminUsersPage } from './pages/admin/AdminUsersPage'
import { AdminEventsPage } from './pages/admin/AdminEventsPage'
import { AdminEventRegistrationsPage } from './pages/admin/AdminEventRegistrationsPage'
import AppLayout from './layouts/AppLayout'
import ProtectedRoute from './routes/ProtectedRoute'

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          
          {/* Protected App Shell */}
          <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/contacts" element={<ContactsPage />} />
            <Route path="/contacts/:id" element={<ContactDetailPage />} />
            <Route path="/contacts/upload" element={<UploadPage />} />
            <Route path="/followups" element={<FollowupsPage />} />
            <Route path="/events" element={<EventsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            
            {/* Admin Event Management */}
            <Route path="/admin/events" element={<AdminEventsPage />} />
            <Route path="/admin/events/:id/registrations" element={<AdminEventRegistrationsPage />} />
            
            {/* Super Admin Console */}
            <Route path="/admin" element={<ProtectedRoute requireAdmin={true}><AdminOverviewPage /></ProtectedRoute>} />
            <Route path="/admin/tenants" element={<ProtectedRoute requireAdmin={true}><AdminTenantsPage /></ProtectedRoute>} />
            <Route path="/admin/tenants/:id" element={<ProtectedRoute requireAdmin={true}><AdminTenantDetailPage /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute requireAdmin={true}><AdminUsersPage /></ProtectedRoute>} />
          </Route>

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </QueryClientProvider>
  )
}

export default App

