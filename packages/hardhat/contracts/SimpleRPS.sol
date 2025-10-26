//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IERC20.sol";
import "./interfaces/IERC20Metadata.sol";
import "@pythnetwork/entropy-sdk-solidity/IEntropyV2.sol";
import "@pythnetwork/entropy-sdk-solidity/IEntropyConsumer.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract SimpleRPS is Ownable, IEntropyConsumer, ReentrancyGuard {
    // Game states
    enum GameState {
        WaitingForEntropy,
        Completed
    }

    // Game struct
    struct Game {
        uint256 gameId;
        address player;
        uint256 betAmount;
        address tokenAddress; // address(0) for ETH, token address for ERC20
        uint256 multiplierAtBet; // snapshot of winMultiplier
        uint256 commissionRateAtBet; // snapshot of commissionRate (bps)
        GameState state;
        bool won;
        uint256 createdAt;
        uint256 completedAt;
    }

    // Configuration
    IEntropyV2 public immutable entropyContract;
    address public immutable entropyProvider;

    // Token management
    struct TokenConfig {
        bool isActive;
        uint256 minBet;
        uint256 decimals;
    }
    
    mapping(address => TokenConfig) public supportedTokens;
    address[] public tokenList;

    // Configurable parameters (owner can change)
    uint256 public minBetETH = 0.001 ether; // 0.001 ETH minimum
    uint256 public winChance = 3333; // 33.33% chance (3333/10000)
    uint256 public winMultiplier = 3; // 3x payout
    uint256 public commissionRate = 500; // 5% commission (500/10000)
    uint256 public entropyGasLimit = 500000; // Gas limit for entropy requests

    // Game tracking
    uint256 public nextGameId = 1;
    mapping(uint256 => Game) public games;
    mapping(address => uint256[]) public playerGames;
    mapping(uint64 => uint256) public sequenceToGameId; // Map sequence number to game ID
    mapping(uint256 => uint64) public gameIdToSequenceNumber; // reverse mapping for cleanup
    
    uint256 public totalGames = 0;
    uint256 public totalVolume = 0;
    // Per-asset accounting
    mapping(address => uint256) public pendingLiability; // address(0) => ETH
    mapping(address => uint256) public tokenCommission; // address(0) => ETH
    uint256 public activeGames = 0; // Count of games waiting for entropy
    uint256 public maxActiveGames = 10; // Maximum allowed active games
    uint256 public gameTimeout = 30 minutes; // timeout for entropy callback before admin can expire

    // Events
    event GameCreated(uint256 indexed gameId, address indexed player, uint256 betAmount, address tokenAddress);
    event EntropyRequested(uint256 indexed gameId, uint64 indexed sequenceNumber);
    event GameCompleted(uint256 indexed gameId, address indexed player, bool won, uint256 payout);
    
    // Token management events
    event TokenAdded(address indexed tokenAddress, uint256 minBet, uint256 decimals);
    event TokenRemoved(address indexed tokenAddress);
    event TokenMinBetUpdated(address indexed tokenAddress, uint256 oldValue, uint256 newValue);
    
    // Configuration events
    event MinBetETHUpdated(uint256 oldValue, uint256 newValue);
    event WinChanceUpdated(uint256 oldValue, uint256 newValue);
    event WinMultiplierUpdated(uint256 oldValue, uint256 newValue);
    event CommissionRateUpdated(uint256 oldValue, uint256 newValue);
    event EntropyGasLimitUpdated(uint256 oldValue, uint256 newValue);
    event MaxActiveGamesUpdated(uint256 oldValue, uint256 newValue);
    event GameTimeoutUpdated(uint256 oldValue, uint256 newValue);
    event GameExpired(uint256 indexed gameId, address indexed player, uint256 refundAmount);
    event CommissionWithdrawn(address indexed tokenAddress, address indexed to, uint256 amount);
    event EntropyCallbackIgnored(uint64 indexed sequenceNumber, uint256 indexed gameId);

    constructor(
        address _entropyContract,
        address _entropyProvider
    ) Ownable(msg.sender) {
        entropyContract = IEntropyV2(_entropyContract);
        entropyProvider = _entropyProvider;
    }

    /**
     * @dev Internal helper to create a game and request entropy
     */
    function _openGame(
        uint256 betAmount,
        address tokenAddress,
        bytes32 userRandomNumber,
        uint128 entropyFee
    ) internal returns (uint256 gameId, uint64 sequenceNumber) {
        uint256 snapshotMultiplier = winMultiplier;
        uint256 snapshotCommission = commissionRate;
        gameId = nextGameId++;
        Game storage game = games[gameId];
        game.gameId = gameId;
        game.player = msg.sender;
        game.betAmount = betAmount;
        game.tokenAddress = tokenAddress;
        game.multiplierAtBet = snapshotMultiplier;
        game.commissionRateAtBet = snapshotCommission;
        game.state = GameState.WaitingForEntropy;
        game.createdAt = block.timestamp;
        
        playerGames[msg.sender].push(gameId);
        totalGames++;
        totalVolume += betAmount;
        activeGames++;
        
        emit GameCreated(gameId, msg.sender, betAmount, tokenAddress);
        
        sequenceNumber = entropyContract.requestV2{value: entropyFee}(
            entropyProvider,
            userRandomNumber,
            uint32(entropyGasLimit)
        );
        sequenceToGameId[sequenceNumber] = gameId;
        gameIdToSequenceNumber[gameId] = sequenceNumber;
        emit EntropyRequested(gameId, sequenceNumber);
    }

    /**
     * @dev Play a game with ERC20 token - place bet and request entropy
     * @param tokenAddress Address of the ERC20 token to bet with
     * @param betAmount Amount to bet (in token units)
     * @param userRandomNumber User's random number for entropy
     */
    function playGameWithToken(
        address tokenAddress,
        uint256 betAmount,
        bytes32 userRandomNumber
    ) external payable nonReentrant returns (uint256 gameId, uint64 sequenceNumber) {
        require(tokenAddress != address(0), "Invalid token address");
        require(supportedTokens[tokenAddress].isActive, "Token not supported");
        require(activeGames < maxActiveGames, "Too many active games");
        
        IERC20 token = IERC20(tokenAddress);
        require(token.balanceOf(msg.sender) >= betAmount, "Insufficient token balance");
        require(token.allowance(msg.sender, address(this)) >= betAmount, "Insufficient allowance");
        
        // Transfer token from player (support fee-on-transfer by measuring received amount)
        uint256 balBefore = token.balanceOf(address(this));
        require(token.transferFrom(msg.sender, address(this), betAmount), "Token transfer failed");
        uint256 received = token.balanceOf(address(this)) - balBefore;
        // Support fee-on-transfer by using received as actual bet amount
        require(received > 0, "Token receive failed");
        betAmount = received;
        require(betAmount >= supportedTokens[tokenAddress].minBet, "Bet too small");

        // Solvency: reserve worst-case payout for this game (with current multiplier)
        uint256 newPayout = betAmount * winMultiplier;
        uint256 tokenBalance = token.balanceOf(address(this));
        require(pendingLiability[tokenAddress] + newPayout <= tokenBalance, "Insufficient token solvency");
        pendingLiability[tokenAddress] += newPayout;
        
        // Request entropy from Pyth V2 (player pays fee directly)
        uint128 fee = entropyContract.getFeeV2(entropyProvider, uint32(entropyGasLimit));
        require(msg.value >= fee, "Insufficient ETH for entropy fee");

        (gameId, sequenceNumber) = _openGame(betAmount, tokenAddress, userRandomNumber, fee);
    }

    /**
     * @dev Play a game with ETH - place bet and request entropy
     * @param userRandomNumber User's random number for entropy
     */
    function playGameWithETH(
        bytes32 userRandomNumber
    ) external payable nonReentrant returns (uint256 gameId, uint64 sequenceNumber) {
        uint128 entropyFee = entropyContract.getFeeV2(entropyProvider, uint32(entropyGasLimit));
        require(msg.value >= minBetETH + entropyFee, "Insufficient ETH for bet and entropy fee");
        // max bet will be enforced by solvency reservation below; no separate cap needed
        require(activeGames < maxActiveGames, "Too many active games");
        // Calculate actual bet amount (total value minus entropy fee)
        uint256 betAmount = msg.value - entropyFee;
        
        // Solvency: reserve worst-case payout for this game (ETH) with current multiplier
        uint256 newPayoutEth = betAmount * winMultiplier;
        uint256 availableEth = address(this).balance - entropyFee; // entropy fee is being sent out
        require(pendingLiability[address(0)] + newPayoutEth <= availableEth, "Insufficient ETH solvency");
        pendingLiability[address(0)] += newPayoutEth;
        

        (gameId, sequenceNumber) = _openGame(betAmount, address(0), userRandomNumber, entropyFee);
    }

    /**
     * @dev Callback function called by Pyth Entropy V2 when random number is ready
     * @param sequenceNumber The sequence number of the request
     * @param providerAddress The provider that generated the random number (unused)
     * @param randomNumber The generated random number
     */
    function entropyCallback(
        uint64 sequenceNumber,
        address providerAddress,
        bytes32 randomNumber
    ) internal override {
        require(msg.sender == address(entropyContract), "Only Pyth Entropy can call this");
        providerAddress;
        // Get game ID from sequence number
        uint256 gameId = sequenceToGameId[sequenceNumber];
        require(gameId != 0, "Invalid sequence number");
        
        Game storage game = games[gameId];
        if (game.state != GameState.WaitingForEntropy) {
            // Late or duplicate callback – ignore with event
            emit EntropyCallbackIgnored(sequenceNumber, gameId);
            return;
        }
        
        // Determine winner
        uint256 randomValue = uint256(randomNumber) % 10000;
        bool won = randomValue < winChance;
        game.won = won;
        game.state = GameState.Completed;
        game.completedAt = block.timestamp;
        
        // Decrease active games counter and release reserved liability
        activeGames--;
        uint256 reserved = games[gameId].betAmount * games[gameId].multiplierAtBet;
        if (pendingLiability[game.tokenAddress] >= reserved) {
            pendingLiability[game.tokenAddress] -= reserved;
        } else {
            pendingLiability[game.tokenAddress] = 0;
        }
        
        // Calculate payout
        uint256 payout = 0;
        if (won) {
            payout = game.betAmount * game.multiplierAtBet;
            uint256 commission = (payout * game.commissionRateAtBet) / 10000;
            payout -= commission;
            tokenCommission[game.tokenAddress] += commission;
            
            // Transfer winnings to player
            if (game.tokenAddress == address(0)) {
                // Send ETH payout
                (bool success, ) = payable(game.player).call{value: payout}("");
                require(success, "ETH payout transfer failed");
            } else {
                // Send token payout
                IERC20 token = IERC20(game.tokenAddress);
                require(token.transfer(game.player, payout), "Token payout transfer failed");
            }
        }       
        
        emit GameCompleted(gameId, game.player, won, payout);
    }

    /**
     * @dev Get entropy fee from Pyth V2
     */
    function getEntropyFee() external view returns (uint128) {
        return entropyContract.getFeeV2(entropyProvider, uint32(entropyGasLimit));
    }

    /**
     * @dev Required by IEntropyConsumer interface
     */
    function getEntropy() internal view override returns (address) {
        return address(entropyContract);
    }

    /**
     * @dev Get player's games
     */
    function getPlayerGames(address player) external view returns (uint256[] memory) {
        return playerGames[player];
    }

    /**
     * @dev Get game details
     */
    function getGame(uint256 gameId) external view returns (Game memory) {
        return games[gameId];
    }

    function getGameState(uint256 gameId) external view returns (GameState) {
        return games[gameId].state;
    }

    /**
     * @dev Get current configuration
     */
    function getConfiguration() external view returns (
        uint256 _minBetETH,
        uint256 _winChance,
        uint256 _winMultiplier,
        uint256 _commissionRate,
        uint256 _entropyGasLimit
    ) {
        return (
            minBetETH,
            winChance,
            winMultiplier,
            commissionRate,
            entropyGasLimit
        );
    }

    /**
     * @dev Get supported tokens list
     */
    function getSupportedTokens() external view returns (address[] memory) {
        return tokenList;
    }

    /**
     * @dev Get token configuration
     */
    function getTokenConfig(address tokenAddress) external view returns (TokenConfig memory) {
        return supportedTokens[tokenAddress];
    }

    /**
     * @dev Get active games information
     */
    function getActiveGamesInfo() external view returns (uint256 _activeGames, uint256 _maxActiveGames) {
        return (activeGames, maxActiveGames);
    }

    /**
     * @dev Get reserved liabilities and withdrawable balances (views)
     */
    function reservedLiabilityETH() external view returns (uint256) {
        return pendingLiability[address(0)];
    }

    function reservedLiabilityToken(address tokenAddress) external view returns (uint256) {
        return pendingLiability[tokenAddress];
    }

    function withdrawableETH() external view returns (uint256) {
        uint256 bal = address(this).balance;
        uint256 reserved = pendingLiability[address(0)] + tokenCommission[address(0)];
        if (bal <= reserved) return 0;
        return bal - reserved;
    }

    function withdrawableToken(address tokenAddress) external view returns (uint256) {
        IERC20 token = IERC20(tokenAddress);
        uint256 bal = token.balanceOf(address(this));
        uint256 reserved = pendingLiability[tokenAddress] + tokenCommission[tokenAddress];
        if (bal <= reserved) return 0;
        return bal - reserved;
    }

    /**
     * @dev Get maximum bet amount for ETH
     */
    function maxBetETH() external view returns (uint256) {
        uint256 available = address(this).balance;
        uint256 reserved = pendingLiability[address(0)];
        if (available <= reserved) return 0;
        return (available - reserved) / winMultiplier;
    }

    /**
     * @dev Get maximum bet amount for token
     */
    function maxBetToken(address tokenAddress) external view returns (uint256) {
        require(supportedTokens[tokenAddress].isActive, "Token not supported");
        
        IERC20 token = IERC20(tokenAddress);
        uint256 tokenBalance = token.balanceOf(address(this));
        uint256 reserved = pendingLiability[tokenAddress];
        if (tokenBalance <= reserved) return 0;
        return (tokenBalance - reserved) / winMultiplier;
    }

    /**
     * @dev Add a new supported token (owner only)
     */
    function addToken(
        address tokenAddress,
        uint256 minBet
    ) external onlyOwner {
        require(tokenAddress != address(0), "Invalid token address");
        require(!supportedTokens[tokenAddress].isActive, "Token already supported");
        require(minBet > 0, "Min bet must be greater than 0");
        uint8 decimals = IERC20Metadata(tokenAddress).decimals();
        
        supportedTokens[tokenAddress] = TokenConfig({
            isActive: true,
            minBet: minBet,
            decimals: decimals
        });
        
        tokenList.push(tokenAddress);
        emit TokenAdded(tokenAddress, minBet, decimals);
    }

    /**
     * @dev Remove a supported token (owner only)
     */
    function removeToken(address tokenAddress) external onlyOwner {
        require(supportedTokens[tokenAddress].isActive, "Token not supported");
        
        supportedTokens[tokenAddress].isActive = false;
        
        // Remove from tokenList
        for (uint256 i = 0; i < tokenList.length; i++) {
            if (tokenList[i] == tokenAddress) {
                tokenList[i] = tokenList[tokenList.length - 1];
                tokenList.pop();
                break;
            }
        }
        
        emit TokenRemoved(tokenAddress);
    }

    /**
     * @dev Update token minimum bet (owner only)
     */
    function setTokenMinBet(address tokenAddress, uint256 newMinBet) external onlyOwner {
        require(supportedTokens[tokenAddress].isActive, "Token not supported");
        require(newMinBet > 0, "Min bet must be greater than 0");
        
        uint256 oldValue = supportedTokens[tokenAddress].minBet;
        supportedTokens[tokenAddress].minBet = newMinBet;
        emit TokenMinBetUpdated(tokenAddress, oldValue, newMinBet);
    }

    /**
     * @dev Set minimum ETH bet (owner only)
     */
    function setMinBetETH(uint256 _minBetETH) external onlyOwner {
        require(_minBetETH > 0, "Min bet must be greater than 0");
        uint256 oldValue = minBetETH;
        minBetETH = _minBetETH;
        emit MinBetETHUpdated(oldValue, _minBetETH);
    }

    /**
     * @dev Set win chance (owner only)
     * @param _winChance Win chance in basis points (e.g., 3333 = 33.33%)
     */
    function setWinChance(uint256 _winChance) external onlyOwner {
        require(_winChance > 0 && _winChance <= 10000, "Win chance must be between 1 and 10000");
        uint256 oldValue = winChance;
        winChance = _winChance;
        emit WinChanceUpdated(oldValue, _winChance);
    }

    /**
     * @dev Set win multiplier (owner only)
     */
    function setWinMultiplier(uint256 _winMultiplier) external onlyOwner {
        require(_winMultiplier > 0, "Win multiplier must be greater than 0");
        uint256 oldValue = winMultiplier;
        winMultiplier = _winMultiplier;
        emit WinMultiplierUpdated(oldValue, _winMultiplier);
    }

    /**
     * @dev Set commission rate (owner only)
     * @param _commissionRate Commission rate in basis points (e.g., 500 = 5%)
     */
    function setCommissionRate(uint256 _commissionRate) external onlyOwner {
        require(_commissionRate <= 10000, "Commission rate cannot exceed 100%");
        uint256 oldValue = commissionRate;
        commissionRate = _commissionRate;
        emit CommissionRateUpdated(oldValue, _commissionRate);
    }

    /**
     * @dev Set entropy gas limit (owner only)
     */
    function setEntropyGasLimit(uint256 _entropyGasLimit) external onlyOwner {
        require(_entropyGasLimit > 0, "Gas limit must be greater than 0");
        uint256 oldValue = entropyGasLimit;
        entropyGasLimit = _entropyGasLimit;
        emit EntropyGasLimitUpdated(oldValue, _entropyGasLimit);
    }

    /**
     * @dev Set maximum active games (owner only)
     */
    function setMaxActiveGames(uint256 _maxActiveGames) external onlyOwner {
        require(_maxActiveGames > 0, "Max active games must be greater than 0");
        uint256 oldValue = maxActiveGames;
        maxActiveGames = _maxActiveGames;
        emit MaxActiveGamesUpdated(oldValue, _maxActiveGames);
    }

    /**
     * @dev Set game timeout (owner only)
     */
    function setGameTimeout(uint256 _gameTimeout) external onlyOwner {
        require(_gameTimeout >= 1 minutes, "Timeout too low");
        uint256 oldValue = gameTimeout;
        gameTimeout = _gameTimeout;
        emit GameTimeoutUpdated(oldValue, _gameTimeout);
    }

    /**
     * @dev Withdraw commission for a specific token (owner only)
     */
    function withdrawCommission(address tokenAddress) external onlyOwner {
        uint256 amount = tokenCommission[tokenAddress];
        require(amount > 0, "No commission");
        if (tokenAddress == address(0)) {
            uint256 bal = address(this).balance;
            require(bal >= amount + pendingLiability[address(0)], "Breaks solvency");
            tokenCommission[address(0)] = 0;
            (bool success, ) = payable(owner()).call{value: amount}("");
            require(success, "ETH commission transfer failed");
        } else {
            IERC20 token = IERC20(tokenAddress);
            uint256 bal = token.balanceOf(address(this));
            require(bal >= amount + pendingLiability[tokenAddress], "Breaks solvency");
            tokenCommission[tokenAddress] = 0;
            require(token.transfer(owner(), amount), "Token commission transfer failed");
        }
        emit CommissionWithdrawn(tokenAddress, owner(), amount);
    }

    /**
     * @dev Emergency withdraw token (owner only)
     */
    function emergencyWithdrawToken(address tokenAddress) external onlyOwner {
        // allow withdraw of any token balance, but keep solvency: cannot withdraw reserved liabilities or commissions
        IERC20 token = IERC20(tokenAddress);
        uint256 balance = token.balanceOf(address(this));
        uint256 reserved = pendingLiability[tokenAddress] + tokenCommission[tokenAddress];
        require(balance > reserved, "No withdrawable token balance");
        uint256 withdrawable = balance - reserved;
        require(token.transfer(owner(), withdrawable), "Token transfer failed");
    }

    /**
     * @dev Emergency withdraw ETH (owner only)
     */
    function emergencyWithdrawETH() external onlyOwner {
        uint256 balance = address(this).balance;
        uint256 reserved = pendingLiability[address(0)] + tokenCommission[address(0)];
        require(balance > reserved, "No withdrawable ETH balance");
        uint256 withdrawable = balance - reserved;
        (bool success, ) = payable(owner()).call{value: withdrawable}("");
        require(success, "ETH transfer failed");
    }

    /**
     * @dev Admin can expire a stuck game after timeout, refunding the bet and releasing the liability.
     */
    function expireAndRefund(uint256 gameId) external onlyOwner {
        Game storage game = games[gameId];
        require(game.state == GameState.WaitingForEntropy, "Not pending");
        require(block.timestamp >= game.createdAt + gameTimeout, "Not timed out");

        // release liability
        uint256 reserved = game.betAmount * game.multiplierAtBet;
        if (pendingLiability[game.tokenAddress] >= reserved) {
            pendingLiability[game.tokenAddress] -= reserved;
        } else {
            pendingLiability[game.tokenAddress] = 0;
        }

        // mark completed and refund bet
        game.state = GameState.Completed;
        game.completedAt = block.timestamp;
        activeGames--;

        if (game.tokenAddress == address(0)) {
            (bool success, ) = payable(game.player).call{value: game.betAmount}("");
            require(success, "ETH refund failed");
        } else {
            IERC20 token = IERC20(game.tokenAddress);
            require(token.transfer(game.player, game.betAmount), "Token refund failed");
        }

        // cleanup sequence maps
        uint64 seq = gameIdToSequenceNumber[gameId];
        if (seq != 0) {
            delete sequenceToGameId[seq];
            delete gameIdToSequenceNumber[gameId];
        }

        emit GameExpired(gameId, game.player, game.betAmount);
    }

    receive() external payable {}
}
