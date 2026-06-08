export type FlappyPhase = "ready" | "playing" | "gameOver";

export type PipePair = {
  id: number;
  x: number;
  gapY: number;
  scored: boolean;
};

export type FlappyState = {
  phase: FlappyPhase;
  buffaloY: number;
  velocityY: number;
  pipes: PipePair[];
  score: number;
  best: number;
  nextPipeId: number;
};
