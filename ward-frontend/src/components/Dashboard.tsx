import { useEffect, useState } from 'react';
import { useAccount, useDisconnect, useChainId } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { ethers } from 'ethers';
import { useNavigate } from 'react-router-dom';
import { listUserPockets, createPocket, Pocket } from '../api';

declare global {
  interface Window {
    ethereum?: any;
  }
}

export default function Dashboard() {
  const { isConnected, address } = useAccount();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const navigate = useNavigate();
  const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null);
  const [pockets, setPockets] = useState<Pocket[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isConnected && address) {
      initSigner();
      fetchPockets();
    }
  }, [isConnected, address]);

  const initSigner = async () => {
    if (window.ethereum) {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const s = await provider.getSigner();
      setSigner(s);
    }
  };

  const fetchPockets = async () => {
    if (!address) return;
    try {
      const { pockets: list } = await listUserPockets(address);
      setPockets(list || []);
    } catch (err) {
      console.error('Failed to fetch pockets:', err);
    }
  };

  const handleCreatePocket = async () => {
    if (!address || !signer) return;
    setLoading(true);
    setError(null);
    try {
      const { pocket } = await createPocket({ user: address, salt: Date.now().toString() });
      navigate(`/pocket/${pocket}`);
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  if (!isConnected) {
    return (
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '2rem', textAlign: 'center' }}>
        <h1 style={{ marginBottom: '2rem' }}>Ward</h1>
        <p style={{ marginBottom: '2rem', color: '#666' }}>
          Transaction protection using single-use execution vaults
        </p>
        <ConnectButton />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>Ward</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '0.9rem', color: '#666' }}>
            {address?.slice(0, 6)}...{address?.slice(-4)}
          </span>
          <button onClick={() => disconnect()}>Disconnect</button>
        </div>
      </header>

      <section style={{ marginBottom: '2rem' }}>
        <button 
          onClick={handleCreatePocket} 
          disabled={loading || !signer}
          style={{ padding: '0.75rem 1.5rem', fontSize: '1rem' }}
        >
          {loading ? 'Creating...' : 'Create Pocket'}
        </button>
        {error && <p style={{ color: 'red', marginTop: '0.5rem' }}>{error}</p>}
      </section>

      <section>
  <h2 style={{ marginBottom: '1rem' }}>Your Pockets</h2>
  {pockets.length === 0 ? (
    <p style={{ color: '#666' }}>No pockets yet. Create one to get started.</p>
  ) : (
    <ul style={{ listStyle: 'none', padding: 0 }}>
      {pockets.map((pocket) => (
        <li
          key={pocket.address}
          style={{
            border: '1px solid #ddd',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '0.75rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <code style={{ fontSize: '0.9rem' }}>{pocket.address}</code>
            <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.25rem' }}>
              Status:{' '}
              {pocket.burned
                ? '⚫ Burned'
                : pocket.used
                ? '🟠 Used'
                : '🟢 Active'}
            </div>
          </div>

          <button
            onClick={() => navigate(`/pocket/${pocket.address}`)}
            disabled={pocket.burned}
          >
            {pocket.burned ? 'Burned' : 'Open'}
          </button>
        </li>
      ))}
    </ul>
  )}
</section>

    </div>
  );
}

