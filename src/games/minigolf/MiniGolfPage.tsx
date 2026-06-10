import Matter from "matter-js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { ArrowLeft, Flag, Maximize2, Minimize2, RotateCcw, Target } from "lucide-react";
import { Link } from "react-router-dom";
import {
  BALL_RADIUS,
  COURSE_HEIGHT,
  COURSE_WIDTH,
  CUP_RADIUS,
  PUTT_SPEED_MULTIPLIER,
  STOP_SPEED,
  findHazard,
  getScoreLabel,
  getScoreRelativeToPar,
  getShotVector,
  getTotalPar,
  getTotalStrokes,
  isBallInCup,
  isInsideCourse,
  isVelocityStopped,
  miniGolfHoles,
} from "./minigolfEngine";
import type { CourseWall, HazardZone, MiniGolfHole, Vector2 } from "./minigolfTypes";

const { Bodies, Body, Composite, Engine } = Matter;

type MiniGolfViewState = {
  holeIndex: number;
  strokes: number[];
  status: string;
  moving: boolean;
  aimingPower: number;
  penalties: number;
  complete: boolean;
};

type AimState = {
  active: boolean;
  pointer: Vector2;
};

const initialStrokes = () => miniGolfHoles.map(() => 0);

function createInitialViewState(): MiniGolfViewState {
  return {
    holeIndex: 0,
    strokes: initialStrokes(),
    status: "Pull back from the ball and release to putt.",
    moving: false,
    aimingPower: 0,
    penalties: 0,
    complete: false,
  };
}

