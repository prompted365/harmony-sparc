import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { WebSocketProvider } from './contexts/WebSocketContext'
import { SecurityProvider } from './security'
import { Layout } from './components/layout/Layout'
import { Dashboard } from './components/dashboard/Dashboard'
import { FileUpload } from './components/upload/FileUpload'
import { ContentGenerator } from './components/content/ContentGenerator'
import { ContentCalendar } from './components/calendar/ContentCalendar'
import { Analytics } from './components/analytics/Analytics'
import { useAuth } from './contexts/AuthContext'

// Placeholder components for routes not yet implemented
const ContentPage = () => <div className="p-6"><h1 className="text-2xl font-bold">Content Management</h1><p>Content listing and management interface</p></div>
const PreviewPage = () => <div className="p-6"><h1 className="text-2xl font-bold">Content Preview</h1><p>Content preview and editing interface</p></div>
const AgentsPage = () => <div className="p-6"><h1 className="text-2xl font-bold">AI Agents</h1><p>AI agent management and monitoring interface</p></div>
const BrandPage = () => <div className="p-6"><h1 className="text-2xl font-bold">Brand Management</h1><p>Brand profile and style management interface</p></div>
const SettingsPage = () => <div className="p-6"><h1 className="text-2xl font-bold">Settings</h1><p>Application settings and configuration interface</p></div>
const LoginPage = () => <div className="min-h-screen flex items-center justify-center"><h1 className="text-2xl font-bold">Login</h1><p>Authentication interface</p></div>

// Protected Route wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth()
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }
  
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />
}

function App() {
  return (
    <SecurityProvider>
      <AuthProvider>
        <WebSocketProvider>
          <Router>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/content" element={<ContentPage />} />
                        <Route path="/upload" element={<FileUpload />} />
                        <Route path="/generate" element={<ContentGenerator />} />
                        <Route path="/calendar" element={<ContentCalendar />} />
                        <Route path="/preview" element={<PreviewPage />} />
                        <Route path="/agents" element={<AgentsPage />} />
                        <Route path="/analytics" element={<Analytics />} />
                        <Route path="/brand" element={<BrandPage />} />
                        <Route path="/settings" element={<SettingsPage />} />
                      </Routes>
                    </Layout>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </Router>
        </WebSocketProvider>
      </AuthProvider>
    </SecurityProvider>
  )
}

export default App
