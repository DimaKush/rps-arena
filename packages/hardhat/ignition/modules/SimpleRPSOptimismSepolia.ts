import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const SimpleRPSOptimismSepoliaModule = buildModule("SimpleRPSOptimismSepoliaModule", (m) => {
  // Optimism Sepolia addresses
  const entropyContract = "0x4821932D0CDd71225A6d914706A621e0389D7061";
  const entropyProvider = "0x6CC14824Ea2918f5De5C2f75A9Da968ad4BD6344";
  
  const simpleRPS = m.contract("SimpleRPS", [
    entropyContract,
    entropyProvider
  ]);

  return { simpleRPS };
});

export default SimpleRPSOptimismSepoliaModule;
