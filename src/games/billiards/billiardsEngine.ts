import type {
  BallDefinition,
  BallGroup,
  BallKind,
  PlayerAssignments,
  PlayerId,
  Pocket,
  PocketedBall,
  ShotEvaluation,
  ShotEvaluationInput,
  Vector2,
} from "./billiardsTypes";

export const TABLE_WIDTH = 1000;
export const TABLE_HEIGHT = 560;
export const BALL_RADIUS = 12;
export const POCKET_RADIUS = 25;
export const HEAD_SPOT: Vector2 = { x: 260, y: TABLE_HEIGHT / 2 };
export const FOOT_SPOT: Vector2 = { x: 695, y: TABLE_HEIGHT / 2 };
export const STOP_SPEED = 0.08;
export const SHOT_SPEED_MULTIPLIER = 31;
export const OUT_OF_BOUNDS_MARGIN = 96;

const rackRows = [[1], [9, 2], [3, 8, 10], [11, 4, 12, 5], [6, 13, 7, 14, 15]];
const rackLooseness: Record<number, Vector2> = {
  1: { x: 0, y: -0.32 },
  2: { x: 0.18, y: 0.22 },
  3: { x: -0.2, y: -0.18 },
  4: { x: 0.24, y: 0.14 },
  5: { x: -0.16, y: -0.28 },
  6: { x: 0.22, y: 0.24 },
  7: { x: -0.18, y: 0.1 },
  8: { x: 0.1, y: 0 },
  9: { x: -0.14, y: -0.24 },
  10: { x: 0.26, y: 0.18 },
  11: { x: -0.24, y: 0.22 },
  12: { x: 0.12, y: -0.16 },
  13: { x: -0.12, y: 0.26 },
  14: { x: 0.2, y: -0.12 },
  15: { x: -0.26, y: 0.18 },
};
const groupBalls: Record<BallGroup, number[]> = {
  solid: [1, 2, 3, 4, 5, 6, 7],
  stripe: [9, 10, 11, 12, 13, 14, 15],
};

const ballColors: Record<number, string> = {
  1: "#f4c542",
  2: "#2d63d6",
  3: "#c44135",
  4: "#6d42b8",
  5: "#e56a24",
  6: "#248f57",
  7: "#6a3328",
  8: "#111111",
  9: "#f4c542",
  10: "#2d63d6",
  11: "#c44135",
  12: "#6d42b8",
  13: "#e56a24",
  14: "#248f57",
  15: "#6a3328",
};

export const pockets: Pocket[] = [
  { id: "top-left", x: 30, y: 30 },
  { id: "top-center", x: TABLE_WIDTH / 2, y: 24 },
  { id: "top-right", x: TABLE_WIDTH - 30, y: 30 },
  { id: "bottom-left", x: 30, y: TABLE_HEIGHT - 30 },
  { id: "bottom-center", x: TABLE_WIDTH / 2, y: TABLE_HEIGHT - 24 },
  { id: "bottom-right", x: TABLE_WIDTH - 30, y: TABLE_HEIGHT - 30 },
];

export function createPracticeRack(): BallDefinition[] {
  const spacing = BALL_RADIUS * 2.04;
  const rowStep = spacing * 0.866;
  const balls: BallDefinition[] = [
    {
      id: "cue",
      number: null,
      kind: "cue",
      color: "#f7f2df",
      position: HEAD_SPOT,
    },
  ];

  rackRows.forEach((row, rowIndex) => {
    row.forEach((number, ballIndex) => {
      const looseness = rackLooseness[number];
      balls.push({
        id: `ball-${number}`,
        number,
        kind: getBallKind(number),
        color: ballColors[number],
        position: {
          x: FOOT_SPOT.x + rowIndex * rowStep + looseness.x,
          y: FOOT_SPOT.y + (ballIndex - (row.length - 1) / 2) * spacing + looseness.y,
        },
      });
    });
  });

  return balls;
}

export function getBallKind(number: number): BallKind {
  if (number === 8) {
    return "eight";
  }

  return number < 8 ? "solid" : "stripe";
}

export function createInitialAssignments(): PlayerAssignments {
  return {
    1: null,
    2: null,
  };
}

export function getOpponent(player: PlayerId): PlayerId {
  return player === 1 ? 2 : 1;
}

export function getGroupLabel(group: BallGroup | null): string {
  if (group === "solid") {
    return "Solids";
  }

  if (group === "stripe") {
    return "Stripes";
  }

  return "Open";
}

export function getBallGroup(kind: BallKind): BallGroup | null {
  if (kind === "solid" || kind === "stripe") {
    return kind;
  }

  return null;
}

export function isGroupCleared(group: BallGroup, pocketed: PocketedBall[]): boolean {
  return groupBalls[group].every((number) => pocketed.some((ball) => ball.number === number));
}