export function MiniGolfPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const ballRef = useRef<Matter.Body | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const aimRef = useRef<AimState>({ active: false, pointer: miniGolfHoles[0].start });
  const lastSafeSpotRef = useRef<Vector2>(miniGolfHoles[0].start);
  const movingRef = useRef(false);
  const resettingRef = useRef(false);
  const holeIndexRef = useRef(0);
  const completeRef = useRef(false);
  const [viewState, setViewState] = useState<MiniGolfViewState>(() => createInitialViewState());
  const viewStateRef = useRef<MiniGolfViewState>(viewState);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const currentHole = miniGolfHoles[viewState.holeIndex];
  const totalStrokes = getTotalStrokes(viewState.strokes);
  const scoreHoleCount = viewState.complete
    ? miniGolfHoles.length
    : viewState.holeIndex + (viewState.strokes[viewState.holeIndex] > 0 ? 1 : 0);
  const scoreToPar = getScoreRelativeToPar(viewState.strokes.slice(0, scoreHoleCount));
  const totalPar = getTotalPar();

  const scorecards = useMemo(
    () =>
      miniGolfHoles.map((hole, index) => ({
        hole,
        strokes: viewState.strokes[index],
        active: index === viewState.holeIndex && !viewState.complete,
      })),
    [viewState.complete, viewState.holeIndex, viewState.strokes],
  );

  const syncView = useCallback((updates: Partial<MiniGolfViewState>) => {
    setViewState((current) => {
      const next = { ...current, ...updates };
      viewStateRef.current = next;
      return next;
    });
  }, []);

  const addStroke = useCallback((holeIndex: number, amount = 1) => {
    setViewState((current) => {
      const strokes = [...current.strokes];
      strokes[holeIndex] += amount;

      const next = { ...current, strokes };
      viewStateRef.current = next;
      return next;
    });
  }, []);

  const loadHole = useCallback(
    (holeIndex: number, status = "Pull back from the ball and release to putt.") => {
      const engine = engineRef.current;

      if (!engine) {
        return;
      }

      const hole = miniGolfHoles[holeIndex];
      Composite.clear(engine.world, false);
      ballRef.current = setupWorld(engine, hole);
      aimRef.current = { active: false, pointer: hole.start };
      lastSafeSpotRef.current = hole.start;
      movingRef.current = false;
      resettingRef.current = false;
      holeIndexRef.current = holeIndex;
      completeRef.current = false;
      syncView({
        holeIndex,
        moving: false,
        aimingPower: 0,
        status,
        complete: false,
      });
    },
    [syncView],
  );

  const resetCourse = useCallback(() => {
    completeRef.current = false;
    const next = createInitialViewState();
    setViewState(next);
    viewStateRef.current = next;
    loadHole(0);
  }, [loadHole]);

  const resetBallToSafeSpot = useCallback(
    (hazard: HazardZone) => {
      const ball = ballRef.current;

      if (!ball || resettingRef.current) {
        return;
      }

      resettingRef.current = true;
      const holeIndex = holeIndexRef.current;
      Body.setPosition(ball, lastSafeSpotRef.current);
      Body.setVelocity(ball, { x: 0, y: 0 });
      Body.setAngularVelocity(ball, 0);
      aimRef.current = { active: false, pointer: lastSafeSpotRef.current };
      addStroke(holeIndex, 1);
      setViewState((current) => {
        const next = {
          ...current,
          moving: false,
          aimingPower: 0,
          penalties: current.penalties + 1,
          status:
            hazard.kind === "water"
              ? "Splash. One penalty stroke, back to your last safe spot."
              : "Caught in sand. One penalty stroke, back to your last safe spot.",
        };
        viewStateRef.current = next;
        return next;
      });

      window.setTimeout(() => {
        resettingRef.current = false;
      }, 450);
    },
    [addStroke],
  );

  const advanceHole = useCallback(() => {
    const nextHoleIndex = holeIndexRef.current + 1;

    if (nextHoleIndex >= miniGolfHoles.length) {
      completeRef.current = true;
      aimRef.current.active = false;
      syncView({
        complete: true,
        moving: false,
        aimingPower: 0,
        status: "Course complete. Nice round.",
      });
      return;
    }

    loadHole(nextHoleIndex, `${miniGolfHoles[nextHoleIndex].name}. Line up the next putt.`);
  }, [loadHole, syncView]);

  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const canvas = canvasRef.current;
    const ball = ballRef.current;

    if (!canvas || !ball || movingRef.current || completeRef.current) {
      return;
    }

    const point = eventToWorldPoint(event, canvas);

    if (Math.hypot(point.x - ball.position.x, point.y - ball.position.y) > 82) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    aimRef.current = { active: true, pointer: point };
    syncView({ aimingPower: Math.round(getShotVector(ball.position, point).power * 100) });
  };

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ball = ballRef.current;

    if (!canvas || !ball || !aimRef.current.active || movingRef.current || completeRef.current) {
      return;
    }

    const point = eventToWorldPoint(event, canvas);
    aimRef.current = { active: true, pointer: point };
    syncView({ aimingPower: Math.round(getShotVector(ball.position, point).power * 100) });
  };

  const handlePointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    const ball = ballRef.current;

    if (!ball || !aimRef.current.active || movingRef.current || completeRef.current) {
      aimRef.current.active = false;
      syncView({ aimingPower: 0 });
      return;
    }

    const shot = getShotVector(ball.position, aimRef.current.pointer);
    aimRef.current.active = false;
    syncView({ aimingPower: 0 });

    if (shot.power < 0.03) {
      return;
    }

    const holeIndex = holeIndexRef.current;
    addStroke(holeIndex);
    Body.setVelocity(ball, {
      x: shot.direction.x * shot.power * PUTT_SPEED_MULTIPLIER,
      y: shot.direction.y * shot.power * PUTT_SPEED_MULTIPLIER,
    });
    movingRef.current = true;
    syncView({ moving: true, status: "Ball rolling." });
  };

  const toggleFullscreen = useCallback(async () => {
    if (!stageRef.current || !document.fullscreenEnabled) {
      return;
    }

    if (document.fullscreenElement === stageRef.current) {
      await document.exitFullscreen();
      return;
    }

    await stageRef.current.requestFullscreen();
  }, []);

  useEffect(() => {
    document.body.classList.add("mini-golf-game-active");

    return () => {
      document.body.classList.remove("mini-golf-game-active");
    };
  }, []);

  useEffect(() => {
    const engine = Engine.create();
    engine.gravity.x = 0;
    engine.gravity.y = 0;
    engine.positionIterations = 8;
    engine.velocityIterations = 10;
    engineRef.current = engine;
    ballRef.current = setupWorld(engine, miniGolfHoles[0]);

    let lastTime = performance.now();

    const tick = (time: number) => {
      const delta = Math.min(time - lastTime, 32);
      lastTime = time;
      Engine.update(engine, delta);
      const ball = ballRef.current;
      const hole = miniGolfHoles[holeIndexRef.current];

      if (ball) {
        dampBall(ball);
        recoverOutOfBoundsBall(ball, lastSafeSpotRef.current);

        const hazard = findHazard(ball.position, hole.hazards);

        if (hazard && !resettingRef.current) {
          resetBallToSafeSpot(hazard);
        }

        const moving = !isVelocityStopped(ball.velocity, STOP_SPEED);

        if (!moving && movingRef.current && !resettingRef.current) {
          movingRef.current = false;
          const safePosition = { x: ball.position.x, y: ball.position.y };

          if (!findHazard(safePosition, hole.hazards) && isInsideCourse(safePosition)) {
            lastSafeSpotRef.current = safePosition;
          }

          syncView({ moving: false, status: "Line up your next putt." });
        }

        if (!completeRef.current && !resettingRef.current && isBallInCup(ball.position, hole.cup, ball.velocity)) {
          Body.setPosition(ball, hole.cup);
          Body.setVelocity(ball, { x: 0, y: 0 });
          Body.setAngularVelocity(ball, 0);
          movingRef.current = false;
          resettingRef.current = true;
          syncView({ moving: false, status: "In the cup." });
          window.setTimeout(() => {
            resettingRef.current = false;
            advanceHole();
          }, 850);
        }
      }

      drawMiniGolf(canvasRef.current, hole, ball, aimRef.current, viewStateRef.current);
      animationFrameRef.current = window.requestAnimationFrame(tick);
    };

    animationFrameRef.current = window.requestAnimationFrame(tick);

    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
      Composite.clear(engine.world, false);
      Engine.clear(engine);
    };
  }, [advanceHole, resetBallToSafeSpot, syncView]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === stageRef.current);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  return (
    <section className="mini-golf-view" aria-labelledby="mini-golf-title">
      <div className="table-hero mini-golf-hero">
        <div className="table-hero__copy">
          <Link className="back-link" to="/">
            <ArrowLeft size={18} aria-hidden="true" />
            Lobby
          </Link>
          <h1 id="mini-golf-title">Neon Mini Golf</h1>
        </div>
        <div className="table-stats mini-golf-stats" aria-label="Mini golf stats">
          <Stat label="Hole" value={`${viewState.holeIndex + 1}/3`} />
          <Stat label="Score" value={getScoreLabel(scoreToPar)} />
          <Stat label="Power" value={`${viewState.aimingPower}%`} />
        </div>
      </div>

      <div className="mini-golf-layout">
        <div ref={stageRef} className="mini-golf-stage">
          <div className="mini-golf-hud" aria-live="polite">
            <span>{currentHole.name}</span>
            <strong>Par {currentHole.par}</strong>
          </div>
          <div className="mini-golf-field-power" aria-label="Putt power">
            <span>Power</span>
            <strong>{viewState.aimingPower}%</strong>
            <div>
              <span style={{ width: `${viewState.aimingPower}%` }} />
            </div>
          </div>
          <button
            className="mini-golf-fullscreen-button"
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Exit fullscreen" : "Play mini golf fullscreen"}
          >
            {isFullscreen ? <Minimize2 size={18} aria-hidden="true" /> : <Maximize2 size={18} aria-hidden="true" />}
            <span>{isFullscreen ? "Exit" : "Fullscreen"}</span>
          </button>
          <canvas
            ref={canvasRef}
            className="mini-golf-canvas"
            aria-label="Three-hole neon mini golf course"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={() => {
              aimRef.current.active = false;
              syncView({ aimingPower: 0 });
            }}
          />
        </div>

        <aside className="mini-golf-panel" aria-label="Mini golf controls">
          <div>
            <p className="eyebrow">Arcade course</p>
            <h2>3-hole neon round</h2>
            <p>{viewState.complete ? "Course complete. Try to beat your score." : viewState.status}</p>
          </div>
          <div className="mini-golf-readout">
            <Target size={18} aria-hidden="true" />
            <span>
              Pull away from the ball to aim. Water and sand reset to the last safe spot with a one-stroke penalty.
            </span>
          </div>
          <div className="mini-golf-scorecard" aria-label="Scorecard">
            {scorecards.map(({ hole, strokes, active }) => (
              <div key={hole.id} className={`mini-golf-score-row ${active ? "active" : ""}`}>
                <span>{hole.name}</span>
                <strong>{strokes || "-"}</strong>
                <small>Par {hole.par}</small>
              </div>
            ))}
          </div>
          <div className="mini-golf-summary">
            <span>Total {totalStrokes || 0}</span>
            <span>Par {totalPar}</span>
            <span>Penalties {viewState.penalties}</span>
          </div>
          <button className="button button-primary" type="button" onClick={resetCourse}>
            <RotateCcw size={18} aria-hidden="true" />
            Reset round
          </button>
          <p className="table-note">On phones, rotate sideways for the widest playable view.</p>
        </aside>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="stat-pill">
      <Flag size={18} aria-hidden="true" />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function setupWorld(engine: Matter.Engine, hole: MiniGolfHole): Matter.Body {
  const outerWalls = [
    Bodies.rectangle(COURSE_WIDTH / 2, -20, COURSE_WIDTH + 72, 40, wallOptions("outer-wall")),
    Bodies.rectangle(COURSE_WIDTH / 2, COURSE_HEIGHT + 20, COURSE_WIDTH + 72, 40, wallOptions("outer-wall")),
    Bodies.rectangle(-20, COURSE_HEIGHT / 2, 40, COURSE_HEIGHT + 72, wallOptions("outer-wall")),
    Bodies.rectangle(COURSE_WIDTH + 20, COURSE_HEIGHT / 2, 40, COURSE_HEIGHT + 72, wallOptions("outer-wall")),
  ];
  const courseWalls = hole.walls.map((wall) =>
    Bodies.rectangle(wall.x, wall.y, wall.width, wall.height, {
      ...wallOptions(wall.id),
      angle: wall.angle ?? 0,
    }),
  );
  const ball = Bodies.circle(hole.start.x, hole.start.y, BALL_RADIUS, {
    label: "mini-golf-ball",
    restitution: 0.74,
    friction: 0.002,
    frictionStatic: 0,
    frictionAir: 0.024,
    density: 0.003,
    slop: 0.004,
  });

  Composite.add(engine.world, [...outerWalls, ...courseWalls, ball]);
  return ball;
}

function wallOptions(label: string): Matter.IChamferableBodyDefinition {
  return {
    isStatic: true,
    restitution: 0.82,
    friction: 0.02,
    label,
  };
}

function dampBall(ball: Matter.Body) {
  if (isVelocityStopped(ball.velocity, 0.035)) {
    Body.setVelocity(ball, { x: 0, y: 0 });
    Body.setAngularVelocity(ball, 0);
  }
}

function recoverOutOfBoundsBall(ball: Matter.Body, lastSafeSpot: Vector2) {
  if (isInsideCourse(ball.position, -90)) {
    return;
  }

  Body.setPosition(ball, lastSafeSpot);
  Body.setVelocity(ball, { x: 0, y: 0 });
  Body.setAngularVelocity(ball, 0);
}

function drawMiniGolf(
  canvas: HTMLCanvasElement | null,
  hole: MiniGolfHole,
  ball: Matter.Body | null,
  aim: AimState,
  viewState: MiniGolfViewState,
) {
  if (!canvas) {
    return;
  }

  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  const rect = canvas.getBoundingClientRect();
  const pixelRatio = window.devicePixelRatio || 1;
  const targetWidth = Math.max(1, Math.floor(rect.width * pixelRatio));
  const targetHeight = Math.max(1, Math.floor(rect.height * pixelRatio));

  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
  }

  context.save();
  context.scale(pixelRatio, pixelRatio);
  context.clearRect(0, 0, rect.width, rect.height);

  const scale = Math.min(rect.width / COURSE_WIDTH, rect.height / COURSE_HEIGHT);
  const offset = {
    x: (rect.width - COURSE_WIDTH * scale) / 2,
    y: (rect.height - COURSE_HEIGHT * scale) / 2,
  };

  const toScreen = (point: Vector2) => ({
    x: offset.x + point.x * scale,
    y: offset.y + point.y * scale,
  });

  drawCourseSurface(context, rect.width, rect.height, scale, offset);
  drawHazards(context, hole.hazards, scale, toScreen);
  drawWalls(context, hole.walls, scale, toScreen);
  drawCup(context, hole.cup, scale, toScreen);

  if (ball) {
    if (aim.active && !viewState.moving) {
      drawAimGuide(context, ball.position, aim.pointer, hole, scale, toScreen);
    }

    drawBall(context, ball.position, scale, toScreen);
  }

  context.restore();
}

