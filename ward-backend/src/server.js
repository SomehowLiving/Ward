import express from "express";
import dotenv from "dotenv";

import pocketRoutes from "./routes/pocket.js";
import controllerRoutes from "./routes/controller.js";
import verifyRoutes from "./routes/verify.js";
import riskRoutes from "./routes/risk.js";
import tokenRoutes from "./routes/token.js";
import metaRoutes from "./routes/meta.js";

dotenv.config();

const app = express();
app.use(express.json());

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
