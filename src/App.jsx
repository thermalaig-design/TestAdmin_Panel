import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage       from './pages/LoginPage';
import OtpPage         from './pages/OtpPage';
import SelectTrustPage from './pages/SelectTrustPage';
import CreateTrustPage from './pages/CreateTrustPage';
import Dashboard       from './pages/Dashboard';
import TrusteesPage    from './pages/TrusteesPage';
import TrustDetails    from './pages/TrustDetails';
import SponsorsPage    from './pages/SponsorsPage';
import MembersPage     from './pages/MembersPage';
import GalleryPage     from './pages/GalleryPage';
import MarqueePage     from './pages/MarqueePage';
import ThemePage       from './pages/ThemePage';
import FeatureControlPage from './pages/FeatureControlPage';
import SubFeatureControlPage from './pages/SubFeatureControlPage';
import './index.css';

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
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
        <Route path="/gallery"      element={<GalleryPage />} />
        <Route path="/gallery/:folderId" element={<GalleryPage />} />
        <Route path="/marquee"      element={<MarqueePage />} />
        <Route path="/theme"        element={<ThemePage />} />
        <Route path="/feature-control" element={<FeatureControlPage />} />
        <Route path="/sub-feature-control" element={<SubFeatureControlPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
