"use client";

import { formatEther, formatUnits, parseEther } from "viem";
import { useBalance } from "wagmi";
import { EtherInput } from "~~/components/scaffold-eth";

// Helper function to format ETH with limited decimal places
const formatEthWithDecimals = (value: bigint, decimals: number = 6) => {
  const formatted = formatEther(value);
  const num = parseFloat(formatted);
  return num.toFixed(decimals);
};

// Helper function to calculate winnings
const calculateWinnings = (betAmount: string, winMultiplier: bigint | undefined) => {
  if (!winMultiplier) return "0";
  const betAmountWei = parseEther(betAmount);
  const winningsWei = betAmountWei * winMultiplier;
  return formatEthWithDecimals(winningsWei);
};

// PYUSD token address on Optimism Sepolia
const PYUSD_ADDRESS = "0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9";

type GameState = "idle" | "betting" | "waiting" | "animating" | "completed" | "error";
type RPSChoice = "rock" | "paper" | "scissors";

interface GameInterfaceProps {
  gameState: GameState;
  playerChoice: RPSChoice | null;
  betAmount: string;
  betType: "ETH" | "PYUSD";
  battleWinner: string | null;
  pythResult: RPSChoice | null;
  minBetEth: bigint | undefined;
  entropyFee: bigint;
  winMultiplier: bigint | undefined;
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
  entropyFee,
  winMultiplier,
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
      <div className="mb-4">
        <p className="text-sm text-gray-400 mb-2">
          PYUSD Balance: {pyusdBalance ? formatUnits(pyusdBalance.value, 6) : "0"} PYUSD
        </p>
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
              <div className="relative">
                <EtherInput value={betAmount} onChange={value => onBetAmountChange(value)} placeholder="0.001" />
                {betAmount && minBetEth && entropyFee && parseEther(betAmount) < minBetEth + entropyFee && (
                  <div className="absolute top-full left-0 mt-1 p-2 bg-yellow-600 text-white text-xs rounded shadow-lg z-10 max-w-xs">
                    ⚠️ Minimum bet: {formatEthWithDecimals(minBetEth + entropyFee)} ETH (includes{" "}
                    {formatEthWithDecimals(entropyFee)} ETH entropy fee)
                  </div>
                )}
              </div>
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
          <div className="mb-4 p-3 bg-gray-700 rounded">
            <p className="text-sm text-gray-300 mb-2">Your Choice:</p>
            <p className="text-lg font-semibold text-yellow-400">
              {playerChoice === "rock" && "🪨 Rock"}
              {playerChoice === "paper" && "📄 Paper"}
              {playerChoice === "scissors" && "✂️ Scissors"}
            </p>
          </div>
          <p className="text-yellow-400">Processing bet...</p>
        </div>
      )}

      {gameState === "animating" && (
        <div className="text-center">
          <div className="mb-4 p-3 bg-gray-700 rounded">
            <p className="text-sm text-gray-300 mb-2">Your Choice:</p>
            <p className="text-lg font-semibold text-yellow-400">
              {playerChoice === "rock" && "🪨 Rock"}
              {playerChoice === "paper" && "📄 Paper"}
              {playerChoice === "scissors" && "✂️ Scissors"}
            </p>
          </div>
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
              ? `You won ${calculateWinnings(betAmount, winMultiplier)} ETH!`
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
