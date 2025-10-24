"use client";

import { useEffect, useRef, useState } from "react";
import { INITIAL_BATTLE_FIELD, UnitPosition } from "../components/battleAnimations";
import { battleScenarios } from "../components/battleScenarios";

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

  setupInitialField(positions: UnitPosition[]) {
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

    // Debug: log drawing info every 30 frames
    if (this.units.length > 0) {
      console.log(`🎨 Drawing frame with ${this.units.length} units`);
    }

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

export default function AnimationTestPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simulationRef = useRef<BattleSimulation | null>(null);
  const [unitCounts, setUnitCounts] = useState({ rock: 0, paper: 0, scissors: 0 });
  const [selectedScenario, setSelectedScenario] = useState<BattleScenario>(battleScenarios.scenarios[0]);
  const [selectedPattern, setSelectedPattern] = useState<keyof BattleScenario["movementPatterns"]>("rock_wins");

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
      simulation.setupInitialField(INITIAL_BATTLE_FIELD);
      simulation.draw();
      simulationRef.current = simulation;
    }
  }, []);

  const startAnimation = () => {
    if (!simulationRef.current) return;

    console.log("🎮 Starting battle simulation with scenario:", selectedScenario.name, "pattern:", selectedPattern);

    // Reset and load selected scenario with pattern
    simulationRef.current.reset();
    simulationRef.current.loadScenario(selectedScenario, selectedPattern);

    // Start free movement immediately like in battle-simulation.html
    simulationRef.current.start();
  };

  const resetAnimation = () => {
    if (simulationRef.current) {
      simulationRef.current.reset();
      simulationRef.current.setupInitialField(INITIAL_BATTLE_FIELD);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-8">🎮 RPS Animation Test</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Canvas */}
          <div className="bg-gray-800 rounded-lg p-4">
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
              <p className="text-sm text-gray-400">🪨 Rock vs 📄 Paper vs ✂️ Scissors</p>
              <p className="text-xs text-gray-500 mt-1">Watch the deterministic battle unfold!</p>
            </div>
          </div>

          {/* Controls */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-2xl font-semibold mb-4 text-center">Battle Scenarios</h3>

            {/* Scenario Selection */}
            <div className="mb-6">
              <h4 className="text-lg font-medium mb-3">Choose Scenario:</h4>
              <div className="space-y-2">
                {battleScenarios.scenarios.map(scenario => (
                  <button
                    key={scenario.id}
                    onClick={() => setSelectedScenario(scenario)}
                    className={`w-full p-3 rounded-lg text-left transition-colors ${
                      selectedScenario.id === scenario.id
                        ? "bg-blue-600 text-white"
                        : "bg-gray-700 hover:bg-gray-600 text-gray-300"
                    }`}
                  >
                    <div className="font-medium">{scenario.name}</div>
                    <div className="text-sm opacity-75">{scenario.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Movement Pattern Selection */}
            <div className="mb-6">
              <h4 className="text-lg font-medium mb-3">Choose Movement Pattern:</h4>
              <div className="space-y-2">
                <button
                  onClick={() => setSelectedPattern("rock_wins")}
                  className={`w-full p-3 rounded-lg text-left transition-colors ${
                    selectedPattern === "rock_wins"
                      ? "bg-orange-600 text-white"
                      : "bg-gray-700 hover:bg-gray-600 text-gray-300"
                  }`}
                >
                  <div className="font-medium">🪨 Rock Wins</div>
                  <div className="text-sm opacity-75">Rock units dominate the battlefield</div>
                </button>
                <button
                  onClick={() => setSelectedPattern("paper_wins")}
                  className={`w-full p-3 rounded-lg text-left transition-colors ${
                    selectedPattern === "paper_wins"
                      ? "bg-yellow-600 text-white"
                      : "bg-gray-700 hover:bg-gray-600 text-gray-300"
                  }`}
                >
                  <div className="font-medium">📄 Paper Wins</div>
                  <div className="text-sm opacity-75">Paper units dominate the battlefield</div>
                </button>
                <button
                  onClick={() => setSelectedPattern("scissors_wins")}
                  className={`w-full p-3 rounded-lg text-left transition-colors ${
                    selectedPattern === "scissors_wins"
                      ? "bg-red-600 text-white"
                      : "bg-gray-700 hover:bg-gray-600 text-gray-300"
                  }`}
                >
                  <div className="font-medium">✂️ Scissors Wins</div>
                  <div className="text-sm opacity-75">Scissors units dominate the battlefield</div>
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-4">
              <button
                onClick={startAnimation}
                className="w-full px-6 py-4 bg-green-600 hover:bg-green-700 rounded-lg text-xl font-bold"
              >
                🎬 Start Battle
              </button>

              <button onClick={resetAnimation} className="w-full px-6 py-3 bg-gray-600 hover:bg-gray-700 rounded-lg">
                🔄 Reset
              </button>
            </div>

            <div className="mt-6 p-4 bg-gray-700 rounded">
              <h4 className="text-lg font-medium mb-2">Current Selection:</h4>
              <p className="text-sm text-gray-400">
                <strong>Scenario:</strong> {selectedScenario.name}
              </p>
              <p className="text-sm text-gray-400">
                <strong>Pattern:</strong> {selectedPattern.replace("_", " ").toUpperCase()}
              </p>
              <p className="text-sm text-gray-400 mt-1">Check console for detailed animation logs</p>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-gray-400">Open browser console (F12) to see detailed animation logs</p>
        </div>
      </div>
    </div>
  );
}
