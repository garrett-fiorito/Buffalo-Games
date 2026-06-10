import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { ArrowLeft, Gauge, Maximize2, Minimize2, Play, RotateCcw, Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import {
  BRAVE_HEIGHT,
  BRAVE_WIDTH,
  BUFFALO_X,
  FLOOR_Y,
  createInitialBraveState,
  startBrave,
  stepBrave,
} from "./braveEngine";
import type { BraveObstacle, BraveState } from "./braveTypes";

const bestScoreKey = "black-buffalo-brave-best";

export function BraveBuffaloPage() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);
  const inputHeldRef = useRef(false);
  const stateRef = useRef<BraveState>(createInitialBraveState(readBestScore()));
  const [state, setState] = useState(stateRef.current);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const updateState = useCallback((updater: (current: BraveState) => BraveState) => {
    setState((current) => {
      const next = updater(current);
      stateRef.current = next;
      return next;
    });
  }, []);

  const beginBoost = useCallback(() => {
    inputHeldRef.current = true;
    updateState((current) => startBrave(current));
  }, [updateState]);

  const endBoost = useCallback(() => {
    inputHeldRef.current = false;
  }, []);

  const handleStagePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      beginBoost();
    },
    [beginBoost],
  );

  const handleStagePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      endBoost();
    },
    [endBoost],
  );

  useEffect(() => {
    document.body.classList.add("brave-game-active");

    return () => {
      document.body.classList.remove("brave-game-active");
    };
  }, []);

  const handleFullscreen = useCallback(async () => {
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
    drawBrave(canvasRef.current, state, inputHeldRef.current);
    stateRef.current = state;

    if (state.best > 0) {
      window.localStorage.setItem(bestScoreKey, String(state.best));
    }
  }, [state]);

  useEffect(() => {
    const tick = (timestamp: number) => {
      const lastFrame = lastFrameRef.current ?? timestamp;
      const deltaMs = timestamp - lastFrame;
      lastFrameRef.current = timestamp;

      updateState((current) => {
        return current.phase === "playing"
          ? stepBrave(current, deltaMs, inputHeldRef.current)
          : current;
      });

      frameRef.current = window.requestAnimationFrame(tick);
    };

    frameRef.current = window.requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, [updateState]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Space" || event.code === "ArrowUp") {
        event.preventDefault();
        beginBoost();
      }
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space" || event.code === "ArrowUp") {
        event.preventDefault();
        endBoost();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [beginBoost, endBoost]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === stageRef.current);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const actionLabel =
    state.phase === "gameOver" ? "Restart run" : state.phase === "ready" ? "Start run" : "Flap";
  const actionIcon = state.phase === "gameOver" ? <RotateCcw size={18} /> : <Play size={18} />;

  return (
    <section className="brave-view" aria-labelledby="brave-title">
      <div className="table-hero brave-hero">
        <div className="table-hero__copy">
          <Link className="back-link" to="/">
            <ArrowLeft size={18} aria-hidden="true" />
            Lobby
          </Link>
          <h1 id="brave-title">Brave Buffalo</h1>
        </div>
        <div className="table-stats" aria-label="Brave Buffalo stats">
          <Stat label="Score" value={state.score} icon={<Gauge />} />
          <Stat label="Best" value={state.best} icon={<Trophy />} />
        </div>
      </div>

      <div className="brave-layout">
        <div
          ref={stageRef}
          className="brave-stage"
          onContextMenu={(event) => event.preventDefault()}
          onPointerDown={handleStagePointerDown}
          onPointerUp={handleStagePointerUp}
          onPointerCancel={handleStagePointerUp}
          onPointerLeave={handleStagePointerUp}
        >
          <button
            className="brave-fullscreen-button"
            type="button"
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            onClick={handleFullscreen}
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onPointerUp={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
          >
            {isFullscreen ? (
              <Minimize2 size={17} aria-hidden="true" />
            ) : (
              <Maximize2 size={17} aria-hidden="true" />
            )}
            <span>{isFullscreen ? "Exit" : "Fullscreen"}</span>
          </button>
          <canvas
            ref={canvasRef}
            className="brave-canvas"
            width={BRAVE_WIDTH}
            height={BRAVE_HEIGHT}
            aria-label="Brave Buffalo arcade game canvas"
            onContextMenu={(event) => event.preventDefault()}
          />
        </div>

        <aside className="brave-panel" aria-live="polite">
          <div>
            <span className="panel-kicker">Wing run</span>
            <h2>{getStatusTitle(state)}</h2>
            <p>{getStatusMessage(state)}</p>
          </div>
          <button
            className="button button-primary"
            type="button"
            onPointerDown={(event) => {
              event.preventDefault();
              beginBoost();
            }}
            onPointerUp={endBoost}
            onPointerCancel={endBoost}
            onClick={(event) => event.preventDefault()}
          >
            {actionIcon}
            {actionLabel}
          </button>
        </aside>
      </div>
    </section>
  );
}

