import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ThemeToggle from './components/ThemeToggle';
import ErrorBoundary from './components/ErrorBoundary';

// ── Lazy-load page components ──
// Only the page the user visits gets downloaded.
// Participants load ~40KB (Home + ParticipantRoom) instead of ~180KB (all pages).
const Home = lazy(() => import('./pages/Home'));
const ParticipantRoom = lazy(() => import('./pages/participant/ParticipantRoom'));
const AdminLogin = lazy(() => import('./pages/admin/AdminLogin'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminLiveControl = lazy(() => import('./pages/admin/AdminLiveControl'));
const PresenterView = lazy(() => import('./pages/admin/PresenterView'));

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen relative overflow-hidden flex flex-col">
        {/* Background Gradients */}
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-brand-600/20 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-fuchsia-600/20 rounded-full blur-[100px] pointer-events-none"></div>
        
        <div className="absolute top-4 right-4 z-50">
          <ThemeToggle />
        </div>

        <ErrorBoundary>
          <Suspense fallback={
            <div className="flex-1 flex items-center justify-center min-h-screen">
              <div className="animate-spin w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full"></div>
            </div>
          }>
            <div className="flex-1 z-10">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/room/:roomCode" element={<ParticipantRoom />} />
                <Route path="/admin/login" element={<AdminLogin />} />
                <Route path="/admin/dashboard" element={<AdminDashboard />} />
                <Route path="/admin/room/:roomId" element={<AdminLiveControl />} />
                <Route path="/admin/present/:roomId" element={<PresenterView />} />
              </Routes>
            </div>
          </Suspense>
        </ErrorBoundary>
      </div>
    </BrowserRouter>
  );
}

export default App;
