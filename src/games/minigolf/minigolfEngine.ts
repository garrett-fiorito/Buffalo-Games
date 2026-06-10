import type { HazardZone, MiniGolfHole, Vector2 } from "./minigolfTypes";

export const COURSE_WIDTH = 1000;
export const COURSE_HEIGHT = 600;
export const BALL_RADIUS = 10;
export const CUP_RADIUS = 19;
export const CUP_CAPTURE_SPEED = 1.08;
export const STOP_SPEED = 0.075;
export const PUTT_SPEED_MULTIPLIER = 21;
export const MAX_PULL_DISTANCE = 190;

export const miniGolfHoles: MiniGolfHole[] = [
  {
    id: "starter",
    name: "Neon Starter",
    par: 2,
    start: { x: 118, y: 512 },
    cup: { x: 864, y: 112 },
    walls: [
      { id: "starter-top-bumper", x: 390, y: 178, width: 310, height: 28, angle: -0.2 },
      { id: "starter-bottom-bumper", x: 600, y: 392, width: 300, height: 28, angle: -0.2 },
      { id: "starter-cup-guard", x: 770, y: 186, width: 28, height: 145, angle: 0.35 },
    ],
    hazards: [
      { id: "starter-water", kind: "water", x: 270, y: 268, width: 195, height: 72 },
      { id: "starter-sand", kind: "sand", x: 704, y: 258, width: 150, height: 82 },
    ],
  },
  {
    id: "canal",
    name: "Glow Canal",
    par: 3,
    start: { x: 120, y: 300 },
    cup: { x: 888, y: 300 },
    walls: [
      { id: "canal-left-gate", x: 356, y: 198, width: 34, height: 185 },
      { id: "canal-right-gate", x: 630, y: 402, width: 34, height: 185 },
      { id: "canal-bank-one", x: 514, y: 142, width: 270, height: 24, angle: 0.08 },
      { id: "canal-bank-two", x: 514, y: 458, width: 270, height: 24, angle: 0.08 },
    ],
    hazards: [
      { id: "canal-water-top", kind: "water", x: 400, y: 214, width: 206, height: 66 },
      { id: "canal-water-bottom", kind: "water", x: 400, y: 320, width: 206, height: 66 },
      { id: "canal-sand", kind: "sand", x: 732, y: 112, width: 132, height: 82 },
    ],
  },
  {
    id: "arcade-gate",
    name: "Arcade Gate",
    par: 3,
    start: { x: 126, y: 520 },
    cup: { x: 854, y: 92 },
    walls: [
      { id: "gate-left-rail", x: 322, y: 340, width: 30, height: 250, angle: -0.42 },
      { id: "gate-right-rail", x: 512, y: 260, width: 30, height: 245, angle: -0.42 },
      { id: "gate-upper-bank", x: 724, y: 240, width: 300, height: 26, angle: 0.3 },
      { id: "gate-cup-pocket", x: 798, y: 148, width: 28, height: 128, angle: -0.12 },
    ],
    hazards: [
      { id: "gate-water", kind: "water", x: 424, y: 426, width: 250, height: 82 },
      { id: "gate-sand-left", kind: "sand", x: 680, y: 62, width: 86, height: 128 },
      { id: "gate-sand-right", kind: "sand", x: 858, y: 238, width: 92, height: 112 },
    ],
  },
];

export function getTotalPar(holes: MiniGolfHole[] = miniGolfHoles): number {
  return holes.reduce((total, hole) => total + hole.par, 0);
}

export function getTotalStrokes(strokes: number[]): number {
  return strokes.reduce((total, strokeCount) => total + strokeCount, 0);
}

export function getScoreRelativeToPar(strokes: number[], holes: MiniGolfHole[] = miniGolfHoles): number {
  return getTotalStrokes(strokes) - holes.slice(0, strokes.length).reduce((total, hole) => total + hole.par, 0);
}

export function isVelocityStopped(velocity: Vector2, threshold = STOP_SPEED): boolean {
  return Math.hypot(velocity.x, velocity.y) <= threshold;
}

export function getDistance(a: Vector2, b: Vector2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function isBallInCup(position: Vector2, cup: Vector2, velocity: Vector2): boolean {
  return getDistance(position, cup) <= CUP_RADIUS && isVelocityStopped(velocity, CUP_CAPTURE_SPEED);
}

export function findHazard(position: Vector2, hazards: HazardZone[]): HazardZone | null {
  return (
    hazards.find(
      (hazard) =>
        position.x >= hazard.x &&
        position.x <= hazard.x + hazard.width &&
        position.y >= hazard.y &&
        position.y <= hazard.y + hazard.height,
    ) ?? null
  );
}

export function isInsideCourse(position: Vector2, margin = BALL_RADIUS): boolean {
  return (
    position.x >= margin &&
    position.x <= COURSE_WIDTH - margin &&
    position.y >= margin &&
    position.y <= COURSE_HEIGHT - margin
  );
}

export function getAimPower(ball: Vector2, pointer: Vector2): number {
  const rawPower = Math.min(1, getDistance(ball, pointer) / MAX_PULL_DISTANCE);
  return Math.pow(rawPower, 1.35);
}

export function getShotVector(ball: Vector2, pointer: Vector2): { direction: Vector2; power: number } {
  const dx = ball.x - pointer.x;
  const dy = ball.y - pointer.y;
  const length = Math.hypot(dx, dy);

  if (length === 0) {
    return {
      direction: { x: 0, y: 0 },
      power: 0,
    };
  }

  return {
    direction: { x: dx / length, y: dy / length },
    power: getAimPower(ball, pointer),
  };
}

export function getScoreLabel(scoreToPar: number): string {
  if (scoreToPar === 0) {
    return "E";
  }

  return scoreToPar > 0 ? `+${scoreToPar}` : String(scoreToPar);
}
