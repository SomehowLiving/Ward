import express from "express";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";


import { controller, provider } from "../config/chain.js";
// import PocketABI from "../abi/Pocket.json" assert { type: "json" };
const PocketArtifact = JSON.parse(
  fs.readFileSync(
    path.resolve("src/abi/Pocket.json"),
    "utf8"
  )
);
const PocketABI = PocketArtifact.abi;
const PocketBytecode = PocketArtifact?.bytecode?.object;

import { decodeEthersError } from "../utils/errors.js";
import { requireAddress, ValidationError } from "../utils/validate.js";
import { fetchRiskTier } from "../utils/risk.js";
import { pocketRegistry } from "../utils/pocketRegistry.js";

const router = express.Router();

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function getPocket(address) {
    return new ethers.Contract(address, PocketABI, provider);
}

async function computePocketAddress(user, salt) {
    if (!PocketBytecode) {
        throw new Error("Pocket bytecode unavailable");
    }
    const factoryAddress = await controller.factory();
    const controllerAddress = await controller.getAddress();
    const createSalt = ethers.solidityPackedKeccak256(
        ["address", "uint256"],
        [user, salt]
    );
    const constructorArgs = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "address"],
        [controllerAddress, user]
    );
    const initCodeHash = ethers.keccak256(
        ethers.concat([PocketBytecode, constructorArgs])
    );
    return ethers.getCreate2Address(factoryAddress, createSalt, initCodeHash);
}

async function simulateExec(args) {
    try {
        await controller.executeFromPocket.staticCall(
            args.pocket,
            args.target,
            args.data,
            args.nonce,
            args.expiry,
            args.signature
        );
        return null;
    } catch (err) {
        return decodeEthersError(err, controller.interface);
    }
}

function isValidationError(err) {
    return err instanceof ValidationError || err?.name === "ValidationError";
}

const ERC20_MIN_ABI = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function balanceOf(address) view returns (uint256)"
];

/* -------------------------------------------------------------------------- */
/* Routes                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Create Pocket
 * POST /api/pocket/create
 */
router.post("/create", async (req, res) => {
    try {
        const { user, salt } = req.body;
        requireAddress(user, "user");
        if (salt === undefined || salt === null) {
            return res.status(400).json({
                error: { type: "VALIDATION", message: "Missing salt" }
            });
        }
        const normalizedSalt = BigInt(salt);
        const pocket = await computePocketAddress(user, normalizedSalt);

        const tx = await controller.createPocket(user, normalizedSalt);
        await tx.wait();

        const isValid = await controller.validPocket(pocket);
        if (!isValid) {
            throw new Error("Pocket creation transaction succeeded but controller did not mark pocket valid");
        }

        pocketRegistry.addPocket(user, pocket);
        res.json({ pocket });
    } catch (err) {
        console.error("[POST /api/pocket/create] failed", {
            user: req.body?.user,
            salt: req.body?.salt,
            error: err?.message,
            stack: err?.stack
        });
        const status = isValidationError(err) ? 400 : 500;
        res.status(status).json({
            error: decodeEthersError(err, controller.interface)
        });
    }
});

/**
 * Get pocket state
 * GET /api/pocket/:address
 */
router.get("/:address", async (req, res) => {
    try {
        const { address } = req.params;
        requireAddress(address, "pocket");
        const code = await provider.getCode(address);
        if (code === "0x") {
            return res.status(404).json({
                error: { type: "NOT_FOUND", message: "Pocket contract not found" }
            });
        }

        const pocket = getPocket(address);

        const [used, burned, owner] = await Promise.all([
            pocket.used(),
            pocket.burned(),
            pocket.owner()
        ]);

        res.json({ address, owner, used, burned });
    } catch (err) {
        const status = isValidationError(err) ? 400 : 500;
        res.status(status).json({
            error: decodeEthersError(err, controller.interface)
        });
    }
});

