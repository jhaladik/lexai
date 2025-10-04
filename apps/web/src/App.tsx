import { Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Dashboard } from '@/pages/Dashboard';
import { Clients } from '@/pages/Clients';
import { Debts } from '@/pages/Debts';
import { Debtors } from '@/pages/Debtors';
import { AttorneyReview } from '@/pages/AttorneyReview';
import { DebtorPortal } from '@/pages/DebtorPortal';
import { Login } from '@/pages/Login';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/portal/:token" element={<DebtorPortal />} />
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="clients" element={<Clients />} />
        <Route path="debts" element={<Debts />} />
        <Route path="debtors" element={<Debtors />} />
        <Route path="attorney/review" element={<AttorneyReview />} />
        {/* More routes will be added here */}
      </Route>
    </Routes>
  );
}

export default App;
