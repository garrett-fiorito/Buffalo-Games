import type { BallDefinition, BallKind, Pocket, Vector2 } from "./billiardsTypes";

export const TABLE_WIDTH = 1000;
export const TABLE_HEIGHT = 560;
export const BALL_RADIUS = 12;
export const POCKET_RADIUS = 28;
export const HEAD_SPOT: Vector2 = { x: 260, y: TABLE_HEIGHT / 2 };
export const FOOT_SPOT: Vector2 = { x: 695, y: TABLE_HEIGHT / 2 };
export const STOP_SPEED = 0.12;

const rackRows = [[1], [9, 2], [3, 8, 10], [11, 4, 12, 5], [6, 13, 7, 14, 15]];

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
  const spacing = BALL_RADIUS * 2.12;
  const rowStep = spacing * 0.88;
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
      balls.push({
        id: `ball-${number}`,
        number,
        kind: getBallKind(number),
        color: ballColors[number],
        position: {
          x: FOOT_SPOT.x + rowIndex * rowStep,
          y: FOOT_SPOT.y + (ballIndex - (row.length - 1) / 2) * spacing,
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

export function distance(a: Vector2, b: Vector2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function findContainingPocket(position: Vector2, radius = POCKET_RADIUS): Pocket | null {
  return pockets.find((pocket) => distance(position, pocket) <= radius) ?? null;
}

export function isVelocityStopped(velocity: Vector2, threshold = STOP_SPEED): boolean {
  return Math.hypot(velocity.x, velocity.y) <= threshold;
}

export function getPracticeSummary(pocketed: BallDefinition[]): string {
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
