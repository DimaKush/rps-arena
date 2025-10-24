"use client";

import { useEffect, useRef, useState } from "react";
import { battleScenarios } from "./battleScenarios";

interface BattleScenario {
  id: string;
  name: string;
  description: string;
  expectedWinner: string;
  initialPositions: Array<{ x: number; y: number; type: string }>;
  movementPatterns: {
    rock_wins: {
      rock: { vx: number; vy: number };
      paper: { vx: number; vy: number };
      scissors: { vx: number; vy: number };
      expectedWinner: string;
    };
    paper_wins: {
      rock: { vx: number; vy: number };
      paper: { vx: number; vy: number };
      scissors: { vx: number; vy: number };
      expectedWinner: string;
    };
    scissors_wins: {
      rock: { vx: number; vy: number };
      paper: { vx: number; vy: number };
      scissors: { vx: number; vy: number };
      expectedWinner: string;
    };
  };
}

// Unit class for battle simulation
class Unit {
  x: number;
  y: number;
  type: string;
  vx: number;
  vy: number;
  size: number;
  speed: number;
  startX?: number;
  startY?: number;

  constructor(x: number, y: number, type: string, vx?: number, vy?: number) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.vx = vx || 0;
    this.vy = vy || 0;
    this.size = 8;
    this.speed = 3;
  }

  update(canvas: HTMLCanvasElement) {
    // NO RANDOM MOVEMENT - only deterministic movement
    this.x += this.vx * this.speed;
    this.y += this.vy * this.speed;

    // Bounce off walls
    if (this.x <= this.size || this.x >= canvas.width - this.size) {
      this.vx *= -1;
    }
    if (this.y <= this.size || this.y >= canvas.height - this.size) {
      this.vy *= -1;
    }

    // Keep in bounds
    this.x = Math.max(this.size, Math.min(canvas.width - this.size, this.x));
    this.y = Math.max(this.size, Math.min(canvas.height - this.size, this.y));
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.beginPath();

    if (this.type === "rock") {
      // Rock - brown circle with gradient
      const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size);
      gradient.addColorStop(0, "#A0522D");
      gradient.addColorStop(1, "#8B4513");
      ctx.fillStyle = gradient;
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    } else if (this.type === "paper") {
      // Paper - golden rectangle with gradient
      const gradient = ctx.createLinearGradient(
        this.x - this.size,
        this.y - this.size,
        this.x + this.size,
        this.y + this.size,
      );
      gradient.addColorStop(0, "#FFD700");
      gradient.addColorStop(1, "#DAA520");
      ctx.fillStyle = gradient;
      ctx.fillRect(this.x - this.size, this.y - this.size, this.size * 2, this.size * 2);
    } else if (this.type === "scissors") {
      // Scissors - red triangle with gradient
      const gradient = ctx.createLinearGradient(this.x, this.y - this.size, this.x, this.y + this.size);
      gradient.addColorStop(0, "#FF6347");
      gradient.addColorStop(1, "#DC143C");
      ctx.fillStyle = gradient;
      ctx.moveTo(this.x, this.y - this.size);
      ctx.lineTo(this.x - this.size, this.y + this.size);
      ctx.lineTo(this.x + this.size, this.y + this.size);
      ctx.closePath();
    }

    ctx.fill();

    // Add glow effect
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.shadowColor = this.type === "rock" ? "#8B4513" : this.type === "paper" ? "#DAA520" : "#DC143C";
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  collidesWith(other: Unit) {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < this.size + other.size;
  }

  convertTo(newType: string) {
    this.type = newType;
  }
}

