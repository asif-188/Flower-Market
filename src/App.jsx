import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { TenantProvider, useTenant } from './utils/TenantContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Farmer from './pages/Farmer';
import Intake from './pages/Intake';
import SalesMenu from './pages/SalesMenu';
import SalesEntry from './pages/SalesEntry';
import DirectSales from './pages/DirectSales';
import Accounts from './pages/Accounts';
import Payments from './pages/Payments';
import Buyer from './pages/Buyer';
import Reports from './pages/Reports';
import DailyReport from './pages/DailyReport';
import Flowers from './pages/Flowers';
import Settings from './pages/Settings';
import OutsideShop from './pages/OutsideShop';
import AdminPanel from './pages/AdminPanel';
// ── Power Buy Module ──
import PowerBuyMenu from './pages/powerbuy/PowerBuyMenu';
import PbBuyer from './pages/powerbuy/PbBuyer';
import PbPayments from './pages/powerbuy/PbPayments';
import PbSalesEntry from './pages/powerbuy/PbSalesEntry';
import PbReports from './pages/powerbuy/PbReports';
import PbFlowers from './pages/powerbuy/PbFlowers';
import PbDailyReport from './pages/powerbuy/PbDailyReport';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useTenant();
  
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
  return user ? children : <Navigate to="/" replace />;
};

function App() {
  return (
    <TenantProvider>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </TenantProvider>
  );
}

const AppRoutes = () => {
  const { user } = useTenant();
  
  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to="/app" replace /> : <Login />} />
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
          <Route index element={<Navigate to="/app/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="intake" element={<Intake />} />
          <Route path="sales" element={<SalesMenu />} />
          <Route path="sales-entry" element={<SalesEntry />} />
          <Route path="direct-sales" element={<DirectSales />} />
          <Route path="payments" element={<Payments />} />
          <Route path="farmer" element={<Farmer />} />
          <Route path="buyer" element={<Buyer />} />
          <Route path="accounts" element={<Accounts />} />
          <Route path="reports" element={<Reports />} />
          <Route path="daily-report" element={<DailyReport />} />
          <Route path="flowers" element={<Flowers />} />
          <Route path="settings" element={<Settings />} />
          <Route path="outside-shop" element={<OutsideShop />} />
          {/* ── Power Buy Module ── */}
          <Route path="power-buy" element={<PowerBuyMenu />} />
          <Route path="pb-buyer" element={<PbBuyer />} />
          <Route path="pb-payments" element={<PbPayments />} />
          <Route path="pb-sales" element={<PbSalesEntry />} />
          <Route path="pb-reports" element={<PbReports />} />
          <Route path="pb-flowers" element={<PbFlowers />} />
          <Route path="pb-daily-report" element={<PbDailyReport />} />
      </Route>
      <Route path="/admin" element={<AdminPanel />} />
    </Routes>
  );
}

export default App;
