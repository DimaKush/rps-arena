# RPS Arena

A Rock-Paper-Scissors battle game built on Ethereum using scaffold-eth.

## What is this?

Players see a battlefield with Rock/Paper/Scissors units in starting positions, predict who will win, place their bet, and watch the battle unfold. The winner is determined on-chain using Pyth's verifiable randomness.

Built with scaffold-eth for ETHOnline 2025.

## How it works

1. Players see a battlefield scenario with R/P/S units
2. Players predict the winner and place PYUSD bet
3. Pyth generates a random seed
4. Winner is determined instantly on-chain
5. Watch the epic battle animation
6. Winner gets paid in PYUSD

---

## Tech Stack

- **scaffold-eth** - Base framework
- **Hardhat 3** - Smart contract development  
- **Pyth Network** - Verifiable randomness
- **PYUSD** - Game currency
- **Next.js** - Frontend

---

## Development

This project uses scaffold-eth as the base framework. The smart contracts are in `packages/hardhat/` and the frontend is in `packages/nextjs/`.

### Getting Started

```bash
yarn install
yarn dev
```

### Hardhat 3 Keystore Setup

This project uses Hardhat 3's encrypted keystore to securely manage sensitive values like private keys and RPC URLs.

#### Required Secrets

Set up the following secrets in the keystore:

```bash
cd packages/hardhat

# Set RPC URLs
npx hardhat keystore set --dev OPTIMISM_SEPOLIA_RPC_URL

# Set private key for deployment
npx hardhat keystore set DEPLOYER_PRIVATE_KEY
```

#### Keystore Management

```bash
# List all stored secrets
npx hardhat keystore list

# Get a specific secret
npx hardhat keystore get <key>

# Delete a secret
npx hardhat keystore delete <key>

# Change keystore password
npx hardhat keystore change-password
```

#### Development vs Production Keystore

For development, you can use the development keystore (no password required):

```bash
# Store in development keystore
npx hardhat keystore set --dev <key>
```

### Frontend

Built with Next.js and Canvas API for the battle animations.

## Testing

### Run Tests

```bash
# Run all Solidity tests
cd packages/hardhat
yarn test

# Run specific test file
yarn test test/SimpleRPS.t.sol

# Run tests with gas reporting
yarn test --gas-report
```

### Test Coverage

```bash
# Install coverage tool
cd packages/hardhat
npm install --save-dev solidity-coverage

# Run tests with coverage
npx hardhat coverage
```

## Deployment

### Prerequisites

1. **Install dependencies:**
```bash
yarn install
```

2. **Set up keystore secrets:**
```bash
cd packages/hardhat

# Development keystore (no password)
npx hardhat keystore set --dev OPTIMISM_SEPOLIA_RPC_URL "https://sepolia.optimism.io"
npx hardhat keystore set --dev DEPLOYER_PRIVATE_KEY "your-private-key-here"
npx hardhat keystore set --dev ETHERSCAN_API_KEY "your-etherscan-api-key"

# Production keystore (with password)
npx hardhat keystore set OPTIMISM_SEPOLIA_RPC_URL "https://sepolia.optimism.io"
npx hardhat keystore set DEPLOYER_PRIVATE_KEY "your-private-key-here"
npx hardhat keystore set ETHERSCAN_API_KEY "your-etherscan-api-key"
```

### Local Development

1. **Start local blockchain:**
```bash
# Terminal 1: Start Hardhat node
cd packages/hardhat
yarn chain
```

2. **Deploy contracts locally:**
```bash
# Terminal 2: Deploy to local network
cd packages/hardhat
yarn deploy --network localhost
```

3. **Generate contract types:**
```bash
cd packages/hardhat
yarn generate-contracts
```

4. **Start frontend:**
```bash
# Terminal 3: Start Next.js dev server
cd packages/nextjs
yarn dev
```

### Optimism Sepolia Deployment

1. **Deploy SimpleRPS contract:**
```bash
cd packages/hardhat
yarn deploy --network optimismSepolia ignition/modules/SimpleRPSOptimismSepolia.ts
```

2. **Deploy with PYUSD integration:**
```bash
cd packages/hardhat
yarn deploy --network optimismSepolia ignition/modules/RPSArenaWithPYUSD.ts
```

3. **Verify contracts on Etherscan:**
```bash
cd packages/hardhat
npx hardhat verify --network optimismSepolia <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
```

### Contract Verification Examples

```bash
# Verify SimpleRPS contract
npx hardhat verify --network optimismSepolia 0x1234... \
  "0x4821932D0CDd71225A6d914706A621e0389D7061" \
  "0x6CC14824Ea2918f5De5C2f75A9Da968ad4BD6344"

# Verify PYUSD contract
npx hardhat verify --network optimismSepolia 0x5678...
```

### Frontend Deployment

1. **Update network configuration:**
```bash
cd packages/nextjs
# Edit scaffold.config.ts to point to Optimism Sepolia
```

2. **Build and deploy to Vercel:**
```bash
cd packages/nextjs
yarn vercel
```

3. **Deploy to IPFS:**
```bash
cd packages/nextjs
yarn ipfs
```

## TODO

- [x] Set up Hardhat 3
- [x] Configure keystore for secure secrets
- [x] Integrate Pyth Entropy
- [x] Add PYUSD payments
- [x] Add comprehensive testing
- [x] Add deployment instructions
- [x] Build prediction UI
- [x] Add battle animations
- [x] Deploy to Optimism Sepolia

## Future Steps

### Phase 1: Infrastructure Updates
- [ ] **Commit scaffold-eth Hardhat 3 migration**
  - Update scaffold-eth base to latest Hardhat 3 compatible version
  - Ensure all dependencies are compatible with Hardhat 3
  - Test migration compatibility across all packages

### Phase 2: Liquidity Farming Contract
- [ ] **Design deposit farming system**
  - Create `FarmingPool` contract for liquidity deposits
  - Implement percentage-based rewards from game commissions
  - Add staking/unstaking functionality for players
  - Design reward distribution mechanism

- [ ] **Integration with SimpleRPS**
  - Modify SimpleRPS to collect and distribute commissions
  - Connect farming pool to game revenue stream
  - Implement automatic reward calculations
  - Add liquidity provider incentives

- [ ] **Frontend Integration**
  - Build farming dashboard UI
  - Add deposit/withdraw interfaces
  - Display APY and reward calculations
  - Integrate with existing game UI

### Phase 3: Advanced Features
- [ ] **Multi-token support**
  - Support multiple ERC-20 tokens for farming
  - Dynamic reward pools based on token popularity
  - Cross-token farming strategies

- [ ] **Governance features**
  - DAO voting for commission rates
  - Community-driven parameter adjustments
  - Liquidity provider governance rights