type StatProps = {
  label: string;
  value: number;
  icon: ReactNode;
};

function Stat({ label, value, icon }: StatProps) {
  return (
    <div className="stat-pill">
      {icon}
      <span>{label}</span>
      <strong>{value.toLocaleString()}</strong>
    </div>
  );
}

function getStatusTitle(state: BraveState): string {
  if (state.phase === "gameOver") {
    return "Run over";
  }

  if (state.phase === "playing") {
    return "Hold to fly";
  }

  return "Ready";
}

function getStatusMessage(state: BraveState): string {
  if (state.phase === "gameOver") {
    return "Better luck next time.";
  }

  if (state.phase === "playing") {
    return "Release to drop, hold to rise, and avoid the red hazards.";
  }

  return "Hold the button, press Space, or touch the game to flap upward.";
}

function drawBrave(
  canvas: HTMLCanvasElement | null,
  state: BraveState,
  isBoosting: boolean,
): void {
  if (!canvas) {
    return;
  }

  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  context.clearRect(0, 0, BRAVE_WIDTH, BRAVE_HEIGHT);
  drawArcadeBackdrop(context, state);
  state.obstacles.forEach((obstacle) => drawObstacle(context, obstacle, state.distance));
  drawWingedBuffalo(context, state.buffaloY, state.distance, isBoosting);
  drawBraveOverlay(context, state);
}

function drawArcadeBackdrop(context: CanvasRenderingContext2D, state: BraveState): void {
  const sky = context.createLinearGradient(0, 0, 0, FLOOR_Y);
  sky.addColorStop(0, "#10192d");
  sky.addColorStop(0.55, "#1f314f");
  sky.addColorStop(1, "#102b1f");
  context.fillStyle = sky;
  context.fillRect(0, 0, BRAVE_WIDTH, BRAVE_HEIGHT);

  drawParallaxBand(context, state.distance, 0.12, 78, "#243f66", 92);
  drawParallaxBand(context, state.distance, 0.26, 118, "#1b5a45", 58);

  context.fillStyle = "rgba(255, 255, 255, 0.5)";
  for (let index = 0; index < 20; index += 1) {
    const x = (index * 127 - state.distance * 0.18) % (BRAVE_WIDTH + 80);
    const y = 34 + ((index * 47) % 150);
    context.fillRect(x < -20 ? x + BRAVE_WIDTH + 80 : x, y, 3, 3);
  }

  context.fillStyle = "#25180f";
  context.fillRect(0, FLOOR_Y, BRAVE_WIDTH, BRAVE_HEIGHT - FLOOR_Y);
  context.fillStyle = "#35ff84";
  context.fillRect(0, FLOOR_Y, BRAVE_WIDTH, 4);
  context.fillStyle = "rgba(246, 234, 208, 0.16)";
  for (let x = -(state.distance % 52); x < BRAVE_WIDTH; x += 52) {
    context.fillRect(x, FLOOR_Y + 34, 28, 5);
  }
}

function drawParallaxBand(
  context: CanvasRenderingContext2D,
  distance: number,
  speed: number,
  baseY: number,
  color: string,
  height: number,
): void {
  const offset = -(distance * speed) % 220;
  context.fillStyle = color;
  context.beginPath();
  context.moveTo(offset - 220, FLOOR_Y);

  for (let x = offset - 220; x <= BRAVE_WIDTH + 220; x += 110) {
    context.lineTo(x + 52, baseY);
    context.lineTo(x + 110, FLOOR_Y);
  }

  context.lineTo(BRAVE_WIDTH, FLOOR_Y);
  context.lineTo(0, FLOOR_Y);
  context.closePath();
  context.globalAlpha = height / 100;
  context.fill();
  context.globalAlpha = 1;
}