class BattleSimulation {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  units: Unit[];
  isRunning: boolean;
  winner: string | null;
  animationId: number | null;
  onUnitCountUpdate?: (counts: { [key: string]: number }) => void;
  onBattleComplete?: (winner: string) => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.units = [];
    this.isRunning = false;
    this.winner = null;
    this.animationId = null;
  }

  addUnit(x: number, y: number, type: string, vx?: number, vy?: number) {
    this.units.push(new Unit(x, y, type, vx, vy));
  }

  setupInitialField(positions: Array<{ x: number; y: number; type: string }>) {
    this.units = [];
    positions.forEach(pos => {
      this.addUnit(pos.x, pos.y, pos.type);
    });
  }

  loadScenario(scenario: BattleScenario, movementPattern: keyof BattleScenario["movementPatterns"] = "rock_wins") {
    this.units = [];
    const pattern = scenario.movementPatterns[movementPattern];
    scenario.initialPositions.forEach(pos => {
      const unitPattern = pattern[pos.type as "rock" | "paper" | "scissors"];
      this.addUnit(pos.x, pos.y, pos.type, unitPattern.vx, unitPattern.vy);
    });
  }

  start() {
    if (this.units.length === 0) {
      console.log("No units to start battle!");
      return;
    }

    this.isRunning = true;
    this.winner = null;
    console.log("🎮 Starting battle with", this.units.length, "units");
    this.gameLoop();
  }

  checkCollisions() {
    for (let i = 0; i < this.units.length; i++) {
      for (let j = i + 1; j < this.units.length; j++) {
        const unit1 = this.units[i];
        const unit2 = this.units[j];

        if (unit1.collidesWith(unit2)) {
          this.handleCollision(unit1, unit2);
        }
      }
    }
  }

  handleCollision(unit1: Unit, unit2: Unit) {
    if (unit1.type === "rock" && unit2.type === "scissors") {
      unit2.convertTo("rock");
    } else if (unit1.type === "scissors" && unit2.type === "paper") {
      unit2.convertTo("scissors");
    } else if (unit1.type === "paper" && unit2.type === "rock") {
      unit2.convertTo("paper");
    } else if (unit2.type === "rock" && unit1.type === "scissors") {
      unit1.convertTo("rock");
    } else if (unit2.type === "scissors" && unit1.type === "paper") {
      unit1.convertTo("scissors");
    } else if (unit2.type === "paper" && unit1.type === "rock") {
      unit1.convertTo("paper");
    }

    const dx = unit1.x - unit2.x;
    const dy = unit1.y - unit2.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const overlap = unit1.size + unit2.size - distance;

    if (overlap > 0) {
      const separationX = (dx / distance) * overlap * 0.5;
      const separationY = (dy / distance) * overlap * 0.5;

      unit1.x += separationX;
      unit1.y += separationY;
      unit2.x -= separationX;
      unit2.y -= separationY;
    }
  }

  checkWinner() {
    const types = ["rock", "paper", "scissors"];
    const counts: { [key: string]: number } = {};

    types.forEach(type => {
      counts[type] = this.units.filter(unit => unit.type === type).length;
    });

    // Update unit counts for display
    if (this.onUnitCountUpdate) {
      this.onUnitCountUpdate(counts);
    }

    const nonZeroTypes = types.filter(type => counts[type] > 0);
    if (nonZeroTypes.length === 1) {
      this.winner = nonZeroTypes[0];
      this.isRunning = false;
      if (this.onBattleComplete) {
        this.onBattleComplete(this.winner);
      }
      return true;
    }
    return false;
  }

  update() {
    if (!this.isRunning) return;

    // Free movement like in battle-simulation.html
    this.units.forEach(unit => unit.update(this.canvas));
    this.checkCollisions();

    if (this.checkWinner()) {
      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
      }
      return;
    }
  }

  draw() {
    // Clear canvas with gradient background
    const gradient = this.ctx.createLinearGradient(0, 0, this.canvas.width, this.canvas.height);
    gradient.addColorStop(0, "#1a1a2e");
    gradient.addColorStop(1, "#16213e");
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw grid
    this.ctx.strokeStyle = "#333";
    this.ctx.lineWidth = 1;
    for (let x = 0; x < this.canvas.width; x += 50) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.canvas.height);
      this.ctx.stroke();
    }
    for (let y = 0; y < this.canvas.height; y += 50) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.canvas.width, y);
      this.ctx.stroke();
    }

    // Draw units
    this.units.forEach(unit => unit.draw(this.ctx));

    // Draw winner announcement
    if (this.winner) {
      this.ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      this.ctx.fillStyle = "#fff";
      this.ctx.font = "bold 32px Arial";
      this.ctx.textAlign = "center";
      this.ctx.fillText(`${this.winner.toUpperCase()} WINS!`, this.canvas.width / 2, this.canvas.height / 2);
    }
  }

  gameLoop() {
    this.update();
    this.draw();

    if (this.isRunning) {
      this.animationId = requestAnimationFrame(() => this.gameLoop());
    }
  }

  reset() {
    this.isRunning = false;
    this.winner = null;
    this.units = [];

    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    this.draw();
  }
}

interface BattleArenaProps {
  onBattleComplete?: (winner: string) => void;
  triggerAnimation?: boolean;
  animationType?: "rock_wins" | "paper_wins" | "scissors_wins";
  currentScenario?: number;
  resetAnimation?: boolean;
  onScenarioChange?: (scenario: number) => void;
  gameState?: string;
}

