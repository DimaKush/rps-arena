#!/bin/bash
echo "Deploying SimpleRPS to Optimism Sepolia..."

cd packages/hardhat && npx hardhat ignition deploy ignition/modules/SimpleRPSOptimismSepolia.ts --network optimismSepolia

echo ""
echo "Generating deployedContracts.ts for Next.js..."
npx hardhat run scripts/generateDeployedContracts.ts --network optimismSepolia
