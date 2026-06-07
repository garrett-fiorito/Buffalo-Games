import Matter from "matter-js";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MutableRefObject, PointerEvent } from "react";
import { ArrowLeft, RotateCcw, Target } from "lucide-react";
import { Link } from "react-router-dom";
import {
  BALL_RADIUS,
  HEAD_SPOT,
  POCKET_RADIUS,
  TABLE_HEIGHT,
  TABLE_WIDTH,
  createPracticeRack,
  findContainingPocket,
  getPracticeSummary,
  isVelocityStopped,
  pockets,
} from "./billiardsEngine";
import type { BallDefinition, PocketedBall, Vector2 } from "./billiardsTypes";

const { Bodies, Body, Composite, Engine } = Matter;

type BilliardsViewState = {
  pocketed: PocketedBall[];
  shotCount: number;
  status: string;
  moving: boolean;
  aimingPower: number;
};

type AimState = {
  active: boolean;
  pointer: Vector2;
};

const initialViewState: BilliardsViewState = {
  pocketed: [],
  shotCount: 0,
  status: "Pull back from the cue ball and release to shoot.",
  moving: false,
  aimingPower: 0,
};

export function BilliardsPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const bodiesRef = useRef(new Map<string, Matter.Body>());
  const ballsRef = useRef(createPracticeRack());
  const pocketedRef = useRef<PocketedBall[]>([]);
  const aimRef = useRef<AimState>({ active: false, pointer: HEAD_SPOT });
  const scratchPendingRef = useRef(false);
  const movingRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  const shotCountRef = useRef(0);
  const [viewState, setViewState] = useState<BilliardsViewState>(initialViewState);

  const syncView = useCallback((updates: Partial<BilliardsViewState>) => {
    setViewState((current) => ({ ...current, ...updates }));
  }, []);

  const resetTable = useCallback(() => {
    const engine = engineRef.current;

    if (!engine) {
      return;
    }

    Composite.clear(engine.world, false);
    bodiesRef.current.clear();
    ballsRef.current = createPracticeRack();
    pocketedRef.current = [];
    scratchPendingRef.current = false;
    movingRef.current = false;
    shotCountRef.current = 0;
    setupWorld(engine, ballsRef.current, bodiesRef.current);
    aimRef.current = { active: false, pointer: HEAD_SPOT };
    setViewState(initialViewState);
  }, []);

  useEffect(() => {
    const engine = Engine.create();
    engine.gravity.x = 0;
    engine.gravity.y = 0;
    engineRef.current = engine;
    setupWorld(engine, ballsRef.current, bodiesRef.current);

    let lastTime = performance.now();

    const tick = (time: number) => {
      const delta = Math.min(time - lastTime, 32);
      lastTime = time;
      Engine.update(engine, delta);
      dampSlowBalls(bodiesRef.current);
      detectPocketedBalls(engine, ballsRef.current, bodiesRef.current, pocketedRef.current, syncView);
      maybeRespawnCueBall(engine, ballsRef.current, bodiesRef.current, scratchPendingRef, movingRef, syncView);
      const moving = !allBallsStopped(bodiesRef.current);

      if (moving !== movingRef.current) {
        movingRef.current = moving;
        syncView({
          moving,
          status: moving ? "Balls are rolling." : "Table settled. Line up the next shot.",
        });
      }

      drawTable(canvasRef.current, ballsRef.current, bodiesRef.current, pocketedRef.current, aimRef.current);
      animationFrameRef.current = requestAnimationFrame(tick);
    };

    animationFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      Composite.clear(engine.world, false);
      Engine.clear(engine);
      engineRef.current = null;
    };
  }, [syncView]);

  const updateAimFromEvent = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const cueBody = bodiesRef.current.get("cue");

    if (!cueBody || movingRef.current) {
      return;
    }

    const pointer = eventToWorldPoint(event, event.currentTarget);
    const power = getAimPower(cueBody.position, pointer);
    aimRef.current = { active: true, pointer };
    syncView({ aimingPower: Math.round(power * 100), status: "Release to shoot." });
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    updateAimFromEvent(event);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!aimRef.current.active) {
      return;
    }

    updateAimFromEvent(event);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.releasePointerCapture(event.pointerId);
    const cueBody = bodiesRef.current.get("cue");
    const aim = aimRef.current;

    if (!cueBody || movingRef.current || !aim.active) {
      aimRef.current = { active: false, pointer: HEAD_SPOT };
      syncView({ aimingPower: 0 });
      return;
    }

    const shot = getShotVector(cueBody.position, aim.pointer);
    aimRef.current = { active: false, pointer: HEAD_SPOT };

    if (shot.power < 0.08) {
      syncView({ aimingPower: 0, status: "Pull back farther for more power." });
      return;
    }

    shotCountRef.current += 1;
    Body.setVelocity(cueBody, {
      x: shot.direction.x * shot.power * 26,
      y: shot.direction.y * shot.power * 26,
    });
    syncView({
      shotCount: shotCountRef.current,
      aimingPower: 0,
      moving: true,
      status: "Shot away.",
    });
  };

  const summary = getPracticeSummary(
    pocketedRef.current
      .map((pocketed) => ballsRef.current.find((ball) => ball.id === pocketed.id))
      .filter((ball): ball is BallDefinition => Boolean(ball)),
  );

  return (
    <section className="billiards-view" aria-labelledby="billiards-title">
      <div className="table-hero billiards-hero">
        <div className="table-hero__copy">
          <Link className="back-link" to="/">
            <ArrowLeft size={18} aria-hidden="true" />
            Lobby
          </Link>
          <h1 id="billiards-title">Buffalo Billiards</h1>
        </div>
        <div className="table-stats billiards-stats" aria-label="Practice table stats">
          <Stat label="Shots" value={viewState.shotCount} />
          <Stat label="Pocketed" value={viewState.pocketed.length} />
          <Stat label="Power" value={`${viewState.aimingPower}%`} />
        </div>
      </div>

      <div className="billiards-layout">
        <div className="pool-table-shell">
          <canvas
            ref={canvasRef}
            className="pool-canvas"
            aria-label="Practice 8-ball pool table"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={() => {
              aimRef.current = { active: false, pointer: HEAD_SPOT };
              syncView({ aimingPower: 0 });
            }}
          />
        </div>

        <aside className="billiards-panel" aria-label="Billiards controls">
          <div>
            <p className="eyebrow">Practice table</p>
            <h2>One-player 8-ball</h2>
            <p>{viewState.status}</p>
          </div>
          <div className="billiards-readout">
            <Target size={18} aria-hidden="true" />
            <span>{summary}</span>
          </div>
          <button className="button button-primary" type="button" onClick={resetTable}>
            <RotateCcw size={18} aria-hidden="true" />
            Reset rack
          </button>
          <p className="table-note">
            Pull back from the cue ball, then release. Scratches automatically return the cue ball
            to the head spot after the table settles.
          </p>
        </aside>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="stat-pill">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function setupWorld(
  engine: Matter.Engine,
  balls: BallDefinition[],
  bodies: Map<string, Matter.Body>,
) {
  const walls = [
    Bodies.rectangle(TABLE_WIDTH / 2, -18, TABLE_WIDTH + 72, 36, wallOptions()),
    Bodies.rectangle(TABLE_WIDTH / 2, TABLE_HEIGHT + 18, TABLE_WIDTH + 72, 36, wallOptions()),
    Bodies.rectangle(-18, TABLE_HEIGHT / 2, 36, TABLE_HEIGHT + 72, wallOptions()),
    Bodies.rectangle(TABLE_WIDTH + 18, TABLE_HEIGHT / 2, 36, TABLE_HEIGHT + 72, wallOptions()),
  ];

  const ballBodies = balls.map((ball) => {
    const body = Bodies.circle(ball.position.x, ball.position.y, BALL_RADIUS, {
      label: ball.id,
      restitution: 0.96,
      friction: 0.004,
      frictionStatic: 0,
      frictionAir: 0.018,
      density: 0.004,
      slop: 0.02,
    });
    bodies.set(ball.id, body);
    return body;
  });

  Composite.add(engine.world, [...walls, ...ballBodies]);
}

function wallOptions(): Matter.IChamferableBodyDefinition {
  return {
    isStatic: true,
    restitution: 0.92,
    friction: 0.02,
    label: "rail",
  };
}

function dampSlowBalls(bodies: Map<string, Matter.Body>) {
  bodies.forEach((body) => {
    if (isVelocityStopped(body.velocity, 0.035)) {
      Body.setVelocity(body, { x: 0, y: 0 });
      Body.setAngularVelocity(body, 0);
    }
  });
}

function detectPocketedBalls(
  engine: Matter.Engine,
  balls: BallDefinition[],
  bodies: Map<string, Matter.Body>,
  pocketed: PocketedBall[],
  syncView: (updates: Partial<BilliardsViewState>) => void,
) {
  bodies.forEach((body, id) => {
    const pocket = findContainingPocket(body.position);

    if (!pocket) {
      return;
    }

    const ball = balls.find((candidate) => candidate.id === id);

    if (!ball) {
      return;
    }

    Composite.remove(engine.world, body);
    bodies.delete(id);

    if (ball.kind === "cue") {
      syncView({ status: "Scratch. Cue ball will return after the table settles." });
      return;
    }

    if (!pocketed.some((candidate) => candidate.id === id)) {
      pocketed.push({
        id,
        number: ball.number,
        kind: ball.kind,
      });
      syncView({
        pocketed: [...pocketed],
        status:
          ball.kind === "eight"
            ? "The 8 ball is pocketed. Reset the rack or keep practicing position."
            : `Ball ${ball.number} dropped.`,
      });
    }
  });
}

function maybeRespawnCueBall(
  engine: Matter.Engine,
  balls: BallDefinition[],
  bodies: Map<string, Matter.Body>,
  scratchPending: MutableRefObject<boolean>,
  moving: MutableRefObject<boolean>,
  syncView: (updates: Partial<BilliardsViewState>) => void,
) {
  const cueDefinition = balls.find((ball) => ball.id === "cue");

  if (!cueDefinition || bodies.has("cue")) {
    scratchPending.current = false;
    return;
  }

  scratchPending.current = true;

  if (!moving.current && allBallsStopped(bodies)) {
    const spot = getOpenCueSpot(bodies);
    const cueBody = Bodies.circle(spot.x, spot.y, BALL_RADIUS, {
      label: "cue",
      restitution: 0.96,
      friction: 0.004,
      frictionStatic: 0,
      frictionAir: 0.018,
      density: 0.004,
      slop: 0.02,
    });
    bodies.set("cue", cueBody);
    Composite.add(engine.world, cueBody);
    scratchPending.current = false;
    syncView({ status: "Cue ball reset. Line up the next shot." });
  }
}

function allBallsStopped(bodies: Map<string, Matter.Body>): boolean {
  return Array.from(bodies.values()).every((body) => isVelocityStopped(body.velocity));
}

function getOpenCueSpot(bodies: Map<string, Matter.Body>): Vector2 {
  const candidateSpots: Vector2[] = [
    HEAD_SPOT,
    { x: HEAD_SPOT.x, y: HEAD_SPOT.y - 44 },
    { x: HEAD_SPOT.x, y: HEAD_SPOT.y + 44 },
    { x: HEAD_SPOT.x - 48, y: HEAD_SPOT.y },
  ];

  return (
    candidateSpots.find((spot) =>
      Array.from(bodies.values()).every((body) => Math.hypot(body.position.x - spot.x, body.position.y - spot.y) > BALL_RADIUS * 2.3),
    ) ?? HEAD_SPOT
  );
}

function drawTable(
  canvas: HTMLCanvasElement | null,
  balls: BallDefinition[],
  bodies: Map<string, Matter.Body>,
  pocketed: PocketedBall[],
  aim: AimState,
) {
  if (!canvas) {
    return;
  }

  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const targetWidth = Math.max(1, Math.floor(rect.width * dpr));
  const targetHeight = Math.max(1, Math.floor(rect.height * dpr));

  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
  }

  context.save();
  context.scale(dpr, dpr);
  context.clearRect(0, 0, rect.width, rect.height);

  const scale = Math.min(rect.width / TABLE_WIDTH, rect.height / TABLE_HEIGHT);
  const offset = {
    x: (rect.width - TABLE_WIDTH * scale) / 2,
    y: (rect.height - TABLE_HEIGHT * scale) / 2,
  };

  const toScreen = (point: Vector2): Vector2 => ({
    x: offset.x + point.x * scale,
    y: offset.y + point.y * scale,
  });

  drawPoolSurface(context, offset, scale);

  if (aim.active) {
    const cue = bodies.get("cue");

    if (cue) {
      drawAimGuide(context, cue.position, aim.pointer, toScreen, scale);
    }
  }

  balls.forEach((ball) => {
    if (pocketed.some((candidate) => candidate.id === ball.id)) {
      return;
    }

    const body = bodies.get(ball.id);

    if (!body) {
      return;
    }

    drawBall(context, ball, body.position, toScreen, scale);
  });

  context.restore();
}

