import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const OtpPage = lazy(() => import('./pages/OtpPage'));
const SelectTrustPage = lazy(() => import('./pages/SelectTrustPage'));
const CreateTrustPage = lazy(() => import('./pages/CreateTrustPage'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const TrusteesPage = lazy(() => import('./pages/TrusteesPage'));
const TrustDetails = lazy(() => import('./pages/TrustDetails'));
const SponsorsPage = lazy(() => import('./pages/SponsorsPage'));
const MembersPage = lazy(() => import('./pages/MembersPage'));
const MemberProfilePage = lazy(() => import('./pages/MemberProfilePage'));
const GalleryPage = lazy(() => import('./pages/GalleryPage'));
const MarqueePage = lazy(() => import('./pages/MarqueePage'));
const ThemePage = lazy(() => import('./pages/ThemePage'));
const FeatureControlPage = lazy(() => import('./pages/FeatureControlPage'));
const SubFeatureControlPage = lazy(() => import('./pages/SubFeatureControlPage'));

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Suspense fallback={<div style={{ padding: 16 }}>Loading module...</div>}>
        <Routes>
          <Route path="/"             element={<Navigate to="/login" replace />} />
          <Route path="/login"        element={<LoginPage />} />
          <Route path="/verify-otp"   element={<OtpPage />} />
          <Route path="/select-trust" element={<SelectTrustPage />} />
          <Route path="/create-trust" element={<CreateTrustPage />} />
          <Route path="/dashboard"    element={<Dashboard />} />
          <Route path="/trust-details" element={<TrustDetails />} />
          <Route path="/trustees"     element={<TrusteesPage />} />
          <Route path="/sponsor"      element={<SponsorsPage />} />
          <Route path="/members"      element={<MembersPage />} />
          <Route path="/member-profile" element={<MemberProfilePage />} />
          <Route path="/gallery"      element={<GalleryPage />} />
          <Route path="/gallery/:folderId" element={<GalleryPage />} />
          <Route path="/marquee"      element={<MarqueePage />} />
          <Route path="/theme"        element={<ThemePage />} />
          <Route path="/feature-control" element={<FeatureControlPage />} />
          <Route path="/sub-feature-control" element={<SubFeatureControlPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