export function evaluateShot(input: ShotEvaluationInput): ShotEvaluation {
  const opponent = getOpponent(input.currentPlayer);
  const pocketedAfter = [...input.pocketedBefore, ...input.newlyPocketed];
  const assignments = maybeAssignGroups(
    input.currentPlayer,
    input.assignments,
    input.newlyPocketed,
  );
  const assignedGroup = assignments[input.currentPlayer];
  const currentAssignment = input.assignments[input.currentPlayer];
  const clearedBefore = currentAssignment
    ? isGroupCleared(currentAssignment, input.pocketedBefore)
    : false;
  const clearedAfter = assignedGroup ? isGroupCleared(assignedGroup, pocketedAfter) : false;
  const eightPocketed = input.newlyPocketed.some((ball) => ball.kind === "eight");
  const firstContactFoul = isFirstContactFoul(input.firstContact, assignedGroup, clearedBefore);
  const foul = input.scratch || firstContactFoul;

  if (eightPocketed) {
    if (!foul && clearedAfter) {
      return {
        assignments,
        currentPlayer: input.currentPlayer,
        winner: input.currentPlayer,
        playerContinues: false,
        foul: false,
        message: `Player ${input.currentPlayer} sinks the 8 ball and wins.`,
      };
    }

    return {
      assignments,
      currentPlayer: opponent,
      winner: opponent,
      playerContinues: false,
      foul: true,
      message: `Player ${input.currentPlayer} pocketed the 8 ball early. Player ${opponent} wins.`,
    };
  }

  if (foul) {
    return {
      assignments,
      currentPlayer: opponent,
      winner: null,
      playerContinues: false,
      foul: true,
      message: getFoulMessage(input.currentPlayer, opponent, input.scratch, firstContactFoul),
    };
  }

  const pocketedOwnBall = assignedGroup
    ? input.newlyPocketed.some((ball) => ball.kind === assignedGroup)
    : input.newlyPocketed.some((ball) => getBallGroup(ball.kind) !== null);

  if (pocketedOwnBall) {
    return {
      assignments,
      currentPlayer: input.currentPlayer,
      winner: null,
      playerContinues: true,
      foul: false,
      message:
        input.assignments[input.currentPlayer] === null && assignments[input.currentPlayer] !== null
          ? `Player ${input.currentPlayer} is ${getGroupLabel(assignments[input.currentPlayer])}. Keep shooting.`
          : `Player ${input.currentPlayer} keeps shooting.`,
    };
  }

  return {
    assignments,
    currentPlayer: opponent,
    winner: null,
    playerContinues: false,
    foul: false,
    message: `No ball from Player ${input.currentPlayer}'s group dropped. Player ${opponent}'s turn.`,
  };
}

export function getRulesSummary(
  currentPlayer: PlayerId,
  assignments: PlayerAssignments,
  pocketed: PocketedBall[],
): string {
  const playerGroup = assignments[currentPlayer];

  if (!playerGroup) {
    return "Open table. Pocket a solid or stripe to claim a group.";
  }

  const remaining = groupBalls[playerGroup].filter(
    (number) => !pocketed.some((ball) => ball.number === number),
  ).length;

  if (remaining === 0) {
    return `Player ${currentPlayer} is on the 8 ball.`;
  }

  return `Player ${currentPlayer}: ${getGroupLabel(playerGroup)}. ${remaining} left before the 8.`;
}

export function distance(a: Vector2, b: Vector2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function findContainingPocket(position: Vector2, radius = POCKET_RADIUS): Pocket | null {
  return pockets.find((pocket) => distance(position, pocket) <= radius) ?? null;
}

export function isOutOfTableBounds(
  position: Vector2,
  margin = OUT_OF_BOUNDS_MARGIN,
): boolean {
  return (
    !Number.isFinite(position.x) ||
    !Number.isFinite(position.y) ||
    position.x < -margin ||
    position.x > TABLE_WIDTH + margin ||
    position.y < -margin ||
    position.y > TABLE_HEIGHT + margin
  );
}

export function isVelocityStopped(velocity: Vector2, threshold = STOP_SPEED): boolean {
  return Math.hypot(velocity.x, velocity.y) <= threshold;
}

export function getPracticeSummary(pocketed: Array<Pick<BallDefinition, "kind">>): string {
  const objectBalls = pocketed.filter((ball) => ball.kind !== "cue");

  if (objectBalls.length === 0) {
    return "No object balls pocketed yet.";
  }

  const solids = objectBalls.filter((ball) => ball.kind === "solid").length;
  const stripes = objectBalls.filter((ball) => ball.kind === "stripe").length;
  const eight = objectBalls.some((ball) => ball.kind === "eight");

  return `${objectBalls.length} pocketed: ${solids} solid${solids === 1 ? "" : "s"}, ${stripes} stripe${
    stripes === 1 ? "" : "s"
  }${eight ? ", 8 ball down" : ""}.`;
}

function maybeAssignGroups(
  currentPlayer: PlayerId,
  assignments: PlayerAssignments,
  newlyPocketed: PocketedBall[],
): PlayerAssignments {
  if (assignments[currentPlayer]) {
    return assignments;
  }

  const firstGroupBall = newlyPocketed.find((ball) => getBallGroup(ball.kind) !== null);
  const group = firstGroupBall ? getBallGroup(firstGroupBall.kind) : null;

  if (!group) {
    return assignments;
  }

  const nextAssignments: PlayerAssignments = { ...assignments };
  nextAssignments[currentPlayer] = group;
  nextAssignments[getOpponent(currentPlayer)] = group === "solid" ? "stripe" : "solid";
  return nextAssignments;
}

function isFirstContactFoul(
  firstContact: BallKind | null,
  assignedGroup: BallGroup | null,
  clearedBefore: boolean,
): boolean {
  if (!firstContact) {
    return true;
  }

  if (!assignedGroup) {
    return firstContact === "eight";
  }

  return clearedBefore ? firstContact !== "eight" : firstContact !== assignedGroup;
}

function getFoulMessage(
  currentPlayer: PlayerId,
  opponent: PlayerId,
  scratch: boolean,
  firstContactFoul: boolean,
): string {
  if (scratch && firstContactFoul) {
    return `Foul on Player ${currentPlayer}: scratch and illegal first contact. Player ${opponent}'s turn.`;
  }

  if (scratch) {
    return `Scratch on Player ${currentPlayer}. Player ${opponent}'s turn.`;
  }

  return `Foul on Player ${currentPlayer}: illegal first contact. Player ${opponent}'s turn.`;
}
