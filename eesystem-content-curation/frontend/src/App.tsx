import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster } from 'react-hot-toast';

import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { useAuth } from './hooks/useAuth';

// Layout Components
import Layout from './components/Layout/Layout';
import ProtectedRoute from './components/Auth/ProtectedRoute';

// Pages
import LoginPage from './pages/Auth/LoginPage';
import RegisterPage from './pages/Auth/RegisterPage';
import DashboardPage from './pages/Dashboard/DashboardPage';
import ContentCreationPage from './pages/Content/ContentCreationPage';
import ContentListPage from './pages/Content/ContentListPage';
import ContentEditPage from './pages/Content/ContentEditPage';
import AnalyticsPage from './pages/Analytics/AnalyticsPage';
import CompliancePage from './pages/Compliance/CompliancePage';
import SchedulingPage from './pages/Scheduling/SchedulingPage';
import SettingsPage from './pages/Settings/SettingsPage';
import UserManagementPage from './pages/Admin/UserManagementPage';
import NotFoundPage from './pages/NotFoundPage';

// Styles
import './index.css';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 3,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

const AppRoutes: React.FC = () => {
  const { isAuthenticated, user } = useAuth();

  return (
    <Routes>
      {/* Public routes */}
      <Route 
        path="/login" 
        element={!isAuthenticated ? <LoginPage /> : <Navigate to="/dashboard" replace />} 
      />
      <Route 
        path="/register" 
        element={!isAuthenticated ? <RegisterPage /> : <Navigate to="/dashboard" replace />} 
      />
      
      {/* Protected routes */}
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        
        {/* Content Management */}
        <Route path="content">
          <Route index element={<ContentListPage />} />
          <Route path="create" element={<ContentCreationPage />} />
          <Route path="edit/:id" element={<ContentEditPage />} />
        </Route>
        
        {/* Analytics */}
        <Route path="analytics" element={<AnalyticsPage />} />
        
        {/* Compliance */}
        <Route path="compliance" element={<CompliancePage />} />
        
        {/* Scheduling */}
        <Route path="scheduling" element={<SchedulingPage />} />
        
        {/* Settings */}
        <Route path="settings" element={<SettingsPage />} />
        
        {/* Admin routes */}
        {user?.role === 'admin' && (
          <Route path="admin">
            <Route path="users" element={<UserManagementPage />} />
          </Route>
        )}
      </Route>
      
      {/* 404 route */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <Router>
            <div className="min-h-screen bg-background text-foreground">
              <AppRoutes />
              <Toaster 
                position="top-right"
                toastOptions={{
                  duration: 4000,
                  style: {
                    background: 'hsl(var(--background))',
                    color: 'hsl(var(--foreground))',
                    border: '1px solid hsl(var(--border))',
                  },
                }}
              />
            </div>
          </Router>
        </AuthProvider>
      </ThemeProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
};

export default App;