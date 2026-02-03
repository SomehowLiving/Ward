import express from "express";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";


import { controller, factory, provider } from "../config/chain.js";
// import PocketABI from "../abi/Pocket.json" assert { type: "json" };
const PocketABI = JSON.parse(
  fs.readFileSync(
    path.resolve("src/abi/Pocket.json"),
    "utf8"
  )
);

import { decodeEthersError } from "../utils/errors.js";
import { requireAddress } from "../utils/validate.js";
import { fetchRiskTier } from "../utils/risk.js";

const router = express.Router();

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function getPocket(address) {
    return new ethers.Contract(address, PocketABI, provider);
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

        const tx = await controller.createPocket(user, salt);
        const receipt = await tx.wait();

        const event = receipt.logs.find(
            l =>
                l.topics[0] ===
                factory.interface.getEvent("PocketDeployed").topicHash
        );

        if (!event) {
            return res.status(500).json({ error: "PocketDeployed event not found" });
        }

        const { pocket } = factory.interface.parseLog(event).args;
        res.json({ pocket });
    } catch (err) {
        res.status(500).json({
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

        const pocket = getPocket(address);

        const [used, burned, owner] = await Promise.all([
            pocket.used(),
            pocket.burned(),
            pocket.owner()
        ]);

        res.json({ address, owner, used, burned });
    } catch (err) {
        res.status(500).json({
            error: decodeEthersError(err, controller.interface)
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
