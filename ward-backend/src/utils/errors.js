import dotenv from "dotenv";
dotenv.config();

export function decodeEthersError(err, iface) {
  if (err?.data) {
    try {
      const decoded = iface.parseError(err.data);
      return { type: "CONTRACT_ERROR", name: decoded.name };
    } catch { }
  }

  if (err?.reason) return { type: "REVERT", message: err.reason };
  if (err?.code) return { type: "RPC_ERROR", message: err.message };
  if (err?.message) return { type: "ERROR", message: err.message };

  return { type: "UNKNOWN", message: "Execution failed" };
}
