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

### Frontend

Built with Next.js and Canvas API for the battle animations.

## TODO

- [ ] Set up Hardhat 3
- [ ] Integrate Pyth Entropy
- [ ] Add PYUSD payments
- [ ] Build prediction UI
- [ ] Add battle animations
- [ ] Deploy to Sepolia