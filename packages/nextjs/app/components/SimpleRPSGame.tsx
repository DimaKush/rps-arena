"use client";

import { useEffect, useState } from "react";
import BattleArena from "./BattleArena";
import GameInterface from "./GameInterface";
import { formatEther, formatUnits, parseEther, parseUnits } from "viem";
import { useAccount } from "wagmi";
import { useBlockNumber, usePublicClient } from "wagmi";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { useDeployedContractInfo } from "~~/hooks/scaffold-eth/useDeployedContractInfo";
import { notification } from "~~/utils/scaffold-eth";

type GameState = "idle" | "betting" | "waiting" | "animating" | "completed" | "error";
type RPSChoice = "rock" | "paper" | "scissors";

export default function SimpleRPSGame() {
  const { address, isConnected } = useAccount();
  const { writeContractAsync: writeSimpleRPSAsync, isPending } = useScaffoldWriteContract({
    contractName: "SimpleRPS",
    chainId: 11155420,
  });
  const { writeContractAsync: writePYUSDAsync } = useScaffoldWriteContract({
    contractName: "PYUSD",
    chainId: 11155420,
  });
  const { data: deployedContractData } = useDeployedContractInfo({ contractName: "SimpleRPS", chainId: 11155420 });
  const { data: pyusdContractData } = useDeployedContractInfo({ contractName: "PYUSD", chainId: 11155420 });

  const [gameState, setGameState] = useState<GameState>("idle");
  const [betAmount, setBetAmount] = useState<string>("1");
  const [betType, setBetType] = useState<"ETH" | "PYUSD">("ETH");
  const [playerChoice, setPlayerChoice] = useState<RPSChoice | null>(null);
  const [battleWinner, setBattleWinner] = useState<string | null>(null);
  const [pythResult, setPythResult] = useState<RPSChoice | null>(null);
  const [currentScenario, setCurrentScenario] = useState<number>(0);
  const [triggerAnimation, setTriggerAnimation] = useState<boolean>(false);
  const [animationType, setAnimationType] = useState<"rock_wins" | "paper_wins" | "scissors_wins">("rock_wins");
  const [resetAnimation, setResetAnimation] = useState<boolean>(false);
  const [currentGameId, setCurrentGameId] = useState<bigint | null>(null);
  const [waitingNotificationId, setWaitingNotificationId] = useState<string | null>(null);
  const [gameStartTime, setGameStartTime] = useState<number | null>(null);
  const [processedGames, setProcessedGames] = useState<Set<string>>(new Set());

  // Function to reset all game-related states
  const resetGameState = () => {
    setGameState("idle");
    setBattleWinner(null);
    setPlayerChoice(null);
    setPythResult(null);
    setTriggerAnimation(false);
    setResetAnimation(true);
    setCurrentGameId(null);
    setGameStartTime(null);
    setProcessedGames(new Set()); // Clear processed games tracking
    setAnimationType("rock_wins");
    // Clear any waiting notification
    if (waitingNotificationId) {
      notification.remove(waitingNotificationId);
      setWaitingNotificationId(null);
    }
  };

  // Read contract data using Scaffold-ETH
  const { data: minBetEth } = useScaffoldReadContract({
    contractName: "SimpleRPS",
    functionName: "minBetETH",
    chainId: 11155420,
  });

  const { data: winMultiplier } = useScaffoldReadContract({
    contractName: "SimpleRPS",
    functionName: "winMultiplier",
    chainId: 11155420,
  });

  const { data: commissionRate } = useScaffoldReadContract({
    contractName: "SimpleRPS",
    functionName: "commissionRate",
    chainId: 11155420,
  });

  const { data: winChance } = useScaffoldReadContract({
    contractName: "SimpleRPS",
    functionName: "winChance",
    chainId: 11155420,
  });

  // PYUSD token data
  const { data: pyusdBalance } = useScaffoldReadContract({
    contractName: "PYUSD",
    functionName: "balanceOf",
    args: address ? [address] : ["0x0000000000000000000000000000000000000000"],
    chainId: 11155420,
  });

  const { data: pyusdTokenConfig } = useScaffoldReadContract({
    contractName: "SimpleRPS",
    functionName: "getTokenConfig",
    args: pyusdContractData?.address ? [pyusdContractData.address] : ["0x0000000000000000000000000000000000000000"],
    chainId: 11155420,
  });

  // Check PYUSD allowance
  const { data: pyusdAllowance } = useScaffoldReadContract({
    contractName: "PYUSD",
    functionName: "allowance",
    args:
      address && deployedContractData?.address
        ? [address, deployedContractData.address]
        : ["0x0000000000000000000000000000000000000000", "0x0000000000000000000000000000000000000000"],
    chainId: 11155420,
  });

  // Get entropy fee (we'll calculate this dynamically)
  const [entropyFee, setEntropyFee] = useState<bigint>(0n);
  const publicClient = usePublicClient({ chainId: 11155420 });
  const { data: blockNumber } = useBlockNumber({ chainId: 11155420, watch: true });

  // Calculate entropy fee
  useEffect(() => {
    const getEntropyFee = async () => {
      if (deployedContractData?.address && publicClient) {
        try {
          // Get entropy fee from contract
          const fee = await publicClient.readContract({
            address: deployedContractData.address,
            abi: [
              {
                inputs: [],
                name: "entropyContract",
                outputs: [{ internalType: "contract IEntropyV2", name: "", type: "address" }],
                stateMutability: "view",
                type: "function",
              },
            ],
            functionName: "entropyContract",
          });

          // Get entropy provider address first
          const entropyProvider = await publicClient.readContract({
            address: deployedContractData.address,
            abi: [
              {
                inputs: [],
                name: "entropyProvider",
                outputs: [{ internalType: "address", name: "", type: "address" }],
                stateMutability: "view",
                type: "function",
              },
            ],
            functionName: "entropyProvider",
          });

          // Get fee from entropy contract
          const entropyFee = await publicClient.readContract({
            address: fee as `0x${string}`,
            abi: [
              {
                inputs: [
                  { internalType: "address", name: "provider", type: "address" },
                  { internalType: "uint32", name: "gasLimit", type: "uint32" },
                ],
                name: "getFeeV2",
                outputs: [{ internalType: "uint128", name: "fee", type: "uint128" }],
                stateMutability: "view",
                type: "function",
              },
            ],
            functionName: "getFeeV2",
            args: [entropyProvider as `0x${string}`, 100000], // Use entropy provider address
          });

          setEntropyFee(entropyFee as bigint);
        } catch (error) {
          console.error("Error getting entropy fee:", error);
          // Set a default fee if we can't get it
          setEntropyFee(1000000000000000n); // 0.001 ETH default
        }
      }
    };

    getEntropyFee();
  }, [deployedContractData?.address, publicClient]);

  // Watch for events using manual polling
  useEffect(() => {
    if (!publicClient || !deployedContractData?.address || !blockNumber || !playerChoice) {
      return;
    }

    // Don't poll events if we're in idle state and have no current game
    if (gameState === "idle" && currentGameId === null) {
      return;
    }

    // Don't poll events if we're in betting state (just started new game)
    if (gameState === "betting") {
      return;
    }

    // Don't poll events if we're in completed state (game is done)
    if (gameState === "completed") {
      return;
    }

    // Don't poll events if we don't have a player choice (shouldn't happen)
    if (!playerChoice) {
      return;
    }

    const checkEvents = async () => {
      try {
        // Get GameCompleted events
        const gameCompletedLogs = await publicClient.getLogs({
          address: deployedContractData.address,
          event: {
            type: "event",
            name: "GameCompleted",
            inputs: [
              { name: "gameId", type: "uint256", indexed: true },
              { name: "player", type: "address", indexed: true },
              { name: "won", type: "bool", indexed: false },
              { name: "payout", type: "uint256", indexed: false },
            ],
          },
          fromBlock: blockNumber - 15n,
          toBlock: "latest",
        });

        if (gameCompletedLogs.length > 0) {
          // Look for the specific gameId we're waiting for
          let currentGameLog = null;
          if (currentGameId !== null) {
            currentGameLog = gameCompletedLogs.find(log => {
              const gameId = log.args.gameId as bigint;
              const player = log.args.player as string;
              const matchesGameId = gameId === currentGameId;
              const matchesAddress = player.toLowerCase() === address?.toLowerCase();
              return matchesGameId && matchesAddress;
            });
          }

          if (currentGameLog) {
            const won = currentGameLog.args.won;
            const gameId = currentGameLog.args.gameId as bigint;

            // Process the game result only if we're in waiting state
            if (gameState === "waiting") {
              const gameIdString = gameId.toString();

              // Prevent processing the same game result multiple times
              if (processedGames.has(gameIdString)) {
                return;
              }

              // Mark this game as processed
              setProcessedGames(prev => {
                const newSet = new Set(prev);
                newSet.add(gameIdString);
                return newSet;
              });

              // Determine Pyth result based on game outcome
              // If player won, Pyth result is the losing choice
              // If player lost, Pyth result is the winning choice
              let pythResult: RPSChoice;
              if (won) {
                // Player won, so Pyth result is the choice that loses to player's choice
                if (playerChoice === "rock") pythResult = "scissors";
                else if (playerChoice === "paper") pythResult = "rock";
                else pythResult = "paper";
              } else {
                // Player lost, so Pyth result is the choice that beats player's choice
                if (playerChoice === "rock") pythResult = "paper";
                else if (playerChoice === "paper") pythResult = "scissors";
                else pythResult = "rock";
              }

              setPythResult(pythResult);
              setBattleWinner(won ? "player" : "house");

              // Determine animation type based on result
              let newAnimationType: "rock_wins" | "paper_wins" | "scissors_wins";
              if (won) {
                // Player won, so show their choice winning
                if (playerChoice === "rock") newAnimationType = "rock_wins";
                else if (playerChoice === "paper") newAnimationType = "paper_wins";
                else newAnimationType = "scissors_wins";
              } else {
                // Player lost, so show the winning choice
                if (pythResult === "rock") newAnimationType = "rock_wins";
                else if (pythResult === "paper") newAnimationType = "paper_wins";
                else newAnimationType = "scissors_wins";
              }

              setAnimationType(newAnimationType);
              setGameState("animating");
              setTriggerAnimation(true);
            }
          }
        }
      } catch (error) {
        console.error("Error fetching events:", error);
      }
    };

    checkEvents();
  }, [
    publicClient,
    deployedContractData?.address,
    blockNumber,
    playerChoice,
    gameState,
    currentGameId,
    address,
    gameStartTime,
    processedGames,
  ]);

  // Add more frequent polling when in waiting state
  useEffect(() => {
    if (gameState !== "waiting" || !currentGameId) return;

    const interval = setInterval(async () => {
      if (!publicClient || !deployedContractData?.address || !currentGameId) return;

      try {
        // Get GameCompleted events with a smaller range for faster response
        const gameCompletedLogs = await publicClient.getLogs({
          address: deployedContractData.address,
          event: {
            type: "event",
            name: "GameCompleted",
            inputs: [
              { name: "gameId", type: "uint256", indexed: true },
              { name: "player", type: "address", indexed: true },
              { name: "won", type: "bool", indexed: false },
              { name: "payout", type: "uint256", indexed: false },
            ],
          },
          fromBlock: blockNumber ? blockNumber - 10n : "latest", // Check only last 10 blocks for faster response
          toBlock: "latest",
        });

        // Look for our specific gameId
        const currentGameLog = gameCompletedLogs.find(log => {
          const gameId = log.args.gameId as bigint;
          const player = log.args.player as string;
          return gameId === currentGameId && player.toLowerCase() === address?.toLowerCase();
        });

        if (currentGameLog) {
          clearInterval(interval);

          const won = currentGameLog.args.won;
          const gameId = currentGameLog.args.gameId as bigint;

          const gameIdString = gameId.toString();

          // Prevent processing the same game result multiple times
          if (processedGames.has(gameIdString)) {
            return;
          }

          // Mark this game as processed
          setProcessedGames(prev => {
            const newSet = new Set(prev);
            newSet.add(gameIdString);
            return newSet;
          });

          // Process the game result
          let pythResult: RPSChoice;
          if (won) {
            if (playerChoice === "rock") pythResult = "scissors";
            else if (playerChoice === "paper") pythResult = "rock";
            else pythResult = "paper";
          } else {
            if (playerChoice === "rock") pythResult = "paper";
            else if (playerChoice === "paper") pythResult = "scissors";
            else pythResult = "rock";
          }

          setPythResult(pythResult);
          setBattleWinner(won ? "player" : "house");

          // Determine animation type based on result
          let newAnimationType: "rock_wins" | "paper_wins" | "scissors_wins";
          if (won) {
            if (playerChoice === "rock") newAnimationType = "rock_wins";
            else if (playerChoice === "paper") newAnimationType = "paper_wins";
            else newAnimationType = "scissors_wins";
          } else {
            if (pythResult === "rock") newAnimationType = "rock_wins";
            else if (pythResult === "paper") newAnimationType = "paper_wins";
            else newAnimationType = "scissors_wins";
          }

          setAnimationType(newAnimationType);
          setGameState("animating");
          setTriggerAnimation(true);
        }
      } catch (error) {
        console.error("Error in fast polling:", error);
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(interval);
  }, [
    gameState,
    currentGameId,
    publicClient,
    deployedContractData?.address,
    address,
    playerChoice,
    processedGames,
    blockNumber,
  ]);

  // Reset the resetAnimation flag after it's been used
  useEffect(() => {
    if (resetAnimation) {
      const timer = setTimeout(() => {
        setResetAnimation(false);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [resetAnimation]);

  // Handle waiting notification
  useEffect(() => {
    if (gameState === "waiting" && !waitingNotificationId) {
      // Show waiting notification
      const notificationId = notification.loading(
        <div className="text-center">
          <p className="text-blue-400 font-medium">Waiting for Pyth Entropy...</p>
          <p className="text-sm text-gray-500 mt-1">This may take a few seconds</p>
        </div>,
      );
      setWaitingNotificationId(notificationId);
    } else if (gameState !== "waiting" && waitingNotificationId) {
      // Hide waiting notification
      notification.remove(waitingNotificationId);
      setWaitingNotificationId(null);
    }
  }, [gameState, waitingNotificationId]);

  // Cleanup notification on unmount
  useEffect(() => {
    return () => {
      if (waitingNotificationId) {
        notification.remove(waitingNotificationId);
      }
    };
  }, [waitingNotificationId]);

  // Handle PYUSD approve
  const handleApprovePYUSD = async () => {
    if (!deployedContractData?.address) {
      alert("Contract not available");
      return;
    }

    try {
      await writePYUSDAsync({
        functionName: "approve",
        args: [deployedContractData.address, 2n ** 256n - 1n], // Max uint256
      });
      notification.success("PYUSD approved successfully!");
    } catch (error) {
      console.error("Error approving PYUSD:", error);
      alert(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  // Handle PYUSD drip (mint 420 PYUSD to user)
  const handleDripPYUSD = async () => {
    if (!pyusdContractData?.address) {
      alert("PYUSD contract not available");
      return;
    }

    try {
      await writePYUSDAsync({
        functionName: "mint",
        args: [address, parseUnits("420", 6)], // 420 PYUSD with 6 decimals
      });
      notification.success("420 PYUSD dripped successfully! 💧");
    } catch (error) {
      console.error("Error dripping PYUSD:", error);
      alert(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  // Handle betting
  const handleBet = async () => {
    if (!address || !playerChoice) {
      alert("Please select Rock, Paper, or Scissors first!");
      return;
    }

    try {
      // Reset ALL animation-related states before placing bet
      setGameState("betting");
      setCurrentGameId(null);
      setGameStartTime(Date.now());
      setProcessedGames(new Set()); // Clear processed games tracking
      setTriggerAnimation(false);
      setResetAnimation(false);
      setAnimationType("rock_wins"); // Reset to default
      setBattleWinner(null);
      setPythResult(null);

      // Generate random number for entropy
      const userRandomNumber = crypto.getRandomValues(new Uint8Array(32));
      const userRandomHex = `0x${Array.from(userRandomNumber)
        .map(b => b.toString(16).padStart(2, "0"))
        .join("")}`;

      if (betType === "PYUSD") {
        if (!pyusdContractData?.address || !pyusdTokenConfig) {
          alert("PYUSD token not available");
          setGameState("idle");
          return;
        }

        const betAmountWei = parseUnits(betAmount, 6); // PYUSD has 6 decimals

        if (betAmountWei < pyusdTokenConfig.minBet) {
          alert(`Minimum bet is ${formatUnits(pyusdTokenConfig.minBet, 6)} PYUSD`);
          setGameState("idle");
          return;
        }

        if (!pyusdBalance || pyusdBalance < betAmountWei) {
          alert("Insufficient PYUSD balance");
          setGameState("idle");
          return;
        }

        // Check if PYUSD is approved
        if (!pyusdAllowance || pyusdAllowance < betAmountWei) {
          alert("Please approve PYUSD spending first by clicking the 'Approve PYUSD' button");
          setGameState("idle");
          return;
        }

        // Play game with PYUSD
        const txResult = await writeSimpleRPSAsync({
          functionName: "playGameWithToken",
          args: [pyusdContractData.address, betAmountWei, userRandomHex as `0x${string}`],
          value: entropyFee, // Still need to pay entropy fee in ETH
        });

        // Get the gameId from the transaction receipt
        if (txResult && publicClient && deployedContractData?.address) {
          const receipt = await publicClient.waitForTransactionReceipt({ hash: txResult });

          // Find GameCreated event in the transaction logs
          const gameCreatedLog = receipt.logs.find(log => {
            // Check if this log is from our contract and has the right number of topics
            return log.address.toLowerCase() === deployedContractData.address.toLowerCase() && log.topics.length === 3; // GameCreated has 3 topics (event signature + 2 indexed params)
          });

          if (gameCreatedLog && gameCreatedLog.topics[1]) {
            // Decode the gameId from the first indexed parameter (gameId)
            const gameId = BigInt(gameCreatedLog.topics[1]);
            setCurrentGameId(gameId);
          }
        }

        setGameState("waiting");
      } else {
        if (!minBetEth) return;

        const betAmountWei = parseEther(betAmount); // ETH has 18 decimals

        if (betAmountWei < minBetEth) {
          alert(`Minimum bet is ${formatEther(minBetEth)} ETH`);
          setGameState("idle");
          return;
        }

        // Play game with ETH
        const txResult = await writeSimpleRPSAsync({
          functionName: "playGameWithETH",
          args: [userRandomHex as `0x${string}`],
          value: betAmountWei, // ETH value for ETH game
        });

        // Get the gameId from the transaction receipt
        if (txResult && publicClient && deployedContractData?.address) {
          const receipt = await publicClient.waitForTransactionReceipt({ hash: txResult });

          // Find GameCreated event in the transaction logs
          const gameCreatedLog = receipt.logs.find(log => {
            // Check if this log is from our contract and has the right number of topics
            return log.address.toLowerCase() === deployedContractData.address.toLowerCase() && log.topics.length === 3; // GameCreated has 3 topics (event signature + 2 indexed params)
          });

          if (gameCreatedLog && gameCreatedLog.topics[1]) {
            // Decode the gameId from the first indexed parameter (gameId)
            const gameId = BigInt(gameCreatedLog.topics[1]);
            setCurrentGameId(gameId);
          }
        }

        setGameState("waiting");
      }
    } catch (error) {
      console.error("Error placing bet:", error);
      alert(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
      setGameState("error");
    }
  };

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
        <h1 className="text-4xl font-bold mb-8">🎮 RPS Arena</h1>
        <p className="text-xl mb-4">Connect your wallet to play!</p>
      </div>
    );
  }

  const handleResetGame = () => {
    resetGameState();
    setCurrentScenario(prev => (prev + 1) % 2); // Cycle between 2 scenarios
  };

  const handleBattleComplete = () => {
    setGameState("completed");
    setTriggerAnimation(false); // Reset trigger to prevent re-animation
    // Don't reset resetAnimation here - keep it for next game
  };

  const handleScenarioChange = (scenario: number) => {
    setCurrentScenario(scenario);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-4xl font-bold mb-8">🎮 RPS Arena</h1>

      <div className="w-full max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Battle Arena */}
          <div className="order-2 lg:order-1">
            <BattleArena
              onBattleComplete={handleBattleComplete}
              triggerAnimation={triggerAnimation}
              animationType={animationType}
              currentScenario={currentScenario}
              resetAnimation={resetAnimation}
              onScenarioChange={handleScenarioChange}
              gameState={gameState}
            />
          </div>

          {/* Game Interface */}
          <div className="order-1 lg:order-2">
            <GameInterface
              gameState={gameState}
              playerChoice={playerChoice}
              betAmount={betAmount}
              betType={betType}
              battleWinner={battleWinner}
              pythResult={pythResult}
              minBetEth={minBetEth}
              entropyFee={entropyFee}
              winMultiplier={winMultiplier}
              commissionRate={commissionRate}
              winChance={winChance}
              isPending={isPending}
              pyusdBalance={pyusdBalance}
              pyusdTokenConfig={pyusdTokenConfig}
              pyusdAllowance={pyusdAllowance}
              onApprovePYUSD={handleApprovePYUSD}
              onDripPYUSD={handleDripPYUSD}
              onPlayerChoiceChange={setPlayerChoice}
              onBetAmountChange={setBetAmount}
              onBetTypeChange={setBetType}
              onBet={handleBet}
              onPlayAgain={handleResetGame}
              onTryAgain={handleResetGame}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
