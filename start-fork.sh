#!/bin/bash
cd packages/hardhat

# Start fork with RPC URL
npx hardhat node --fork $(npx hardhat keystore get --dev OPTIMISM_SEPOLIA_RPC_URL 2>/dev/null) --port 8545

