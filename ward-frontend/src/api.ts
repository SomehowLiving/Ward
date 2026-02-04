import { ethers } from 'ethers';
import { API } from "./routes";

// const BASE_URL = 'http://localhost:3001';

// Types
export interface Pocket {
    address: string;
    owner?: string;
    used: boolean;
    burned: boolean;
    createdAt?: number;
}

export interface CreatePocketParams {
    user: string;
    salt?: string;
}

export interface ExecuteParams {
    pocket: string;
    target: string;
    data: string;
    nonce: number;
    expiry: number;
    signature: string;
}

export interface BurnParams {
    pocket: string;
    nonce: number;
    expiry: number;
    signature: string;
}

export interface SweepParams {
    pocketAddress: string;
    tokenAddress: string;
    receiverAddress: string;
    amount: string;
}

export interface RiskTier {
    tier: number;
    confidence: number;
    signals: string[];
    message: string;
}

export interface TokenMetadata {
    address: string;
    name: string;
    symbol: string;
    decimals: number;
    totalSupply: string;
}

export interface CalldataDecode {
    function: string;
    args: string[];
    confidence: string;
}

// API Functions
export async function createPocket(params: CreatePocketParams): Promise<{ pocket: string }> {
    const res = await fetch(API.pocket.create, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error('Failed to create pocket');
    return res.json();
}

export async function getPocket(address: string): Promise<Pocket> {
    const res = await fetch(API.pocket.get(address));
    if (!res.ok) throw new Error('Failed to get pocket');
    return res.json();
}

export async function listUserPockets(userAddress: string): Promise<{ pockets: Pocket[] }> {
    const res = await fetch(API.pocket.listByUser(userAddress));
    if (!res.ok) throw new Error('Failed to list pockets');
    return res.json();
}

export async function getControllerPocket(address: string): Promise<{ address: string; valid: boolean; owner: string }> {
    const res = await fetch(API.controller.pocketInfo(address));
    if (!res.ok) throw new Error('Failed to get controller pocket');
    return res.json();
}

export async function executePocket(params: ExecuteParams): Promise<{ status: string; txHash: string; gasUsed: string }> {
    const res = await fetch(API.pocket.exec, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || 'Execution failed');
    }
    return res.json();
}

export async function burnPocket(params: BurnParams): Promise<{ status: string; txHash: string }> {
    const res = await fetch(API.pocket.burn, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || 'Burn failed');
    }
    return res.json();
}

export async function sweepPocket(params: SweepParams): Promise<{ txHash: string }> {
    const res = await fetch(API.pocket.sweep, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || 'Sweep failed');
    }
    return res.json();
}

export async function simulateExecution(params: ExecuteParams): Promise<{ ok: boolean; error?: any }> {
    const res = await fetch(API.pocket.simulate, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
    });
    return res.json();
}

export async function estimateGas(params: ExecuteParams): Promise<{ gas: string }> {
    const res = await fetch(API.pocket.gas, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error('Gas estimation failed');
    return res.json();
}

export async function calculateFee(amount: string, tokenAddress: string): Promise<{ amount: string; tier: number; fee: string; net: string }> {
    const res = await fetch(API.pocket.fee, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, tokenAddress }),
    });
    if (!res.ok) throw new Error('Fee calculation failed');
    return res.json();
}

export async function verifyExecIntent(params: {
    pocket: string;
    target: string;
    dataHash: string;
    nonce: number;
    expiry: number;
    signature: string;
}): Promise<{ valid: boolean; reason?: string }> {
    const res = await fetch(API.verify.execIntent, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
    });
    return res.json();
}

export async function classifyRisk(tokenAddress: string, simulate?: boolean): Promise<RiskTier> {
    const res = await fetch(API.risk.classify, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenAddress, simulate }),
    });
    if (!res.ok) throw new Error('Risk classification failed');
    return res.json();
}

export async function simulateRisk(pocketAddress: string, target: string, data: string): Promise<{ success: boolean; gasUsed: number; error?: string }> {
    const res = await fetch(API.risk.simulate, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pocketAddress, target, data }),
    });
    return res.json();
}

export async function getTokenMetadata(address: string): Promise<TokenMetadata> {
    const res = await fetch(API.token.info(address));
    if (!res.ok) throw new Error('Failed to get token metadata');
    return res.json();
}

export async function decodeCalldata(data: string): Promise<CalldataDecode> {
    const res = await fetch(API.pocket.decodeCalldata, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
    });
    if (!res.ok) throw new Error('Failed to decode calldata');
    return res.json();
}

// EIP-712 Helpers
export function getExecTypedData(
    pocket: string,
    target: string,
    dataHash: string,
    nonce: number,
    expiry: number,
    chainId: number
) {
    return {
        domain: {
            name: 'Ward Pocket',
            version: '1',
            chainId,
            verifyingContract: pocket,
        },
        types: {
            Exec: [
                { name: 'pocket', type: 'address' },
                { name: 'target', type: 'address' },
                { name: 'dataHash', type: 'bytes32' },
                { name: 'nonce', type: 'uint256' },
                { name: 'expiry', type: 'uint256' },
            ],
        },
        value: { pocket, target, dataHash, nonce, expiry },
    };
}

export function getBurnTypedData(
    pocket: string,
    nonce: number,
    expiry: number,
    chainId: number
) {
    return {
        domain: {
            name: 'Ward Pocket',
            version: '1',
            chainId,
            verifyingContract: pocket,
        },
        types: {
            Burn: [
                { name: 'pocket', type: 'address' },
                { name: 'nonce', type: 'uint256' },
                { name: 'expiry', type: 'uint256' },
            ],
        },
        value: { pocket, nonce, expiry },
    };
}

export async function signExecIntent(
    signer: ethers.JsonRpcSigner,
    pocket: string,
    target: string,
    data: string,
    nonce: number,
    expiry: number,
    chainId: number
): Promise<string> {
    const dataHash = ethers.keccak256(data);
    const typedData = getExecTypedData(pocket, target, dataHash, nonce, expiry, chainId);
    return signer.signTypedData(typedData.domain, typedData.types, typedData.value);
}

export async function signBurnIntent(
    signer: ethers.JsonRpcSigner,
    pocket: string,
    nonce: number,
    expiry: number,
    chainId: number
): Promise<string> {
    const typedData = getBurnTypedData(pocket, nonce, expiry, chainId);
    return signer.signTypedData(typedData.domain, typedData.types, typedData.value);
}

// Calldata generation
export function encodeApprove(spender: string, amount: string): string {
    const iface = new ethers.Interface([
        'function approve(address spender, uint256 amount) external',
    ]);
    return iface.encodeFunctionData('approve', [spender, amount]);
}

export function encodeTransfer(recipient: string, amount: string): string {
    const iface = new ethers.Interface([
        'function transfer(address recipient, uint256 amount) external',
    ]);
    return iface.encodeFunctionData('transfer', [recipient, amount]);
}

