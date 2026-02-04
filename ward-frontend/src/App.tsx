import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { config } from './wagmi';
import Dashboard from './components/Dashboard';
import PocketDetail from './components/PocketDetail';
import ExecuteWizard from './components/ExecuteWizard';
import '@rainbow-me/rainbowkit/styles.css';

const queryClient = new QueryClient();

function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/pocket/:address" element={<PocketDetail />} />
              <Route path="/pocket/:address/execute" element={<ExecuteWizard />} />
            </Routes>
          </BrowserRouter>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default App;

