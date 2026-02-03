import { ethers } from "ethers";

import fs from "fs";
import path from "path";

import dotenv from "dotenv";
dotenv.config();

const PocketABI = JSON.parse(
    fs.readFileSync(
        path.resolve("src/abi/Pocket.json"),
        "utf8"
    )
);
const ControllerABI = JSON.parse(
    fs.readFileSync(
        path.resolve("src/abi/PocketController.json"),
        "utf8"
    )
);

const FactoryABI = JSON.parse(
    fs.readFileSync(
        path.resolve("src/abi/PocketFactory.json"),
        "utf8"
    )
);
export const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

export const controllerSigner = new ethers.Wallet(
    process.env.CONTROLLER_PRIVATE_KEY,
    provider
);

export const controller = new ethers.Contract(
    process.env.CONTROLLER_ADDRESS,
    ControllerABI.abi,
    controllerSigner
);

export const factory = new ethers.Contract(
    process.env.FACTORY_ADDRESS,
    FactoryABI.abi,
    controllerSigner
);
