import express from "express";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";

import { provider } from "../config/chain.js";

const PocketABI = JSON.parse(
  fs.readFileSync(
    path.resolve("src/abi/Pocket.json"),
    "utf8"
  )
);
import { requireAddress } from "../utils/validate.js";

const router = express.Router();

/* -------------------------------------------------------------------------- */
/* Verify EIP-712 execution intent                                             */
/* -------------------------------------------------------------------------- */

/**
 * Verify execution intent
 * POST /api/verify/exec-intent
 *
 * Verifies:
 * - signature correctness
 * - signer is pocket owner
 * - signature not expired
 *
 * Does NOT:
 * - check nonce usage
 * - check used/burned state
 * - execute anything
 *
 * On-chain enforcement remains authoritative.
 */
router.post("/exec-intent", async (req, res) => {
  try {
    const {
      pocket,
      target,
      dataHash,
      nonce,
      expiry,
      signature
    } = req.body;

    requireAddress(pocket, "pocket");
    requireAddress(target, "target");

    // Rebuild EIP-712 domain exactly as Pocket does
    const domain = {
      name: "Ward Pocket",
      version: "1",
      chainId: Number(process.env.CHAIN_ID),
      verifyingContract: pocket
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

    const digest = ethers.TypedDataEncoder.hash(
      domain,
      types,
      { pocket, target, dataHash, nonce, expiry }
    );

    const recovered = ethers.recoverAddress(digest, signature);

    const pocketContract = new ethers.Contract(
      pocket,
      PocketABI,
      provider
    );

    const owner = await pocketContract.owner();

    if (recovered.toLowerCase() !== owner.toLowerCase()) {
      return res.json({
        valid: false,
        reason: "Invalid signer"
      });
    }

    if (expiry < Math.floor(Date.now() / 1000)) {
      return res.json({
        valid: false,
        reason: "Signature expired"
      });
    }

    res.json({ valid: true });
  } catch (err) {
    res.status(500).json({
      valid: false,
      reason: err.message
    });
  }
});

export default router;