function drawObstacle(
  context: CanvasRenderingContext2D,
  obstacle: BraveObstacle,
  distance: number,
): void {
  context.save();

  switch (obstacle.type) {
    case "crateStack":
      drawCrateStack(context, obstacle);
      break;
    case "warningTower":
      drawWarningTower(context, obstacle);
      break;
    case "ceilingDrone":
      drawDrone(context, obstacle, distance);
      break;
    case "laserGate":
      drawLaserGate(context, obstacle);
      break;
    case "lowArch":
      drawLowArch(context, obstacle);
      break;
    case "rollingBarrel":
      drawRollingBarrel(context, obstacle, distance);
      break;
    default:
      drawCrateStack(context, obstacle);
  }

  context.restore();
}

function drawCrateStack(context: CanvasRenderingContext2D, obstacle: BraveObstacle): void {
  context.fillStyle = "#e11d2e";
  for (let row = 0; row < 3; row += 1) {
    const size = 28;
    const x = obstacle.x + (row % 2) * 14;
    const y = obstacle.y + row * 25;
    context.fillRect(x, y, size, size);
    context.strokeStyle = "#6b0610";
    context.lineWidth = 3;
    context.strokeRect(x, y, size, size);
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + size, y + size);
    context.moveTo(x + size, y);
    context.lineTo(x, y + size);
    context.stroke();
  }
}

function drawWarningTower(context: CanvasRenderingContext2D, obstacle: BraveObstacle): void {
  context.fillStyle = "#190509";
  context.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
  context.fillStyle = "#ff3d5a";
  for (let y = obstacle.y + 8; y < obstacle.y + obstacle.height; y += 28) {
    context.fillRect(obstacle.x + 5, y, obstacle.width - 10, 12);
  }
  context.strokeStyle = "#f6ead0";
  context.lineWidth = 3;
  context.strokeRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
}

function drawDrone(context: CanvasRenderingContext2D, obstacle: BraveObstacle, distance: number): void {
  const bob = Math.sin(distance / 60 + obstacle.id) * 6;
  context.fillStyle = "#9f1020";
  roundCanvasRect(context, obstacle.x, obstacle.y + bob, obstacle.width, obstacle.height, 12);
  context.fill();
  context.fillStyle = "#ffccd3";
  context.fillRect(obstacle.x + 20, obstacle.y + 14 + bob, 44, 8);
  context.strokeStyle = "#ff3d5a";
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(obstacle.x + 12, obstacle.y + bob);
  context.lineTo(obstacle.x - 12, obstacle.y - 14 + bob);
  context.moveTo(obstacle.x + obstacle.width - 12, obstacle.y + bob);
  context.lineTo(obstacle.x + obstacle.width + 12, obstacle.y - 14 + bob);
  context.stroke();
}

function drawLaserGate(context: CanvasRenderingContext2D, obstacle: BraveObstacle): void {
  context.fillStyle = "#0a0a0a";
  context.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
  context.fillStyle = "#ff3d5a";
  context.fillRect(obstacle.x + 8, obstacle.y + 12, obstacle.width - 16, obstacle.height - 24);
  context.fillStyle = "rgba(255, 61, 90, 0.28)";
  context.fillRect(obstacle.x - 12, obstacle.y, obstacle.width + 24, obstacle.height);
  context.strokeStyle = "#f6ead0";
  context.lineWidth = 3;
  context.strokeRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
}

function drawLowArch(context: CanvasRenderingContext2D, obstacle: BraveObstacle): void {
  context.fillStyle = "#a50f1d";
  roundCanvasRect(context, obstacle.x, obstacle.y, obstacle.width, obstacle.height, 20);
  context.fill();
  context.strokeStyle = "#ffccd3";
  context.lineWidth = 4;
  context.stroke();
  context.fillStyle = "#ff3d5a";
  context.fillRect(obstacle.x + 18, obstacle.y + 16, obstacle.width - 36, 5);
}

