export type Vector2 = {
  x: number;
  y: number;
};

export type BallKind = "cue" | "solid" | "stripe" | "eight";
export type PlayerId = 1 | 2;
export type BallGroup = "solid" | "stripe";

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

export type PlayerAssignments = Record<PlayerId, BallGroup | null>;

export type ShotEvaluationInput = {
  currentPlayer: PlayerId;
  assignments: PlayerAssignments;
  pocketedBefore: PocketedBall[];
  newlyPocketed: PocketedBall[];
  scratch: boolean;
  firstContact: BallKind | null;
};

export type ShotEvaluation = {
  assignments: PlayerAssignments;
  currentPlayer: PlayerId;
  winner: PlayerId | null;
  playerContinues: boolean;
  foul: boolean;
  message: string;
};
