export type Vector2 = {
  x: number;
  y: number;
};

export type HazardKind = "water" | "sand";

export type HazardZone = {
  id: string;
  kind: HazardKind;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CourseWall = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  angle?: number;
};

export type MiniGolfHole = {
  id: string;
  name: string;
  par: number;
  start: Vector2;
  cup: Vector2;
  walls: CourseWall[];
  hazards: HazardZone[];
};