function drawCourseSurface(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  scale: number,
  offset: Vector2,
) {
  const courseWidth = COURSE_WIDTH * scale;
  const courseHeight = COURSE_HEIGHT * scale;
  const gradient = context.createLinearGradient(offset.x, offset.y, offset.x + courseWidth, offset.y + courseHeight);
  gradient.addColorStop(0, "#08120f");
  gradient.addColorStop(0.42, "#09221b");
  gradient.addColorStop(1, "#07080d");

  context.fillStyle = "#020203";
  context.fillRect(0, 0, width, height);
  context.shadowColor = "rgba(46, 255, 168, 0.55)";
  context.shadowBlur = 22;
  roundRect(context, offset.x, offset.y, courseWidth, courseHeight, 18 * scale);
  context.fillStyle = gradient;
  context.fill();
  context.lineWidth = Math.max(2, 4 * scale);
  context.strokeStyle = "#2effa8";
  context.stroke();
  context.shadowBlur = 0;

  context.save();
  context.beginPath();
  roundRect(context, offset.x, offset.y, courseWidth, courseHeight, 18 * scale);
  context.clip();
  context.strokeStyle = "rgba(255, 255, 255, 0.05)";
  context.lineWidth = 1;

  for (let x = offset.x + 50 * scale; x < offset.x + courseWidth; x += 68 * scale) {
    context.beginPath();
    context.moveTo(x, offset.y);
    context.lineTo(x - 120 * scale, offset.y + courseHeight);
    context.stroke();
  }

  context.restore();
}

