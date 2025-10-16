import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("YourContractModule", (m) => {
  // Get the deployer account
  const deployer = m.getAccount(0);
  
  // Deploy YourContract with deployer address as constructor argument
  const yourContract = m.contract("YourContract", [deployer]);
  
  return { yourContract };
});