export default function BattleArena({
  onBattleComplete,
  triggerAnimation = false,
  animationType = "rock_wins",
  currentScenario = 0,
  resetAnimation = false,
  onScenarioChange,
  gameState = "idle",
}: BattleArenaProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simulationRef = useRef<BattleSimulation | null>(null);
  const [unitCounts, setUnitCounts] = useState({ rock: 0, paper: 0, scissors: 0 });
  const [isAnimating, setIsAnimating] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);

  // Initialize simulation
  useEffect(() => {
    if (canvasRef.current && !simulationRef.current) {
      console.log("🎮 Initializing battle simulation");
      const simulation = new BattleSimulation(canvasRef.current);
      simulation.onUnitCountUpdate = counts => {
        setUnitCounts({
          rock: counts.rock || 0,
          paper: counts.paper || 0,
          scissors: counts.scissors || 0,
        });
      };
      simulation.onBattleComplete = winner => {
        console.log("🎉 Battle complete! Winner:", winner);
        setIsAnimating(false);
        // Keep the final battle state - don't reset units
        if (onBattleComplete) {
          onBattleComplete(winner);
        }
      };
      simulationRef.current = simulation;
    }
  }, [onBattleComplete]);

  // Load initial scenario only when scenario changes and not animating and not hasAnimated
  useEffect(() => {
    if (simulationRef.current && !isAnimating && !triggerAnimation && !hasAnimated) {
      const scenario = battleScenarios.scenarios[currentScenario % battleScenarios.scenarios.length];
      simulationRef.current.loadScenario(scenario, "rock_wins"); // Default to rock_wins for initial display
      simulationRef.current.draw();
    }
  }, [currentScenario, isAnimating, triggerAnimation, hasAnimated]);

  // Trigger animation when needed
  useEffect(() => {
    console.log("🎬 Animation trigger check:", {
      triggerAnimation,
      isAnimating,
      hasAnimated,
      gameState,
      animationType,
      currentScenario,
    });

    // STRICT CONDITIONS: Only trigger if ALL conditions are met
    if (
      triggerAnimation &&
      simulationRef.current &&
      !isAnimating &&
      !hasAnimated &&
      gameState === "animating" &&
      animationType && // Ensure animationType is set
      currentScenario >= 0
    ) {
      // Ensure valid scenario

      console.log("🎬 Starting animation with type:", animationType);
      console.log("🎬 Animation conditions:", {
        triggerAnimation,
        isAnimating,
        hasAnimated,
        animationType,
        currentScenario,
        gameState,
      });

      setIsAnimating(true);
      setHasAnimated(true);
      const scenario = battleScenarios.scenarios[currentScenario % battleScenarios.scenarios.length];
      simulationRef.current.loadScenario(scenario, animationType);
      simulationRef.current.start();
    } else {
      console.log("🎬 Animation NOT triggered - conditions not met:", {
        triggerAnimation,
        simulationRef: !!simulationRef.current,
        isAnimating,
        hasAnimated,
        gameState,
        animationType,
        currentScenario,
      });
    }
  }, [triggerAnimation, animationType, currentScenario, isAnimating, hasAnimated, gameState]);

  // Reset animation state when needed
  useEffect(() => {
    if (resetAnimation) {
      console.log("🔄 Resetting animation state");
      setHasAnimated(false);
      setIsAnimating(false);
      // Reset simulation and load new scenario
      if (simulationRef.current) {
        simulationRef.current.reset(); // Clear winner and reset state
        const scenario = battleScenarios.scenarios[currentScenario % battleScenarios.scenarios.length];
        simulationRef.current.loadScenario(scenario, "rock_wins");
        simulationRef.current.draw();
        console.log("✅ Animation state reset, loaded scenario:", scenario.name);
      }
    }
  }, [resetAnimation, currentScenario]);

  // Reset animation state when gameState becomes idle (Play Again clicked)
  useEffect(() => {
    if (gameState === "idle" && resetAnimation) {
      console.log("🔄 Game reset - clearing all animation state");
      setHasAnimated(false);
      setIsAnimating(false);
      // Reset simulation and load fresh scenario
      if (simulationRef.current) {
        simulationRef.current.reset(); // Clear winner and reset state
        const scenario = battleScenarios.scenarios[currentScenario % battleScenarios.scenarios.length];
        simulationRef.current.loadScenario(scenario, "rock_wins");
        simulationRef.current.draw();
        console.log("✅ Fresh scenario loaded:", scenario.name);
      }
    }
  }, [gameState, resetAnimation, currentScenario]);

  // Reset hasAnimated when resetAnimation is true
  useEffect(() => {
    if (resetAnimation) {
      console.log("🔄 Reset animation triggered, resetting hasAnimated");
      setHasAnimated(false);
    }
  }, [resetAnimation]);

  const shuffleScenario = () => {
    if (simulationRef.current && !isAnimating && !triggerAnimation && !hasAnimated) {
      const nextScenario = (currentScenario + 1) % battleScenarios.scenarios.length;
      const scenario = battleScenarios.scenarios[nextScenario];
      simulationRef.current.loadScenario(scenario, "rock_wins");
      simulationRef.current.draw();
      // Notify parent component about scenario change
      if (onScenarioChange) {
        onScenarioChange(nextScenario);
      }
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 mb-6">
      <h3 className="text-2xl font-semibold mb-4 text-center">Battle Arena</h3>

      {/* Unit Counters */}
      <div className="flex justify-around mb-4 p-4 bg-gray-700 rounded">
        <div className="text-center">
          <div className="text-orange-500 font-bold">🪨 Rock: {unitCounts.rock}</div>
        </div>
        <div className="text-center">
          <div className="text-yellow-500 font-bold">📄 Paper: {unitCounts.paper}</div>
        </div>
        <div className="text-center">
          <div className="text-red-500 font-bold">✂️ Scissors: {unitCounts.scissors}</div>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={600}
        height={400}
        className="w-full h-96 border-2 border-gray-600 rounded-md mx-auto block"
        style={{ maxWidth: "600px", maxHeight: "400px" }}
      />

      <div className="mt-4 text-center">
        <button
          onClick={shuffleScenario}
          disabled={isAnimating || triggerAnimation || hasAnimated}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-bold rounded-md transition-colors"
        >
          🔀 Shuffle
        </button>
      </div>
    </div>
  );
}
