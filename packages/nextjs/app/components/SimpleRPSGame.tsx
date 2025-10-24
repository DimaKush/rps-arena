"use client";

import { useEffect, useState } from "react";
import BattleArena from "./BattleArena";
import GameInterface from "./GameInterface";
import { formatEther, parseEther } from "viem";
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
  const { data: deployedContractData } = useDeployedContractInfo({ contractName: "SimpleRPS", chainId: 11155420 });

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
      console.log("🔍 Event polling skipped:", {
        publicClient: !!publicClient,
        address: !!deployedContractData?.address,
        blockNumber,
        playerChoice,
        gameState,
      });
      return;
    }

    // Don't poll events if we're in idle state and have no current game
    if (gameState === "idle" && currentGameId === null) {
      console.log("🔍 Event polling skipped - idle state with no current game");
      return;
    }

    // Don't poll events if we're in betting state (just started new game)
    if (gameState === "betting") {
      console.log("🔍 Event polling skipped - betting state, waiting for transaction");
      return;
    }

    console.log("🔍 Starting event polling for gameState:", gameState);

    const checkEvents = async () => {
      try {
        console.log("🔍 Checking events - current block:", blockNumber, "checking from block:", blockNumber - 50n);

        // Get GameCreated events
        const gameCreatedLogs = await publicClient.getLogs({
          address: deployedContractData.address,
          event: {
            type: "event",
            name: "GameCreated",
            inputs: [
              { name: "gameId", type: "uint256", indexed: true },
              { name: "player", type: "address", indexed: true },
              { name: "betAmount", type: "uint256", indexed: false },
              { name: "tokenAddress", type: "address", indexed: false },
            ],
          },
          fromBlock: blockNumber - 50n, // Check last 50 blocks for Pyth delay
          toBlock: "latest",
        });

        if (gameCreatedLogs.length > 0) {
          const latestLog = gameCreatedLogs[gameCreatedLogs.length - 1];
          const gameId = latestLog.args.gameId as bigint;
          console.log("🎮 GameCreated event found:", { gameId, currentGameState: gameState, currentGameId });
          if (gameId && gameState === "waiting" && gameId !== currentGameId) {
            console.log("⏳ Setting game state to waiting, setting currentGameId");
            setCurrentGameId(gameId);
            setGameState("waiting");
          }
        }

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
          fromBlock: blockNumber - 50n, // Check last 50 blocks for Pyth delay
          toBlock: "latest",
        });

        console.log("📋 GameCompleted logs found:", gameCompletedLogs.length);

        if (gameCompletedLogs.length > 0) {
          const latestLog = gameCompletedLogs[gameCompletedLogs.length - 1];
          const won = latestLog.args.won;
          const gameId = latestLog.args.gameId as bigint;
          console.log("🏁 GameCompleted event found:", {
            won,
            currentGameState: gameState,
            logBlock: latestLog.blockNumber,
            gameId,
            currentGameId,
          });

          // Additional debugging
          console.log("🔍 GameCompleted conditions check:", {
            gameState,
            gameId,
            currentGameId,
            gameIdEqualsCurrent: gameId === currentGameId,
            currentGameIdNotNull: currentGameId !== null,
            shouldProcess: gameState === "waiting" && gameId === currentGameId && currentGameId !== null,
          });

          if (gameState === "waiting" && gameId === currentGameId && currentGameId !== null) {
            console.log("🎯 Processing current game result:", { gameId, currentGameId });
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

            console.log("🎯 Game result:", { playerChoice, pythResult, won });

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

            console.log("🎬 Starting animation with type:", newAnimationType);
            setAnimationType(newAnimationType);
            setGameState("animating");
            setTriggerAnimation(true);
          }
        }
      } catch (error) {
        console.error("Error fetching events:", error);
      }
    };

    checkEvents();
  }, [publicClient, deployedContractData?.address, blockNumber, playerChoice, gameState, currentGameId]);

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

  // Handle betting
  const handleBet = async () => {
    if (!address || !playerChoice) {
      alert("Please select Rock, Paper, or Scissors first!");
      return;
    }

    console.log("🎯 Placing bet:", { playerChoice, betAmount, betType, gameState });

    try {
      // Reset ALL animation-related states before placing bet
      console.log("🎯 handleBet: Resetting states before bet", { currentGameId, gameState });
      setGameState("betting");
      setCurrentGameId(null);
      setTriggerAnimation(false);
      setResetAnimation(false);
      setAnimationType("rock_wins"); // Reset to default
      console.log("⏳ Game state set to betting, reset all animation states");

      // Generate random number for entropy
      const userRandomNumber = crypto.getRandomValues(new Uint8Array(32));
      const userRandomHex = `0x${Array.from(userRandomNumber)
        .map(b => b.toString(16).padStart(2, "0"))
        .join("")}`;

      if (betType === "PYUSD") {
        alert("PYUSD betting not implemented yet. Please use ETH.");
        setGameState("idle");
        return;
      } else {
        if (!minBetEth) return;

        const betAmountWei = parseEther(betAmount); // ETH has 18 decimals

        if (betAmountWei < minBetEth) {
          alert(`Minimum bet is ${formatEther(minBetEth)} ETH`);
          setGameState("idle");
          return;
        }

        // Play game with ETH
        console.log("🚀 Calling playGameWithETH contract function");
        await writeSimpleRPSAsync({
          functionName: "playGameWithETH",
          args: [userRandomHex as `0x${string}`],
          value: betAmountWei, // ETH value for ETH game
        });

        console.log("✅ Contract call successful, setting state to waiting");
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

  const handlePlayAgain = () => {
    console.log("🔄 Play Again clicked - resetting game state", { currentGameId, gameState });
    setGameState("idle");
    setBattleWinner(null);
    setPlayerChoice(null);
    setPythResult(null);
    setTriggerAnimation(false);
    setResetAnimation(true);
    setCurrentGameId(null);
    setCurrentScenario(prev => (prev + 1) % 3); // Cycle between 3 scenarios
    setAnimationType("rock_wins"); // Reset animation type
    // Clear any waiting notification
    if (waitingNotificationId) {
      notification.remove(waitingNotificationId);
      setWaitingNotificationId(null);
    }
    console.log("✅ Game state reset to idle");
  };

  const handleTryAgain = () => {
    console.log("🔄 Try Again clicked - resetting game state");
    setGameState("idle");
    setTriggerAnimation(false);
    setResetAnimation(true);
    setCurrentGameId(null);
    // Reset all animation-related states
    setBattleWinner(null);
    setPythResult(null);
    setPlayerChoice(null); // Also reset player choice
    setAnimationType("rock_wins");
    // Clear any waiting notification
    if (waitingNotificationId) {
      notification.remove(waitingNotificationId);
      setWaitingNotificationId(null);
    }
    console.log("✅ Game state reset to idle");
  };

  const handleBattleComplete = (winner: string) => {
    console.log("Battle animation complete, winner:", winner);
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
              isPending={isPending}
              onPlayerChoiceChange={setPlayerChoice}
              onBetAmountChange={setBetAmount}
              onBetTypeChange={setBetType}
              onBet={handleBet}
              onPlayAgain={handlePlayAgain}
              onTryAgain={handleTryAgain}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
