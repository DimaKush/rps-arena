//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../contracts/YourContract.sol";

contract YourContractTest {
    YourContract public yourContract;
    address public owner;

    function setUp() public {
        owner = address(this);
        yourContract = new YourContract(owner);
    }

    function testDeployment() public {
        require(yourContract.owner() == owner, "Owner mismatch");
        require(keccak256(bytes(yourContract.greeting())) == keccak256(bytes("Building Unstoppable Apps!!!")), "Greeting mismatch");
        require(yourContract.premium() == false, "Premium should be false");
        require(yourContract.totalCounter() == 0, "Counter should be 0");
    }

    function testSetGreeting() public {
        string memory newGreeting = "Hello Hardhat 3!";
        
        yourContract.setGreeting(newGreeting);
        
        require(keccak256(bytes(yourContract.greeting())) == keccak256(bytes(newGreeting)), "Greeting not set");
        require(yourContract.totalCounter() == 1, "Counter should be 1");
        require(yourContract.userGreetingCounter(owner) == 1, "User counter should be 1");
    }

    function testSetGreetingWithEth() public {
        string memory newGreeting = "Premium greeting";
        uint256 ethAmount = 0.1 ether;
        
        yourContract.setGreeting{value: ethAmount}(newGreeting);
        
        require(keccak256(bytes(yourContract.greeting())) == keccak256(bytes(newGreeting)), "Greeting not set");
        require(yourContract.premium() == true, "Premium should be true");
        require(yourContract.totalCounter() == 1, "Counter should be 1");
    }

    function testMultipleGreetings() public {
        yourContract.setGreeting("First greeting");
        yourContract.setGreeting("Second greeting");
        yourContract.setGreeting("Third greeting");
        
        require(yourContract.totalCounter() == 3, "Counter should be 3");
        require(yourContract.userGreetingCounter(owner) == 3, "User counter should be 3");
        require(keccak256(bytes(yourContract.greeting())) == keccak256(bytes("Third greeting")), "Last greeting not set");
    }

    function testWithdraw() public {
        // Send ETH to contract
        yourContract.setGreeting{value: 1 ether}("Test greeting");
        
        uint256 initialBalance = owner.balance;
        yourContract.withdraw();
        uint256 finalBalance = owner.balance;
        
        require(finalBalance > initialBalance, "Balance should increase");
        require(address(yourContract).balance == 0, "Contract balance should be 0");
    }

    function testReceive() public {
        uint256 initialBalance = address(yourContract).balance;
        
        (bool success,) = address(yourContract).call{value: 1 ether}("");
        require(success, "ETH transfer failed");
        
        require(address(yourContract).balance == initialBalance + 1 ether, "Balance should increase");
    }

    // Helper function to receive ETH
    receive() external payable {}
}