function drawRollingBarrel(
  context: CanvasRenderingContext2D,
  obstacle: BraveObstacle,
  distance: number,
): void {
  const radius = obstacle.width / 2;
  context.save();
  context.translate(obstacle.x + radius, obstacle.y + radius);
  context.rotate(distance / 38);
  context.fillStyle = "#d7192d";
  context.beginPath();
  context.arc(0, 0, radius, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "#ffccd3";
  context.lineWidth = 4;
  context.beginPath();
  context.moveTo(-radius + 6, 0);
  context.lineTo(radius - 6, 0);
  context.moveTo(0, -radius + 6);
  context.lineTo(0, radius - 6);
  context.stroke();
  context.restore();
}

function drawWingedBuffalo(
  context: CanvasRenderingContext2D,
  y: number,
  distance: number,
  isBoosting: boolean,
): void {
  const wingLift = isBoosting ? Math.sin(distance / 18) * 5 - 8 : Math.sin(distance / 28) * 3;

  context.save();
  context.translate(BUFFALO_X, y);

  context.fillStyle = "rgba(0, 0, 0, 0.22)";
  context.beginPath();
  context.ellipse(36, 56, 34, 9, 0, 0, Math.PI * 2);
  context.fill();

  drawWing(context, 13, 29 + wingLift, -1);
  drawWing(context, 59, 29 + wingLift, 1);

  context.fillStyle = "#2b180f";
  context.beginPath();
  context.arc(36, 27, 24, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#140c08";
  context.beginPath();
  context.arc(36, 15, 23, Math.PI, 0);
  context.fill();

  context.fillStyle = "#f6ead0";
  context.beginPath();
  context.arc(14, 10, 15, Math.PI * 0.72, Math.PI * 1.58);
  context.arc(58, 10, 15, Math.PI * 1.42, Math.PI * 0.28);
  context.lineTo(56, 24);
  context.lineTo(16, 24);
  context.closePath();
  context.fill();

  context.fillStyle = "#3a2417";
  context.beginPath();
  context.ellipse(36, 35, 18, 12, 0, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#f6ead0";
  context.beginPath();
  context.arc(28, 24, 3.2, 0, Math.PI * 2);
  context.arc(44, 24, 3.2, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#050505";
  context.beginPath();
  context.arc(31, 36, 2.2, 0, Math.PI * 2);
  context.arc(41, 36, 2.2, 0, Math.PI * 2);
  context.fill();

  context.restore();
}

function drawWing(context: CanvasRenderingContext2D, x: number, y: number, direction: -1 | 1): void {
  context.save();
  context.translate(x, y);
  context.scale(direction, 1);

  context.fillStyle = "#f6ead0";
  context.beginPath();
  context.moveTo(0, 0);
  context.quadraticCurveTo(-28, -24, -47, 3);
  context.quadraticCurveTo(-25, 2, -14, 18);
  context.quadraticCurveTo(-7, 9, 0, 0);
  context.fill();

  context.strokeStyle = "rgba(43, 24, 15, 0.34)";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(-8, 5);
  context.lineTo(-34, -2);
  context.moveTo(-10, 9);
  context.lineTo(-28, 12);
  context.stroke();
  context.restore();
}

function drawBraveOverlay(context: CanvasRenderingContext2D, state: BraveState): void {
  context.fillStyle = "rgba(5, 5, 5, 0.54)";
  context.fillRect(18, 18, 172, 58);
  context.strokeStyle = "rgba(246, 234, 208, 0.18)";
  context.strokeRect(18, 18, 172, 58);
  context.fillStyle = "#f6ead0";
  context.font = "900 22px Inter, system-ui, sans-serif";
  context.fillText(String(state.score), 34, 52);
  context.fillStyle = "#f0c66a";
  context.font = "800 12px Inter, system-ui, sans-serif";
  context.fillText(`BEST ${state.best}`, 34, 68);

  if (state.phase === "playing") {
    return;
  }

  context.save();
  context.fillStyle = "rgba(5, 5, 5, 0.52)";
  context.fillRect(0, 0, BRAVE_WIDTH, FLOOR_Y);
  context.textAlign = "center";
  context.fillStyle = "#f6ead0";
  context.font = '900 34px Georgia, Cambria, "Times New Roman", serif';
  context.fillText(state.phase === "gameOver" ? "Run over" : "Hold to fly", BRAVE_WIDTH / 2, 214);
  context.fillStyle = state.phase === "gameOver" ? "#f0c66a" : "#35ff84";
  context.font = "850 16px Inter, system-ui, sans-serif";
  context.fillText(
    state.phase === "gameOver" ? "Better luck next time." : "Avoid the red hazards and chase a new best.",
    BRAVE_WIDTH / 2,
    246,
  );
  context.restore();
}

function roundCanvasRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function readBestScore(): number {
  const stored = window.localStorage.getItem(bestScoreKey);
  const parsed = stored ? Number(stored) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}
