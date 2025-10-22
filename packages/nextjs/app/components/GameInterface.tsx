"use client";

import { useState } from "react";
import { formatEther, formatUnits } from "viem";
import { useBalance } from "wagmi";
import { EtherInput } from "~~/components/scaffold-eth";

// PYUSD token address on Optimism Sepolia
const PYUSD_ADDRESS = "0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9";

type GameState = "idle" | "betting" | "waiting" | "completed" | "error";
type RPSChoice = "rock" | "paper" | "scissors";

interface GameInterfaceProps {
  gameState: GameState;
  playerChoice: RPSChoice | null;
  betAmount: string;
  betType: "ETH" | "PYUSD";
  battleWinner: string | null;
  pythResult: RPSChoice | null;
  minBetEth: bigint | undefined;
  isPending: boolean;
  onPlayerChoiceChange: (choice: RPSChoice) => void;
  onBetAmountChange: (amount: string) => void;
  onBetTypeChange: (type: "ETH" | "PYUSD") => void;
  onBet: () => void;
  onPlayAgain: () => void;
  onTryAgain: () => void;
}

export default function GameInterface({
  gameState,
  playerChoice,
  betAmount,
  betType,
  battleWinner,
  pythResult,
  minBetEth,
  isPending,
  onPlayerChoiceChange,
  onBetAmountChange,
  onBetTypeChange,
  onBet,
  onPlayAgain,
  onTryAgain,
}: GameInterfaceProps) {
  const { data: pyusdBalance } = useBalance({
    address: undefined, // Will be set by parent
    token: PYUSD_ADDRESS as `0x${string}`,
  });

  return (
    <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md mb-8">
      <h2 className="text-2xl font-semibold mb-4">Simple RPS Game</h2>

      <div className="mb-4">
        <p className="text-sm text-gray-400 mb-2">
          PYUSD Balance: {pyusdBalance ? formatUnits(pyusdBalance.value, 6) : "0"} PYUSD
        </p>
        <p className="text-sm text-gray-400">Min Bet ETH: {minBetEth ? formatEther(minBetEth) : "0.001"} ETH</p>
      </div>

      {gameState === "idle" && (
        <div>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Choose Your Weapon</label>
            <div className="flex space-x-4 justify-center">
              <button
                onClick={() => onPlayerChoiceChange("rock")}
                className={`px-4 py-2 rounded-md border-2 transition-colors ${
                  playerChoice === "rock"
                    ? "border-yellow-400 bg-yellow-400/20"
                    : "border-gray-600 hover:border-gray-400"
                }`}
              >
                🪨 Rock
              </button>
              <button
                onClick={() => onPlayerChoiceChange("paper")}
                className={`px-4 py-2 rounded-md border-2 transition-colors ${
                  playerChoice === "paper"
                    ? "border-yellow-400 bg-yellow-400/20"
                    : "border-gray-600 hover:border-gray-400"
                }`}
              >
                📄 Paper
              </button>
              <button
                onClick={() => onPlayerChoiceChange("scissors")}
                className={`px-4 py-2 rounded-md border-2 transition-colors ${
                  playerChoice === "scissors"
                    ? "border-yellow-400 bg-yellow-400/20"
                    : "border-gray-600 hover:border-gray-400"
                }`}
              >
                ✂️ Scissors
              </button>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Bet Type</label>
            <div className="flex space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="ETH"
                  checked={betType === "ETH"}
                  onChange={e => onBetTypeChange(e.target.value as "ETH" | "PYUSD")}
                  className="mr-2"
                />
                ETH
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="PYUSD"
                  checked={betType === "PYUSD"}
                  onChange={e => onBetTypeChange(e.target.value as "ETH" | "PYUSD")}
                  className="mr-2"
                />
                PYUSD
              </label>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Bet Amount ({betType})</label>
            {betType === "ETH" ? (
              <EtherInput value={betAmount} onChange={value => onBetAmountChange(value)} placeholder="0.001" />
            ) : (
              <input
                type="number"
                value={betAmount}
                onChange={e => onBetAmountChange(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                placeholder="1"
                min="1"
                step="0.1"
              />
            )}
          </div>

          <button
            onClick={onBet}
            disabled={isPending || !playerChoice}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-bold py-2 px-4 rounded-md transition-colors"
          >
            {isPending ? "Processing..." : "Place Bet"}
          </button>
        </div>
      )}

      {gameState === "betting" && (
        <div className="text-center">
          <p className="text-yellow-400">Processing bet...</p>
        </div>
      )}

      {gameState === "waiting" && (
        <div className="text-center">
          <p className="text-blue-400">Waiting for Pyth Entropy...</p>
          <p className="text-sm text-gray-400 mt-2">This may take a few seconds</p>
        </div>
      )}

      {gameState === "completed" && (
        <div className="text-center">
          <p
            className={`text-2xl font-bold ${
              battleWinner === "player"
                ? "text-green-400"
                : battleWinner === "draw"
                  ? "text-yellow-400"
                  : "text-red-400"
            }`}
          >
            {battleWinner === "player" ? "🎉 You Won!" : battleWinner === "draw" ? "🤝 It's a Draw!" : "😔 You Lost"}
          </p>
          <p className="text-sm text-gray-400 mt-2">
            You chose: {playerChoice?.toUpperCase()} | PYTH chose: {pythResult?.toUpperCase()}
          </p>
          <p className="text-sm text-gray-400">
            {battleWinner === "player"
              ? "2x payout incoming!"
              : battleWinner === "draw"
                ? "Your bet is returned!"
                : "Better luck next time!"}
          </p>
          <button
            onClick={onPlayAgain}
            className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition-colors"
          >
            Play Again
          </button>
        </div>
      )}

      {gameState === "error" && (
        <div className="text-center">
          <p className="text-red-400">Something went wrong!</p>
          <button
            onClick={onTryAgain}
            className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition-colors"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
