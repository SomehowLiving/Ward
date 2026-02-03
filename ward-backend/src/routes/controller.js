import express from "express";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";

import { controller, factory } from "../config/chain.js";
const PocketABI = JSON.parse(
  fs.readFileSync(
    path.resolve("src/abi/Pocket.json"),
    "utf8"
  )
);
import { decodeEthersError } from "../utils/errors.js";
import { requireAddress } from "../utils/validate.js";

const router = express.Router();

/* -------------------------------------------------------------------------- */
/* Controller read APIs                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Get controller view of a pocket
 * GET /api/controller/pocket/:address
 *
 * Returns:
 * - valid: whether controller recognizes the pocket
 * - owner: recorded owner (receiver for sweep)
 */
router.get("/pocket/:address", async (req, res) => {
  try {
    const { address } = req.params;
    requireAddress(address, "pocket");

    const [valid, owner] = await Promise.all([
      controller.validPocket(address),
      controller.pocketOwner(address)
    ]);

    res.json({
      address,
      valid,
      owner
    });
  } catch (err) {
    res.status(500).json({
      error: decodeEthersError(err, controller.interface)
    });
  }
});

/* -------------------------------------------------------------------------- */
/* Pocket discovery (from factory events)                                      */
/* -------------------------------------------------------------------------- */

/**
 * List pockets created for a user
 * GET /api/controller/pockets/:userAddress
 *
 * Source of truth: PocketFactory events
 */
router.get("/pockets/:userAddress", async (req, res) => {
  try {
    const { userAddress } = req.params;
    requireAddress(userAddress, "user");

    const filter = factory.filters.PocketDeployed(null, userAddress);
    const events = await factory.queryFilter(filter, 0, "latest");

    const pockets = await Promise.all(
      events.map(async (e) => {
        const pocketAddress = e.args.pocket;

        const pocket = new ethers.Contract(
          pocketAddress,
          PocketABI,
          controller.runner.provider
        );

        const used = await pocket.used();

        return {
          address: pocketAddress,
          used,
          createdAt: e.blockNumber // replace with timestamp if indexed
        };
      })
    );

    res.json({ pockets });
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

export default router;