function drawHazards(
  context: CanvasRenderingContext2D,
  hazards: HazardZone[],
  scale: number,
  toScreen: (point: Vector2) => Vector2,
) {
  hazards.forEach((hazard) => {
    const point = toScreen({ x: hazard.x, y: hazard.y });
    const width = hazard.width * scale;
    const height = hazard.height * scale;
    context.save();
    context.shadowBlur = 18 * scale;
    context.shadowColor = hazard.kind === "water" ? "rgba(38, 210, 255, 0.72)" : "rgba(255, 215, 86, 0.58)";
    roundRect(context, point.x, point.y, width, height, 18 * scale);
    context.fillStyle =
      hazard.kind === "water"
        ? "rgba(20, 126, 208, 0.78)"
        : "rgba(224, 177, 62, 0.78)";
    context.fill();
    context.lineWidth = Math.max(1, 2 * scale);
    context.strokeStyle = hazard.kind === "water" ? "#5ee7ff" : "#ffdc63";
    context.stroke();
    context.restore();
  });
}

function drawWalls(
  context: CanvasRenderingContext2D,
  walls: CourseWall[],
  scale: number,
  toScreen: (point: Vector2) => Vector2,
) {
  walls.forEach((wall) => {
    const center = toScreen({ x: wall.x, y: wall.y });
    context.save();
    context.translate(center.x, center.y);
    context.rotate(wall.angle ?? 0);
    context.shadowBlur = 16 * scale;
    context.shadowColor = "rgba(255, 41, 166, 0.62)";
    roundRect(context, (-wall.width * scale) / 2, (-wall.height * scale) / 2, wall.width * scale, wall.height * scale, 8 * scale);
    context.fillStyle = "#21142d";
    context.fill();
    context.lineWidth = Math.max(1, 2 * scale);
    context.strokeStyle = "#ff29a6";
    context.stroke();
    context.restore();
  });
}