/**
 * Asset indexer for a pocket
 * GET /api/pocket/:address/assets
 *
 * Scans ERC20 Transfer logs to/from the pocket and returns current balances
 * with token metadata for all discovered token contracts.
 */
router.get("/:address/assets", async (req, res) => {
    try {
        const { address } = req.params;
        requireAddress(address, "pocket");

        const code = await provider.getCode(address);
        if (code === "0x") {
            return res.status(404).json({
                error: { type: "NOT_FOUND", message: "Pocket contract not found" }
            });
        }

        const normalizedPocket = ethers.getAddress(address);
        const pocketTopic = ethers.zeroPadValue(normalizedPocket, 32);
        const transferTopic = ethers.id("Transfer(address,address,uint256)");
        const fromBlock = Number(process.env.ASSET_INDEXER_FROM_BLOCK ?? 0);
        const toBlock = "latest";

        const [incomingLogs, outgoingLogs, nativeBalance] = await Promise.all([
            provider.getLogs({
                fromBlock,
                toBlock,
                topics: [transferTopic, null, pocketTopic]
            }),
            provider.getLogs({
                fromBlock,
                toBlock,
                topics: [transferTopic, pocketTopic, null]
            }),
            provider.getBalance(normalizedPocket)
        ]);

        const tokenAddresses = new Set();
        for (const log of incomingLogs) tokenAddresses.add(ethers.getAddress(log.address));
        for (const log of outgoingLogs) tokenAddresses.add(ethers.getAddress(log.address));

        const assets = [];
        for (const tokenAddress of tokenAddresses) {
            try {
                const token = new ethers.Contract(tokenAddress, ERC20_MIN_ABI, provider);

                const [name, symbol, decimals, balanceRaw] = await Promise.all([
                    token.name().catch(() => "Unknown Token"),
                    token.symbol().catch(() => "UNKNOWN"),
                    token.decimals().catch(() => 18),
                    token.balanceOf(normalizedPocket)
                ]);

                if (balanceRaw === 0n) continue;

                assets.push({
                    address: tokenAddress,
                    name,
                    symbol,
                    decimals: Number(decimals),
                    balance: balanceRaw.toString(),
                    formattedBalance: ethers.formatUnits(balanceRaw, Number(decimals))
                });
            } catch {
                // Ignore contracts that don't behave like ERC20s.
            }
        }

        res.json({
            pocket: normalizedPocket,
            nativeBalance: nativeBalance.toString(),
            formattedNativeBalance: ethers.formatEther(nativeBalance),
            assets
        });
    } catch (err) {
        const status = isValidationError(err) ? 400 : 500;
        res.status(status).json({
            error: err?.message || "Failed to index pocket assets"
        });
    }
});

/**
 * Execute from pocket
 * POST /api/pocket/exec
 */
router.post("/exec", async (req, res) => {
    const { pocket, target, data, nonce, expiry, signature } = req.body;

    try {
        requireAddress(pocket, "pocket");
        requireAddress(target, "target");

        const simError = await simulateExec({
            pocket,
            target,
            data,
            nonce,
            expiry,
            signature
        });

        if (simError) {
            return res.status(400).json({ error: simError });
        }

        const tx = await controller.executeFromPocket(
            pocket,
            target,
            data,
            nonce,
            expiry,
            signature
        );

        const receipt = await tx.wait();

        res.json({
            status: "executed",
            txHash: receipt.hash,
            gasUsed: receipt.gasUsed.toString()
        });
    } catch (err) {
        res.status(500).json({
            error: decodeEthersError(err, controller.interface)
        });
    }
});

/**
 * Burn pocket
 * POST /api/pocket/burn
 */
