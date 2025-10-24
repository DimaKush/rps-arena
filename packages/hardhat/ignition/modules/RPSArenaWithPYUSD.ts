import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const RPSArenaWithPYUSDModule = buildModule("RPSArenaWithPYUSDModule", (m) => {
  // Optimism Sepolia addresses
  const entropyContract = "0x4821932D0CDd71225A6d914706A621e0389D7061";
  const entropyProvider = "0x6CC14824Ea2918f5De5C2f75A9Da968ad4BD6344";
  
  // Deploy SimpleRPS
  const simpleRPS = m.contract("SimpleRPS", [
    entropyContract,
    entropyProvider
  ]);

  // Deploy PYUSD
  const pyusd = m.contract("PYUSD");

  // Add PYUSD to SimpleRPS (1 PYUSD = 1 * 10^6)
  const minBetPYUSD = 1000000n; // 1 PYUSD with 6 decimals
  m.call(simpleRPS, "addToken", [pyusd, minBetPYUSD]);

  // Transfer 500 PYUSD to SimpleRPS contract (500 * 10^6)
  const amountToContract = 500000000n; // 500 PYUSD
  m.call(pyusd, "transfer", [simpleRPS, amountToContract], { id: "transferToContract" });

  return { simpleRPS, pyusd };
});

export default RPSArenaWithPYUSDModule;