function drawCup(
  context: CanvasRenderingContext2D,
  cup: Vector2,
  scale: number,
  toScreen: (point: Vector2) => Vector2,
) {
  const point = toScreen(cup);
  context.save();
  context.shadowBlur = 18 * scale;
  context.shadowColor = "rgba(46, 255, 168, 0.9)";
  context.beginPath();
  context.arc(point.x, point.y, CUP_RADIUS * scale, 0, Math.PI * 2);
  context.fillStyle = "#020203";
  context.fill();
  context.lineWidth = Math.max(2, 3 * scale);
  context.strokeStyle = "#2effa8";
  context.stroke();
  context.shadowBlur = 0;
  context.strokeStyle = "#f8f1c8";
  context.lineWidth = Math.max(1, 2 * scale);
  context.beginPath();
  context.moveTo(point.x + 10 * scale, point.y - 6 * scale);
  context.lineTo(point.x + 10 * scale, point.y - 58 * scale);
  context.stroke();
  context.fillStyle = "#ff29a6";
  context.beginPath();
  context.moveTo(point.x + 10 * scale, point.y - 58 * scale);
  context.lineTo(point.x + 50 * scale, point.y - 46 * scale);
  context.lineTo(point.x + 10 * scale, point.y - 34 * scale);
  context.closePath();
  context.fill();
  context.restore();
}

