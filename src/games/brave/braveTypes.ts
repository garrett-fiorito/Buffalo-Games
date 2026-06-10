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

export type FuelSpark = {
  id: number;
  x: number;
  y: number;
  radius: number;
};

export type BraveEvent = "spark" | "nearMiss" | null;

export type BraveState = {
  phase: BravePhase;
  buffaloY: number;
  velocityY: number;
  distance: number;
  bonusScore: number;
  score: number;
  best: number;
  speed: number;
  obstacles: BraveObstacle[];
  sparks: FuelSpark[];
  nextObstacleId: number;
  nextSparkId: number;
  lastEvent: BraveEvent;
};
