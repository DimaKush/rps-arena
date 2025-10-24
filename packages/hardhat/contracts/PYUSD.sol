//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PYUSD
 * @dev PayPal USD (PYUSD) token implementation for RPS Arena
 * @notice This is a test implementation for Optimism Sepolia
 */
contract PYUSD is ERC20, Ownable {
    uint8 private constant _decimals = 6; // PYUSD uses 6 decimals
    
    constructor() ERC20("PayPal USD", "PYUSD") Ownable(msg.sender) {
        // Mint initial supply of 1,000,000 PYUSD (1M tokens with 6 decimals)
        _mint(msg.sender, 1_000_000 * 10**_decimals);
    }
    
    function decimals() public pure override returns (uint8) {
        return _decimals;
    }
    
    /**
     * @dev Mint new tokens (anyone can mint)
     * @param to Address to mint tokens to
     * @param amount Amount to mint (in token units, not wei)
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
    
    /**
     * @dev Burn tokens from caller
     * @param amount Amount to burn (in token units, not wei)
     */
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}
