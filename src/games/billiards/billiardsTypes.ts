export type Vector2 = {
  x: number;
  y: number;
};

export type BallKind = "cue" | "solid" | "stripe" | "eight";

export type BallDefinition = {
  id: string;
  number: number | null;
  kind: BallKind;
  color: string;
  position: Vector2;
};

export type Pocket = Vector2 & {
  id: string;
};

export type PocketedBall = {
  id: string;
  number: number | null;
  kind: BallKind;
};
