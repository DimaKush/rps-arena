export type UnitType = "rock" | "paper" | "scissors";
export interface UnitPosition {
  x: number;
  y: number;
  type: "rock" | "paper" | "scissors";
}

export interface BattleAnimation {
  name: string;
  description: string;
  initialPositions: UnitPosition[];
  movements: UnitMovement[];
}

export interface UnitMovement {
  unitIndex: number;
  targetX: number;
  targetY: number;
  duration: number; // in frames
}

// Initial battle field setup - 3 units of each type
export const INITIAL_BATTLE_FIELD: UnitPosition[] = [
  // Rock units
  { x: 100, y: 100, type: "rock" },
  { x: 150, y: 200, type: "rock" },
  { x: 200, y: 300, type: "rock" },

  // Paper units
  { x: 400, y: 100, type: "paper" },
  { x: 450, y: 200, type: "paper" },
  { x: 500, y: 300, type: "paper" },

  // Scissors units
  { x: 250, y: 150, type: "scissors" },
  { x: 300, y: 250, type: "scissors" },
  { x: 350, y: 350, type: "scissors" },
];

// Animation 1: Rock wins (beats scissors, loses to paper)
export const ROCK_WINS_ANIMATION: BattleAnimation = {
  name: "rock_wins",
  description: "Rock units dominate and convert scissors to rock",
  initialPositions: INITIAL_BATTLE_FIELD,
  movements: [
    // Rock units move towards scissors (aggressive)
    { unitIndex: 0, targetX: 250, targetY: 150, duration: 60 }, // Rock 1 -> Scissors 1
    { unitIndex: 1, targetX: 300, targetY: 250, duration: 60 }, // Rock 2 -> Scissors 2
    { unitIndex: 2, targetX: 350, targetY: 350, duration: 60 }, // Rock 3 -> Scissors 3

    // Paper units move to center (defensive, they beat rock)
    { unitIndex: 3, targetX: 300, targetY: 200, duration: 50 }, // Paper 1 -> center
    { unitIndex: 4, targetX: 350, targetY: 150, duration: 50 }, // Paper 2 -> center
    { unitIndex: 5, targetX: 400, targetY: 250, duration: 50 }, // Paper 3 -> center

    // Scissors units try to fight back but lose (defensive)
    { unitIndex: 6, targetX: 200, targetY: 100, duration: 40 }, // Scissors 1 -> defensive position
    { unitIndex: 7, targetX: 250, targetY: 200, duration: 40 }, // Scissors 2 -> defensive position
    { unitIndex: 8, targetX: 300, targetY: 300, duration: 40 }, // Scissors 3 -> defensive position
  ],
};

// Animation 2: Paper wins (beats rock, loses to scissors)
export const PAPER_WINS_ANIMATION: BattleAnimation = {
  name: "paper_wins",
  description: "Paper units dominate and convert rock to paper",
  initialPositions: INITIAL_BATTLE_FIELD,
  movements: [
    // Paper units move towards rock (aggressive)
    { unitIndex: 3, targetX: 100, targetY: 100, duration: 60 }, // Paper 1 -> Rock 1
    { unitIndex: 4, targetX: 150, targetY: 200, duration: 60 }, // Paper 2 -> Rock 2
    { unitIndex: 5, targetX: 200, targetY: 300, duration: 60 }, // Paper 3 -> Rock 3

    // Scissors units move to center (defensive, they beat paper)
    { unitIndex: 6, targetX: 300, targetY: 200, duration: 50 }, // Scissors 1 -> center
    { unitIndex: 7, targetX: 350, targetY: 150, duration: 50 }, // Scissors 2 -> center
    { unitIndex: 8, targetX: 400, targetY: 250, duration: 50 }, // Scissors 3 -> center

    // Rock units try to fight back but lose (defensive)
    { unitIndex: 0, targetX: 200, targetY: 100, duration: 40 }, // Rock 1 -> defensive position
    { unitIndex: 1, targetX: 250, targetY: 200, duration: 40 }, // Rock 2 -> defensive position
    { unitIndex: 2, targetX: 300, targetY: 300, duration: 40 }, // Rock 3 -> defensive position
  ],
};

// Animation 3: Scissors wins (beats paper, loses to rock)
export const SCISSORS_WINS_ANIMATION: BattleAnimation = {
  name: "scissors_wins",
  description: "Scissors units dominate and convert paper to scissors",
  initialPositions: INITIAL_BATTLE_FIELD,
  movements: [
    // Scissors units move towards paper (aggressive)
    { unitIndex: 6, targetX: 400, targetY: 100, duration: 60 }, // Scissors 1 -> Paper 1
    { unitIndex: 7, targetX: 450, targetY: 200, duration: 60 }, // Scissors 2 -> Paper 2
    { unitIndex: 8, targetX: 500, targetY: 300, duration: 60 }, // Scissors 3 -> Paper 3

    // Rock units move to center (defensive, they beat scissors)
    { unitIndex: 0, targetX: 300, targetY: 200, duration: 50 }, // Rock 1 -> center
    { unitIndex: 1, targetX: 350, targetY: 150, duration: 50 }, // Rock 2 -> center
    { unitIndex: 2, targetX: 400, targetY: 250, duration: 50 }, // Rock 3 -> center

    // Paper units try to fight back but lose (defensive)
    { unitIndex: 3, targetX: 200, targetY: 100, duration: 40 }, // Paper 1 -> defensive position
    { unitIndex: 4, targetX: 250, targetY: 200, duration: 40 }, // Paper 2 -> defensive position
    { unitIndex: 5, targetX: 300, targetY: 300, duration: 40 }, // Paper 3 -> defensive position
  ],
};

// Helper function to get animation based on player choice and game result
export function getBattleAnimation(playerChoice: "rock" | "paper" | "scissors", playerWon: boolean): BattleAnimation {
  if (playerWon) {
    // Player won, so their choice should win
    switch (playerChoice) {
      case "rock":
        return ROCK_WINS_ANIMATION;
      case "paper":
        return PAPER_WINS_ANIMATION;
      case "scissors":
        return SCISSORS_WINS_ANIMATION;
    }
  } else {
    // Player lost, so the choice that beats them should win
    switch (playerChoice) {
      case "rock":
        return PAPER_WINS_ANIMATION; // Paper beats rock
      case "paper":
        return SCISSORS_WINS_ANIMATION; // Scissors beats paper
      case "scissors":
        return ROCK_WINS_ANIMATION; // Rock beats scissors
    }
  }
}
