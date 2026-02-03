import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

interface Props {
  wallet: string;
  signer: ethers.JsonRpcSigner;
}

export default function PocketDashboard({ wallet, signer }: Props) {
  const [pockets, setPockets] = useState<any[]>([]);

  const fetchPockets = async () => {
    // In a real app, you'd query events from the Factory
    // For now, manually track pockets in localStorage or backend
  };

  useEffect(() => {
    fetchPockets();
  }, [wallet]);

  const burnPocket = async (pocketAddress: string) => {
    const nonce = 2; // Must be unused
    const expiry = Math.floor(Date.now() / 1000) + 3600;

    // Sign burn message
    const domain = {
      name: "Ward Pocket",
      version: "1",
      chainId: 11155111,
      verifyingContract: pocketAddress,
    };

    const types = {
      Burn: [
        { name: "pocket", type: "address" },
        { name: "nonce", type: "uint256" },
        { name: "expiry", type: "uint256" }
      ]
    };

    const signature = await signer.signTypedData(
      domain,
      types,
      { pocket: pocketAddress, nonce, expiry }
    );

    // Execute burn
    const controller = new ethers.Contract(
      process.env.NEXT_PUBLIC_CONTROLLER_ADDRESS!,
      ["function burnPocket(address,uint256,uint256,bytes) external"],
      signer
    );

    const tx = await controller.burnPocket(pocketAddress, nonce, expiry, signature);
    await tx.wait();
    
    alert(`Pocket ${pocketAddress} burned!`);
  };

  return (
    <div>
      <p>Your Pockets: {pockets.length}</p>
      {/* Render pocket list with burn buttons */}
    </div>
  );
}