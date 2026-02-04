import express from "express";
import dotenv from "dotenv";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";

import pocketRoutes from "./routes/pocket.js";
import controllerRoutes from "./routes/controller.js";
import verifyRoutes from "./routes/verify.js";
import riskRoutes from "./routes/risk.js";
import tokenRoutes from "./routes/token.js";
import metaRoutes from "./routes/meta.js";
import { requireAddress } from "./utils/validate.js";
import { factory, provider } from "./config/chain.js";

dotenv.config();

const app = express();
import cors from "cors";

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://127.0.0.1:5173"
    ],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"]
  })
);

app.use(express.json());

// app.use(express.json());

// /* -------------------------------------------------------------------------- */
// /* Calldata decoding helper                                                   */
// /* -------------------------------------------------------------------------- */

// /**
//  * Decode calldata for ERC20 operations
//  * POST /api/calldata/decode
//  */
// app.post("/api/calldata/decode", (req, res) => {
//   try {
//     const { data } = req.body;

//     if (!data || !data.startsWith("0x")) {
//       return res.status(400).json({ error: "Invalid calldata" });
//     }

//     const iface = new ethers.Interface([
//       "function approve(address spender, uint256 amount) external",
//       "function transfer(address recipient, uint256 amount) external",
//     ]);

//     try {
//       const decoded = iface.parseTransaction({ data });

//       if (!decoded) {
//         return res.json({ function: "unknown", args: [], confidence: "low" });
//       }

//       const functionName = decoded.name;
//       const args = decoded.args.map((a) => a.toString());

//       res.json({
//         function: functionName,
//         args,
//         confidence: "high",
//       });
//     } catch {
//       // Not a standard ERC20 call
//       res.json({
//         function: "custom",
//         args: [data],
//         confidence: "low",
//       });
//     }
//   } catch (err) {
//     res.status(400).json({ error: err.message });
//   }
// });

// /* -------------------------------------------------------------------------- */
// /* Pocket discovery                                                           */
// /* -------------------------------------------------------------------------- */

// /**
//  * List pockets created for a user
//  * GET /api/pockets/:userAddress
//  */
// app.get("/api/pockets/:userAddress", async (req, res) => {
//   try {
//     const { userAddress } = req.params;
//     requireAddress(userAddress, "user");

//     const filter = factory.filters.PocketDeployed(null, userAddress);
//     const events = await factory.queryFilter(filter, 0, "latest");

//     const PocketABI = JSON.parse(
//       fs.readFileSync(
//         path.resolve("src/abi/Pocket.json"),
//         "utf8"
//       )
//     );

//     const pockets = await Promise.all(
//       events.map(async (e) => {
//         const pocketAddress = e.args.pocket;

//         const pocket = new ethers.Contract(
//           pocketAddress,
//           PocketABI,
//           provider
//         );

//         const used = await pocket.used();

//         return {
//           address: pocketAddress,
//           used,
//           createdAt: e.blockNumber
//         };
//       })
//     );

//     res.json({ pockets });
//   } catch (err) {
//     res.status(500).json({
//       error: err.message
//     });
//   }
// });

/* -------------------------------------------------------------------------- */
/* Route mounting                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Pocket lifecycle + execution
 * (state-changing, relayed)
 */
app.use("/api/pocket", pocketRoutes);

/**
 * Controller registry + discovery
 * (read-only)
 */
app.use("/api/controller", controllerRoutes);

/**
 * Signature verification
 * (cryptographic, read-only)
 */
app.use("/api/verify", verifyRoutes);

/**
 * Risk analysis & simulation
 * (advisory only)
 */
app.use("/api/risk", riskRoutes);

/**
 * Token metadata
 * (read-only)
 */
app.use("/api/token", tokenRoutes);

/**
 * System meta, health, metrics
 * (off-chain only)
 */
app.use("/api", metaRoutes);


/* -------------------------------------------------------------------------- */
/* Start server                                                               */
/* -------------------------------------------------------------------------- */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Pocket backend running on :${PORT}`);
});
