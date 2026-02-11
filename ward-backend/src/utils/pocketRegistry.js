import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ethers } from "ethers";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, "../../data");
const registryFile = path.resolve(dataDir, "pocket-registry.json");

class PocketRegistry {
  constructor() {
    this.memory = new Map();
    this.persistenceEnabled = true;
    this._init();
  }

  _init() {
    try {
      fs.mkdirSync(dataDir, { recursive: true });
      if (!fs.existsSync(registryFile)) {
        fs.writeFileSync(registryFile, JSON.stringify({}, null, 2));
      }
      const raw = fs.readFileSync(registryFile, "utf8");
      const parsed = raw ? JSON.parse(raw) : {};
      for (const [owner, pockets] of Object.entries(parsed)) {
        if (!Array.isArray(pockets)) continue;
        let normalizedOwner;
        try {
          normalizedOwner = ethers.getAddress(owner);
        } catch {
          continue;
        }
        this.memory.set(
          normalizedOwner,
          new Set(
            pockets
              .map((p) => {
                try {
                  return ethers.getAddress(String(p)).toLowerCase();
                } catch {
                  return null;
                }
              })
              .filter(Boolean)
          )
        );
      }
    } catch (err) {
      this.persistenceEnabled = false;
      console.warn("[pocket-registry] persistence unavailable, using in-memory store only", {
        error: err?.message
      });
    }
  }

  _toObject() {
    const out = {};
    for (const [owner, pockets] of this.memory.entries()) {
      out[owner] = Array.from(pockets);
    }
    return out;
  }

  _persist() {
    if (!this.persistenceEnabled) return;
    try {
      const tmpFile = `${registryFile}.tmp`;
      fs.writeFileSync(tmpFile, JSON.stringify(this._toObject(), null, 2));
      fs.renameSync(tmpFile, registryFile);
    } catch (err) {
      this.persistenceEnabled = false;
      console.warn("[pocket-registry] failed to persist; continuing in-memory", {
        error: err?.message
      });
    }
  }

  addPocket(ownerAddress, pocketAddress) {
    const owner = ethers.getAddress(String(ownerAddress));
    const pocket = ethers.getAddress(String(pocketAddress));
    const existing = this.memory.get(owner) ?? new Set();
    existing.add(pocket.toLowerCase());
    this.memory.set(owner, existing);
    this._persist();
  }

  getPocketsByOwner(ownerAddress) {
    const owner = ethers.getAddress(String(ownerAddress));
    const found = this.memory.get(owner);
    return found ? Array.from(found) : [];
  }
}

export const pocketRegistry = new PocketRegistry();
