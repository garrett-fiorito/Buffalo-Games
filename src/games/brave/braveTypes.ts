export type BravePhase = "ready" | "playing" | "gameOver";

export type ObstacleType =
  | "crateStack"
  | "warningTower"
  | "ceilingDrone"
  | "laserGate"
  | "lowArch"
  | "rollingBarrel";

export type BraveObstacle = {
  id: number;
  type: ObstacleType;
  x: number;
  y: number;
  width: number;
  height: number;
  nearMissed: boolean;
};

export type BraveState = {
  phase: BravePhase;
  buffaloY: number;
  velocityY: number;
  distance: number;
  score: number;
  best: number;
  speed: number;
  obstacles: BraveObstacle[];
  nextObstacleId: number;
};
