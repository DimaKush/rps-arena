"use client";

import { useEffect, useState } from "react";
import GameInterface from "./GameInterface";
import { formatEther, parseEther } from "viem";
import { useAccount } from "wagmi";
import { useBlockNumber, usePublicClient } from "wagmi";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { useDeployedContractInfo } from "~~/hooks/scaffold-eth/useDeployedContractInfo";

type GameState = "idle" | "betting" | "waiting" | "completed" | "error";
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

  // Read contract data using Scaffold-ETH
  const { data: minBetEth } = useScaffoldReadContract({
    contractName: "SimpleRPS",
    functionName: "minBetETH",
    chainId: 11155420,
  });
  const publicClient = usePublicClient({ chainId: 11155420 });
  const { data: blockNumber } = useBlockNumber({ chainId: 11155420, watch: true });

  // Watch for events using manual polling
  useEffect(() => {
    if (!publicClient || !deployedContractData?.address || !blockNumber || !playerChoice) return;

    const checkEvents = async () => {
      try {
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
          fromBlock: blockNumber - 10n, // Check last 10 blocks
          toBlock: "latest",
        });

        if (gameCreatedLogs.length > 0) {
          const latestLog = gameCreatedLogs[gameCreatedLogs.length - 1];
          const gameId = latestLog.args.gameId as bigint;
          if (gameId) {
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
          fromBlock: blockNumber - 10n, // Check last 10 blocks
          toBlock: "latest",
        });

        if (gameCompletedLogs.length > 0) {
          const latestLog = gameCompletedLogs[gameCompletedLogs.length - 1];
          const won = latestLog.args.won;

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
          setGameState("completed");
        }
      } catch (error) {
        console.error("Error fetching events:", error);
      }
    };

    checkEvents();
  }, [publicClient, deployedContractData?.address, blockNumber, playerChoice]);

  // Handle betting
  const handleBet = async () => {
    if (!address || !playerChoice) {
      alert("Please select Rock, Paper, or Scissors first!");
      return;
    }

    try {
      setGameState("betting");

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
        await writeSimpleRPSAsync({
          functionName: "playGameWithETH",
          args: [userRandomHex as `0x${string}`],
          value: betAmountWei, // ETH value for ETH game
        });

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
    setGameState("idle");
    setBattleWinner(null);
    setPlayerChoice(null);
    setPythResult(null);
  };

  const handleTryAgain = () => {
    setGameState("idle");
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-4xl font-bold mb-8">🎮 RPS Arena</h1>

      <GameInterface
        gameState={gameState}
        playerChoice={playerChoice}
        betAmount={betAmount}
        betType={betType}
        battleWinner={battleWinner}
        pythResult={pythResult}
        minBetEth={minBetEth}
        isPending={isPending}
        onPlayerChoiceChange={setPlayerChoice}
        onBetAmountChange={setBetAmount}
        onBetTypeChange={setBetType}
        onBet={handleBet}
        onPlayAgain={handlePlayAgain}
        onTryAgain={handleTryAgain}
      />
    </div>
  );
}
