#!/bin/bash
echo "Deploying contracts to localhost..."
cd packages/hardhat
npx hardhat ignition deploy ignition/modules/SimpleRPSOptimismSepolia.ts --network localhost

