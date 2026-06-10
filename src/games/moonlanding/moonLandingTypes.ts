export type Vector2 = {
  x: number;
  y: number;
};

export type MoonLandingPhase = "ready" | "playing" | "gameOver";

export type MoonControls = {
  left: boolean;
  right: boolean;
  up: boolean;
};

export type MoonAsteroid = {
  id: number;
  x: number;
  y: number;
  radius: number;
  driftX: number;
  driftY: number;
  hit: boolean;
};

export type MoonGasStation = {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  used: boolean;
};

export type MoonShip = {
  position: Vector2;
  velocity: Vector2;
};

export type MoonLandingState = {
  phase: MoonLandingPhase;
  ship: MoonShip;
  cameraX: number;
  distance: number;
  best: number;
  fuel: number;
  health: number;
  planetIndex: number;
  nextPlanetDistance: number;
  asteroids: MoonAsteroid[];
  gasStations: MoonGasStation[];
  message: string;
  checkpointFlashMs: number;
};
