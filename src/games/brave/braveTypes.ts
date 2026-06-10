export type BravePhase = "ready" | "playing" | "gameOver";

export type ObstacleType =
  | "crateStack"
  | "warningTower"
  | "ceilingDrone"
  | "laserGate"
  | "lowArch"
  | "rollingBarrel";

export type CollectibleType = "coin" | "candy";

export type BraveObstacle = {
  id: number;
  type: ObstacleType;
  x: number;
  y: number;
  width: number;
  height: number;
  nearMissed: boolean;
  smashed?: boolean;
};

export type BraveCollectible = {
  id: number;
  type: CollectibleType;
  x: number;
  y: number;
  radius: number;
  collected: boolean;
};

export type BraveUpgrades = {
  extraHeart: boolean;
  helmet: boolean;
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
  collectibles: BraveCollectible[];
  nextCollectibleId: number;
  stampedeMeter: number;
  stampedeMs: number;
  stampedeBonusDistance: number;
  smashedObstacles: number;
  runCoins: number;
  coins: number;
  hearts: number;
  maxHearts: number;
  upgrades: BraveUpgrades;
};