function drawAimGuide(
  context: CanvasRenderingContext2D,
  ball: Vector2,
  pointer: Vector2,
  hole: MiniGolfHole,
  scale: number,
  toScreen: (point: Vector2) => Vector2,
) {
  const shot = getShotVector(ball, pointer);
  const ballPoint = toScreen(ball);
  const pointerPoint = toScreen(pointer);
  const guideEnd = toScreen(getAimProjectionEnd(ball, shot.direction, hole));

  context.save();
  context.lineCap = "round";
  if (shot.power > 0) {
    context.setLineDash([12 * scale, 8 * scale]);
    context.lineWidth = Math.max(2, 3 * scale);
    context.strokeStyle = "rgba(95, 239, 255, 0.92)";
    context.shadowBlur = 14 * scale;
    context.shadowColor = "rgba(95, 239, 255, 0.8)";
    context.beginPath();
    context.moveTo(ballPoint.x, ballPoint.y);
    context.lineTo(guideEnd.x, guideEnd.y);
    context.stroke();
    context.setLineDash([]);
    context.beginPath();
    context.arc(guideEnd.x, guideEnd.y, Math.max(3, 5 * scale), 0, Math.PI * 2);
    context.fillStyle = "rgba(95, 239, 255, 0.95)";
    context.fill();
  }

  context.strokeStyle = "rgba(255, 255, 255, 0.36)";
  context.shadowBlur = 0;
  context.beginPath();
  context.moveTo(ballPoint.x, ballPoint.y);
  context.lineTo(pointerPoint.x, pointerPoint.y);
  context.stroke();
  context.restore();
}

function getAimProjectionEnd(ball: Vector2, direction: Vector2, hole: MiniGolfHole): Vector2 {
  if (direction.x === 0 && direction.y === 0) {
    return ball;
  }

  let distance = getBoundaryProjectionDistance(ball, direction);

  hole.walls.forEach((wall) => {
    const wallDistance = getWallProjectionDistance(ball, direction, wall);

    if (wallDistance !== null && wallDistance < distance) {
      distance = wallDistance;
    }
  });

  const cappedDistance = Math.max(0, Math.min(distance, 900));
  return {
    x: ball.x + direction.x * cappedDistance,
    y: ball.y + direction.y * cappedDistance,
  };
}

