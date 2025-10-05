import { Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Dashboard } from '@/pages/Dashboard';
import { Clients } from '@/pages/Clients';
import { Debts } from '@/pages/Debts';
import { Debtors } from '@/pages/Debtors';
import { Communications } from '@/pages/Communications';
import { Disputes } from '@/pages/Disputes';
import { AttorneyReview } from '@/pages/AttorneyReview';
import { AttorneyReviewDetail } from '@/pages/AttorneyReviewDetail';
import { PaymentPlans } from '@/pages/PaymentPlans';
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
        <Route path="communications" element={<Communications />} />
        <Route path="disputes" element={<Disputes />} />
        <Route path="payment-plans" element={<PaymentPlans />} />
        <Route path="attorney/review" element={<AttorneyReview />} />
        <Route path="attorney/review/:debtorId/:clientId" element={<AttorneyReviewDetail />} />
        {/* More routes will be added here */}
      </Route>
    </Routes>
  );
}

export default App;
