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

Start a local fork of Optimism Sepolia:
```bash
./start-fork.sh
```

### Frontend

Built with Next.js and Canvas API for the battle animations.

## TODO

- [x] Set up Hardhat 3
- [x] Configure keystore for secure secrets
- [x] Integrate Pyth Entropy
- [x] Add PYUSD payments
- [ ] Build prediction UI
- [ ] Add battle animations
- [ ] Deploy to Optimism Sepolia