router.post("/burn", async (req, res) => {
    const { pocket, nonce, expiry, signature } = req.body;

    try {
        requireAddress(pocket, "pocket");

        try {
            await controller.burnPocket.staticCall(
                pocket,
                nonce,
                expiry,
                signature
            );
        } catch (err) {
            return res.status(400).json({
                error: decodeEthersError(err, controller.interface)
            });
        }

        const tx = await controller.burnPocket(
            pocket,
            nonce,
            expiry,
            signature
        );

        const receipt = await tx.wait();
        res.json({ status: "burned", txHash: receipt.hash });
    } catch (err) {
        res.status(500).json({
            error: decodeEthersError(err, controller.interface)
        });
    }
});

/**
 * Sweep tokens
 * POST /api/pocket/sweep
 */
router.post("/sweep", async (req, res) => {
    try {
        const { pocketAddress, tokenAddress, receiverAddress, amount } = req.body;

        requireAddress(pocketAddress, "pocket");
        requireAddress(tokenAddress, "token");
        requireAddress(receiverAddress, "receiver");

        const { tier } = await fetchRiskTier(tokenAddress);

        const tx = await controller.sweep(
            pocketAddress,
            tokenAddress,
            receiverAddress,
            amount,
            tier
        );

        const receipt = await tx.wait();
        res.json({ txHash: receipt.hash });
    } catch (err) {
        res.status(400).json({
            error: decodeEthersError(err, controller.interface)
        });
    }
});

/**
 * Simulate execution (UX helper)
 * POST /api/pocket/simulate
 */
router.post("/simulate", async (req, res) => {
    try {
        const { pocket, target, data, nonce, expiry, signature } = req.body;

        requireAddress(pocket, "pocket");
        requireAddress(target, "target");

        const valid = await controller.validPocket(pocket);
        if (!valid) {
            return res.status(400).json({ error: "Invalid pocket" });
        }

        await controller.executeFromPocket.staticCall(
            pocket,
            target,
            data,
            nonce,
            expiry,
            signature
        );

        res.json({ ok: true });
    } catch (err) {
        res.json({
            ok: false,
            error: decodeEthersError(err, controller.interface)
        });
    }
});

/**
 * Calculate fee (no tx)
 * POST /api/pocket/fee
 */
router.post("/fee", async (req, res) => {
    try {
        const { amount, tokenAddress } = req.body;

        if (!amount || !ethers.isAddress(tokenAddress)) {
            return res.status(400).json({ error: "Invalid input" });
        }

        const { tier } = await fetchRiskTier(tokenAddress);
        const feeBps = await controller.feeBps(tier);

        const fee = (BigInt(amount) * BigInt(feeBps)) / 10_000n;

        res.json({
            amount,
            tier,
            fee: fee.toString(),
            net: (BigInt(amount) - fee).toString()
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

/**
 * Gas estimation
 * POST /api/pocket/gas
 */
router.post("/gas", async (req, res) => {
    try {
        const { pocket, target, data, nonce, expiry, signature } = req.body;

        requireAddress(pocket, "pocket");
        requireAddress(target, "target");

        const valid = await controller.validPocket(pocket);
        if (!valid) {
            return res.status(400).json({ error: "Invalid pocket" });
        }

        const gas = await controller.executeFromPocket.estimateGas(
            pocket,
            target,
            data,
            nonce,
            expiry,
            signature
        );

        res.json({ gas: gas.toString() });
    } catch (err) {
        res.json({
            error: decodeEthersError(err, controller.interface)
        });
    }
});

/** Relay execution from pocket
 * POST /api/relay/pocket-exec
 */
router.post("/api/relay/pocket-exec", async (req, res) => {
  try {
    const { pocket, target, data, nonce, expiry, signature } = req.body;
    const valid = await controller.validPocket(pocket);
if (!valid) {
  return res.status(400).json({ error: "Invalid pocket" });
}

    const tx = await controller.executeFromPocket(
      pocket,
      target,
      data,
      nonce,
      expiry,
      signature
    );

    const receipt = await tx.wait();
    res.json({ txHash: receipt.hash });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