function drawPoolSurface(
  context: CanvasRenderingContext2D,
  offset: Vector2,
  scale: number,
) {
  const x = offset.x;
  const y = offset.y;
  const width = TABLE_WIDTH * scale;
  const height = TABLE_HEIGHT * scale;
  const rail = 34 * scale;

  context.fillStyle = "#2b160c";
  roundRect(context, x - rail, y - rail, width + rail * 2, height + rail * 2, 24 * scale);
  context.fill();

  context.fillStyle = "#0d5f3d";
  roundRect(context, x, y, width, height, 14 * scale);
  context.fill();

  const gradient = context.createRadialGradient(
    x + width * 0.5,
    y + height * 0.5,
    0,
    x + width * 0.5,
    y + height * 0.5,
    width * 0.7,
  );
  gradient.addColorStop(0, "rgba(53, 255, 132, 0.12)");
  gradient.addColorStop(1, "rgba(3, 22, 15, 0.18)");
  context.fillStyle = gradient;
  context.fillRect(x, y, width, height);

  pockets.forEach((pocket) => {
    const screenPocket = {
      x: x + pocket.x * scale,
      y: y + pocket.y * scale,
    };
    context.beginPath();
    context.fillStyle = "#040403";
    context.arc(screenPocket.x, screenPocket.y, POCKET_RADIUS * scale, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "rgba(246, 234, 208, 0.2)";
    context.lineWidth = 2 * scale;
    context.stroke();
  });

  context.strokeStyle = "rgba(246, 234, 208, 0.16)";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(x + HEAD_SPOT.x * scale, y + 34 * scale);
  context.lineTo(x + HEAD_SPOT.x * scale, y + height - 34 * scale);
  context.stroke();
}

function drawAimGuide(
  context: CanvasRenderingContext2D,
  cuePosition: Vector2,
  pointer: Vector2,
  toScreen: (point: Vector2) => Vector2,
  scale: number,
) {
  const shot = getShotVector(cuePosition, pointer);
  const cue = toScreen(cuePosition);
  const target = toScreen({
    x: cuePosition.x + shot.direction.x * (120 + shot.power * 180),
    y: cuePosition.y + shot.direction.y * (120 + shot.power * 180),
  });
  const pull = toScreen(pointer);

  context.strokeStyle = "rgba(53, 255, 132, 0.95)";
  context.lineWidth = 3 * scale;
  context.beginPath();
  context.moveTo(cue.x, cue.y);
  context.lineTo(target.x, target.y);
  context.stroke();

  context.strokeStyle = "rgba(246, 234, 208, 0.34)";
  context.lineWidth = 2 * scale;
  context.setLineDash([8 * scale, 8 * scale]);
  context.beginPath();
  context.moveTo(cue.x, cue.y);
  context.lineTo(pull.x, pull.y);
  context.stroke();
  context.setLineDash([]);
}

function drawBall(
  context: CanvasRenderingContext2D,
  ball: BallDefinition,
  position: Vector2,
  toScreen: (point: Vector2) => Vector2,
  scale: number,
) {
  const screen = toScreen(position);
  const radius = BALL_RADIUS * scale;

  context.beginPath();
  context.fillStyle = "rgba(0, 0, 0, 0.32)";
  context.ellipse(screen.x + radius * 0.3, screen.y + radius * 0.52, radius * 0.95, radius * 0.42, 0, 0, Math.PI * 2);
  context.fill();

  context.beginPath();
  context.fillStyle = ball.color;
  context.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
  context.fill();

  if (ball.kind === "stripe") {
    context.save();
    context.beginPath();
    context.arc(screen.x, screen.y, radius * 0.96, 0, Math.PI * 2);
    context.clip();
    context.fillStyle = "#f7f2df";
    context.fillRect(screen.x - radius, screen.y - radius * 0.42, radius * 2, radius * 0.84);
    context.restore();
  }

  const highlight = context.createRadialGradient(
    screen.x - radius * 0.35,
    screen.y - radius * 0.35,
    radius * 0.1,
    screen.x,
    screen.y,
    radius,
  );
  highlight.addColorStop(0, "rgba(255, 255, 255, 0.72)");
  highlight.addColorStop(0.24, "rgba(255, 255, 255, 0.18)");
  highlight.addColorStop(1, "rgba(0, 0, 0, 0.28)");
  context.beginPath();
  context.fillStyle = highlight;
  context.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
  context.fill();

  if (ball.number) {
    context.beginPath();
    context.fillStyle = "#f7f2df";
    context.arc(screen.x, screen.y, radius * 0.48, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#111";
    context.font = `700 ${Math.max(9, radius * 0.58)}px Inter, sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(String(ball.number), screen.x, screen.y + radius * 0.03);
  }
}

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function eventToWorldPoint(event: PointerEvent<HTMLCanvasElement>, canvas: HTMLCanvasElement): Vector2 {
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(rect.width / TABLE_WIDTH, rect.height / TABLE_HEIGHT);
  const offset = {
    x: (rect.width - TABLE_WIDTH * scale) / 2,
    y: (rect.height - TABLE_HEIGHT * scale) / 2,
  };

  return {
    x: Math.min(TABLE_WIDTH, Math.max(0, (event.clientX - rect.left - offset.x) / scale)),
    y: Math.min(TABLE_HEIGHT, Math.max(0, (event.clientY - rect.top - offset.y) / scale)),
  };
}

function getShotVector(cue: Vector2, pointer: Vector2): { direction: Vector2; power: number } {
  const dx = cue.x - pointer.x;
  const dy = cue.y - pointer.y;
  const length = Math.hypot(dx, dy);

  if (length === 0) {
    return {
      direction: { x: 0, y: 0 },
      power: 0,
    };
  }

  return {
    direction: {
      x: dx / length,
      y: dy / length,
    },
    power: getAimPower(cue, pointer),
  };
}

function getAimPower(cue: Vector2, pointer: Vector2): number {
  return Math.min(1, Math.hypot(cue.x - pointer.x, cue.y - pointer.y) / 180);
}
