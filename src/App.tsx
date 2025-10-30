import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ToastProvider } from './components/ToastContainer';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import CheckIn from './pages/CheckIn';
import Coach from './pages/Coach';
import History from './pages/History';
import Settings from './pages/Settings';
import { AuthGate } from './components/AuthGate';
import { supabaseConfigError } from './lib/supabaseClient';
import { ConfigurationError } from './components/ConfigurationError';

function App() {
  if (supabaseConfigError) {
    return <ConfigurationError message={supabaseConfigError} />;
  }

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <ToastProvider>
        <AuthGate>
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/check-in" element={<CheckIn />} />
              <Route path="/coach" element={<Coach />} />
              <Route path="/history" element={<History />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </Layout>
        </AuthGate>
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;
