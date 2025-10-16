import type { HardhatUserConfig } from "hardhat/config";
import hardhatIgnition from "@nomicfoundation/hardhat-ignition";

const config: HardhatUserConfig = {
  plugins: [hardhatIgnition],
  solidity: {
    compilers: [
      {
        version: "0.8.20",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  networks: {
    hardhat: {
      type: "edr-simulated",
    },
    localhost: {
      type: "http",
      url: "http://127.0.0.1:8545",
    },
  },
};

export default config;