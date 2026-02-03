import { useState } from 'react';
import { ethers } from 'ethers';

interface Props {
  wallet: string;
  signer: ethers.JsonRpcSigner;
}

export default function ClaimCard({ wallet, signer }: Props) {
  const [tokenAddress, setTokenAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const claimAirdrop = async () => {
    setLoading(true);
    try {
      // Step 1: Create pocket
      const createRes = await fetch('http://localhost:3001/api/pocket/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAddress: wallet })
      });
      const { pocketAddress, salt } = await createRes.json();

      // Step 2: Sign EIP-712 message with user's wallet
      const nonce = 1;
      const expiry = Math.floor(Date.now() / 1000) + 3600;
      const functionSelector = '0x4e71d92d';
      const dataHash = ethers.keccak256(functionSelector);

      const domain = {
        name: "Ward Pocket",
        version: "1",
        chainId: 11155111,
        verifyingContract: pocketAddress,
      };

      const types = {
        Exec: [
          { name: "pocket", type: "address" },
          { name: "target", type: "address" },
          { name: "dataHash", type: "bytes32" },
          { name: "nonce", type: "uint256" },
          { name: "expiry", type: "uint256" }
        ]
      };

      const signature = await signer.signTypedData(
        domain,
        types,
        { pocket: pocketAddress, target: tokenAddress, dataHash, nonce, expiry }
      );

      // Step 3: Risk classification
      const riskRes = await fetch('http://localhost:3001/api/risk/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenAddress })
      });
      const riskData = await riskRes.json();

      // Step 4: Execute from pocket via controller
      const controller = new ethers.Contract(
        process.env.NEXT_PUBLIC_CONTROLLER_ADDRESS!,
        ["function executeFromPocket(address,address,bytes,uint256,uint256,bytes) external"],
        signer
      );

      const tx = await controller.executeFromPocket(
        pocketAddress,
        tokenAddress,
        functionSelector,
        nonce,
        expiry,
        signature,
        { gasLimit: 100000 }
      );
      await tx.wait();

      setResult({
        success: true,
        pocketAddress,
        txHash: tx.hash,
        tier: riskData.tier,
        confidence: riskData.confidence
      });
    } catch (error) {
      setResult({ success: false, error: error.message });
    }
    setLoading(false);
  };

  return (
    <div className="card">
      <h3>Claim Airdrop</h3>
      <input 
        type="text" 
        placeholder="Token Address (0x...)" 
        value={tokenAddress}
        onChange={(e) => setTokenAddress(e.target.value)}
        style={{ width: '100%', padding: '8px', margin: '10px 0' }}
      />
      <button onClick={claimAirdrop} disabled={loading}>
        {loading ? 'Processing...' : 'Claim'}
      </button>
      {result && (
        <div className="result" style={{ marginTop: '10px' }}>
          {result.success ? (
            <>
              <p>✅ Claimed to pocket: <code>{result.pocketAddress}</code></p>
              <p>Tier: {result.tier} (Confidence: {result.confidence})</p>
              <p>TX: <a href={`https://sepolia.etherscan.io/tx/${result.txHash}`} target="_blank">{result.txHash.slice(0, 10)}...</a></p>
            </>
          ) : (
            <p>❌ Error: {result.error}</p>
          )}
        </div>
      )}
    </div>
  );
}