function getBoundaryProjectionDistance(ball: Vector2, direction: Vector2): number {
  const distances: number[] = [];

  if (direction.x > 0) {
    distances.push((COURSE_WIDTH - BALL_RADIUS - ball.x) / direction.x);
  } else if (direction.x < 0) {
    distances.push((BALL_RADIUS - ball.x) / direction.x);
  }

  if (direction.y > 0) {
    distances.push((COURSE_HEIGHT - BALL_RADIUS - ball.y) / direction.y);
  } else if (direction.y < 0) {
    distances.push((BALL_RADIUS - ball.y) / direction.y);
  }

  return Math.min(...distances.filter((distance) => distance > 0));
}

function getWallProjectionDistance(ball: Vector2, direction: Vector2, wall: CourseWall): number | null {
  const angle = -(wall.angle ?? 0);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const localOrigin = rotatePoint({ x: ball.x - wall.x, y: ball.y - wall.y }, cos, sin);
  const localDirection = rotatePoint(direction, cos, sin);
  const bounds = {
    minX: -wall.width / 2 - BALL_RADIUS,
    maxX: wall.width / 2 + BALL_RADIUS,
    minY: -wall.height / 2 - BALL_RADIUS,
    maxY: wall.height / 2 + BALL_RADIUS,
  };

  let near = -Infinity;
  let far = Infinity;

  const xRange = getRayRange(localOrigin.x, localDirection.x, bounds.minX, bounds.maxX);
  if (!xRange) {
    return null;
  }

  near = Math.max(near, xRange.near);
  far = Math.min(far, xRange.far);

  const yRange = getRayRange(localOrigin.y, localDirection.y, bounds.minY, bounds.maxY);
  if (!yRange) {
    return null;
  }

  near = Math.max(near, yRange.near);
  far = Math.min(far, yRange.far);

  if (far < 0 || near > far) {
    return null;
  }

  return near > 0 ? near : far;
}

function getRayRange(origin: number, direction: number, min: number, max: number): { near: number; far: number } | null {
  if (Math.abs(direction) < 0.0001) {
    return origin >= min && origin <= max ? { near: -Infinity, far: Infinity } : null;
  }

  const first = (min - origin) / direction;
  const second = (max - origin) / direction;

  return {
    near: Math.min(first, second),
    far: Math.max(first, second),
  };
}

function rotatePoint(point: Vector2, cos: number, sin: number): Vector2 {
  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  };
}

function drawBall(
  context: CanvasRenderingContext2D,
  position: Vector2,
  scale: number,
  toScreen: (point: Vector2) => Vector2,
) {
  const point = toScreen(position);
  const radius = BALL_RADIUS * scale;
  context.save();
  context.shadowBlur = 16 * scale;
  context.shadowColor = "rgba(255, 255, 255, 0.78)";
  context.beginPath();
  context.arc(point.x, point.y, radius, 0, Math.PI * 2);
  context.fillStyle = "#f7f2df";
  context.fill();
  context.shadowBlur = 0;
  context.beginPath();
  context.arc(point.x - radius * 0.28, point.y - radius * 0.32, radius * 0.26, 0, Math.PI * 2);
  context.fillStyle = "rgba(255, 255, 255, 0.72)";
  context.fill();
  context.restore();
}

function eventToWorldPoint(event: PointerEvent<HTMLCanvasElement>, canvas: HTMLCanvasElement): Vector2 {
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(rect.width / COURSE_WIDTH, rect.height / COURSE_HEIGHT);
  const offset = {
    x: (rect.width - COURSE_WIDTH * scale) / 2,
    y: (rect.height - COURSE_HEIGHT * scale) / 2,
  };

  return {
    x: Math.min(COURSE_WIDTH, Math.max(0, (event.clientX - rect.left - offset.x) / scale)),
    y: Math.min(COURSE_HEIGHT, Math.max(0, (event.clientY - rect.top - offset.y) / scale)),
  };
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
