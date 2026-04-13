import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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

const ProtectedRoute = ({ children }) => {
  const isLoggedIn = sessionStorage.getItem('fm_logged_in') === 'true';
  return isLoggedIn ? children : <Navigate to="/" replace />;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
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
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
