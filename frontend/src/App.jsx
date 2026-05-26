import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ConfirmProvider } from './context/ConfirmContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import LandingPage from './pages/LandingPage';
import DashboardPage from './pages/DashboardPage';
import ProfilePage from './pages/ProfilePage';
import FriendsPage from './pages/FriendsPage';
import UserSearchPage from './pages/UserSearchPage';
import MatchmakingPage from './pages/MatchmakingPage';
import MatchDetailPage from './pages/MatchDetailPage';
import ResultPage from './pages/ResultPage';
import GamePage from './pages/GamePage';
import SettingsPage from './pages/SettingsPage';

const App = () => {
  return (
    <AuthProvider>
      <ToastProvider>
        <ConfirmProvider>
      <Router>
        <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-color)', color: 'var(--text-primary)' }}>
          <Navbar />
          <main>
            <Routes>
              {/* Public */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* Protected */}
              <Route path="/dashboard" element={
                <ProtectedRoute><DashboardPage /></ProtectedRoute>
              } />
              <Route path="/play" element={
                <ProtectedRoute><MatchmakingPage /></ProtectedRoute>
              } />
              <Route path="/play/:matchId" element={
                <ProtectedRoute><GamePage /></ProtectedRoute>
              } />
              <Route path="/profile/:userID" element={
                <ProtectedRoute><ProfilePage /></ProtectedRoute>
              } />
              <Route path="/friends" element={
                <ProtectedRoute><FriendsPage /></ProtectedRoute>
              } />
              <Route path="/search" element={
                <ProtectedRoute><UserSearchPage /></ProtectedRoute>
              } />
              <Route path="/match/:matchID" element={
                <ProtectedRoute><MatchDetailPage /></ProtectedRoute>
              } />
              <Route path="/result" element={
                <ProtectedRoute><ResultPage /></ProtectedRoute>
              } />
              <Route path="/settings" element={
                <ProtectedRoute><SettingsPage /></ProtectedRoute>
              } />

              {/* Catch all */}
              <Route path="*" element={<Navigate to="/" />} />

            </Routes>
          </main>
        </div>
      </Router>
        </ConfirmProvider>
      </ToastProvider>
    </AuthProvider>
  );
};

export default App;
