import { ethers } from "ethers";
import { controller } from "../config/chain.js";

export function requireAddress(value, name) {
    if (!ethers.isAddress(value)) {
        throw new Error(`Invalid address: ${name}`);
    }
}

export async function requireValidPocket(pocket) { 
    const valid = await controller.validPocket(pocket); 
    if (!valid) { 
        throw new Error("Invalid or burned pocket"); 
    } 
}