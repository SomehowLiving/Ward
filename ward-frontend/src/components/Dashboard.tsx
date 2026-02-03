import { useAccount, useDisconnect } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useState } from 'react';
import ClaimCard from './ClaimCard';
import PocketDashboard from './PocketDashboard';
import { ethers } from 'ethers';

declare global {
  interface Window {
    ethereum?: any;
  }
}

export default function Dashboard() {
  const { isConnected, address } = useAccount();
  const { disconnect } = useDisconnect();
  const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null);

  const initSigner = async () => {
    if (window.ethereum) {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      setSigner(signer);
    }
  };

  if (!isConnected) {
    return (
      <div className="container">
        <h1>WalletGuard Dashboard</h1>
        <ConnectButton />
      </div>
    );
  }

  if (!signer) {
    initSigner();
    return <div>Initializing...</div>;
  }

  return (
    <div className="container">
      <h1>WalletGuard Dashboard</h1>
      <p>Connected: {address?.slice(0, 6)}...{address?.slice(-4)}</p>
      <button onClick={() => disconnect()}>Disconnect</button>
      
      <h2>1. Claim Airdrop</h2>
      <ClaimCard wallet={address!} signer={signer} />
      
      <h2>2. Your Pockets</h2>
      <PocketDashboard wallet={address!} signer={signer} />
    </div>
  );
}