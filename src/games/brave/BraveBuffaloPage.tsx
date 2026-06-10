import { useCallback, useEffect, useRef, useState } from "react";
import type { MutableRefObject, ReactNode } from "react";
import { ArrowLeft, Gauge, Maximize2, Minimize2, Play, RotateCcw, Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import {
  BRAVE_HEIGHT,
  BRAVE_WIDTH,
  BUFFALO_HEIGHT,
  BUFFALO_WIDTH,
  BUFFALO_X,
  FLOOR_Y,
  createInitialBraveState,
  startBrave,
  stepBrave,
} from "./braveEngine";
import type { BraveObstacle, BraveState, FuelSpark } from "./braveTypes";

type JetParticle = {
  id: number;
  x: number;
  y: number;
  radius: number;
  velocityX: number;
  velocityY: number;
  life: number;
  color: string;
};

const bestScoreKey = "black-buffalo-brave-best";

export function BraveBuffaloPage() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);
  const inputHeldRef = useRef(false);
  const stateRef = useRef<BraveState>(createInitialBraveState(readBestScore()));
  const particlesRef = useRef<JetParticle[]>([]);
  const particleIdRef = useRef(0);
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
    drawBrave(canvasRef.current, state, particlesRef.current, inputHeldRef.current);
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
      const deltaSeconds = Math.min(deltaMs, 48) / 1000;

      updateState((current) => {
        const next =
          current.phase === "playing" ? stepBrave(current, deltaMs, inputHeldRef.current) : current;
        updateParticles(
          particlesRef.current,
          next,
          inputHeldRef.current,
          deltaSeconds,
          particleIdRef,
        );
        return next;
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
    state.phase === "gameOver" ? "Restart run" : state.phase === "ready" ? "Start run" : "Boost";
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
          onPointerDown={beginBoost}
          onPointerUp={endBoost}
          onPointerCancel={endBoost}
          onPointerLeave={endBoost}
        >
          <button
            className="brave-fullscreen-button"
            type="button"
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            onClick={handleFullscreen}
            onPointerDown={(event) => event.stopPropagation()}
            onPointerUp={(event) => event.stopPropagation()}
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
          />
        </div>

        <aside className="brave-panel" aria-live="polite">
          <div>
            <span className="panel-kicker">Jetpack run</span>
            <h2>{getStatusTitle(state)}</h2>
            <p>{getStatusMessage(state)}</p>
          </div>
          <div className="brave-bonus-readout">
            <span>Bonus</span>
            <strong>{getBonusText(state)}</strong>
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
    return "Run ended";
  }

  if (state.phase === "playing") {
    return "Hold to fly";
  }

  return "Ready";
}

function getStatusMessage(state: BraveState): string {
  if (state.phase === "gameOver") {
    return "Hit start to launch a fresh run and chase your best distance.";
  }

  if (state.phase === "playing") {
    return "Release to drop, hold to rise, and skim hazards for near-miss points.";
  }

  return "Hold the button, press Space, or touch the game to fire the jetpack.";
}

function getBonusText(state: BraveState): string {
  if (state.lastEvent === "spark") {
    return "Fuel spark +50";
  }

  if (state.lastEvent === "nearMiss") {
    return "Near miss +25";
  }

  return "Collect sparks and thread close calls.";
}

function updateParticles(
  particles: JetParticle[],
  state: BraveState,
  isBoosting: boolean,
  deltaSeconds: number,
  particleId: MutableRefObject<number>,
): void {
  const scroll = state.speed * deltaSeconds;

  for (let index = particles.length - 1; index >= 0; index -= 1) {
    const particle = particles[index];
    particle.life -= deltaSeconds;
    particle.x += particle.velocityX * deltaSeconds - scroll;
    particle.y += particle.velocityY * deltaSeconds;
    particle.radius *= 0.985;

    if (particle.life <= 0 || particle.radius <= 0.7) {
      particles.splice(index, 1);
    }
  }

  if (state.phase === "playing" && isBoosting) {
    for (let index = 0; index < 3; index += 1) {
      particles.push({
        id: particleId.current,
        x: BUFFALO_X - 2,
        y: state.buffaloY + BUFFALO_HEIGHT - 10 + index * 4,
        radius: 5 + index * 1.4,
        velocityX: -90 - index * 36,
        velocityY: 80 + index * 32,
        life: 0.32,
        color: index === 0 ? "#fff2a8" : index === 1 ? "#ff9d3d" : "#35ff84",
      });
      particleId.current += 1;
    }
  }

  if (state.phase === "playing" && state.buffaloY + BUFFALO_HEIGHT >= FLOOR_Y - 1 && !isBoosting) {
    particles.push({
      id: particleId.current,
      x: BUFFALO_X + 20,
      y: FLOOR_Y - 8,
      radius: 4,
      velocityX: -120,
      velocityY: -28,
      life: 0.42,
      color: "rgba(246, 234, 208, 0.52)",
    });
    particleId.current += 1;
  }
}

function drawBrave(
  canvas: HTMLCanvasElement | null,
  state: BraveState,
  particles: JetParticle[],
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
  state.sparks.forEach((spark) => drawSpark(context, spark, state.distance));
  state.obstacles.forEach((obstacle) => drawObstacle(context, obstacle, state.distance));
  drawParticles(context, particles);
  drawBuffalo(context, state.buffaloY, isBoosting);
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
  context.fillStyle = "#f0a33c";
  for (let row = 0; row < 3; row += 1) {
    const size = 28;
    const x = obstacle.x + (row % 2) * 14;
    const y = obstacle.y + row * 25;
    context.fillRect(x, y, size, size);
    context.strokeStyle = "#5b3218";
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
  context.fillStyle = "#141414";
  context.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
  context.fillStyle = "#f0c66a";
  for (let y = obstacle.y + 8; y < obstacle.y + obstacle.height; y += 28) {
    context.fillRect(obstacle.x + 5, y, obstacle.width - 10, 12);
  }
  context.strokeStyle = "#35ff84";
  context.lineWidth = 3;
  context.strokeRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
}

function drawDrone(context: CanvasRenderingContext2D, obstacle: BraveObstacle, distance: number): void {
  const bob = Math.sin(distance / 60 + obstacle.id) * 6;
  context.fillStyle = "#2e3f55";
  roundCanvasRect(context, obstacle.x, obstacle.y + bob, obstacle.width, obstacle.height, 12);
  context.fill();
  context.fillStyle = "#35ff84";
  context.fillRect(obstacle.x + 20, obstacle.y + 14 + bob, 44, 8);
  context.strokeStyle = "#f6ead0";
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
  context.fillStyle = "#6f4a2f";
  roundCanvasRect(context, obstacle.x, obstacle.y, obstacle.width, obstacle.height, 20);
  context.fill();
  context.strokeStyle = "#f0c66a";
  context.lineWidth = 4;
  context.stroke();
  context.fillStyle = "#35ff84";
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
  context.fillStyle = "#b9572e";
  context.beginPath();
  context.arc(0, 0, radius, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "#f0c66a";
  context.lineWidth = 4;
  context.beginPath();
  context.moveTo(-radius + 6, 0);
  context.lineTo(radius - 6, 0);
  context.moveTo(0, -radius + 6);
  context.lineTo(0, radius - 6);
  context.stroke();
  context.restore();
}

function drawSpark(context: CanvasRenderingContext2D, spark: FuelSpark, distance: number): void {
  const pulse = Math.sin(distance / 34 + spark.id) * 2;
  context.fillStyle = "rgba(53, 255, 132, 0.18)";
  context.beginPath();
  context.arc(spark.x, spark.y, spark.radius + 10 + pulse, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#35ff84";
  context.beginPath();
  context.arc(spark.x, spark.y, spark.radius + pulse * 0.3, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#f6ead0";
  context.fillRect(spark.x - 2, spark.y - spark.radius - 5, 4, spark.radius * 2 + 10);
  context.fillRect(spark.x - spark.radius - 5, spark.y - 2, spark.radius * 2 + 10, 4);
}

function drawParticles(context: CanvasRenderingContext2D, particles: JetParticle[]): void {
  particles.forEach((particle) => {
    context.fillStyle = particle.color;
    context.globalAlpha = Math.max(0, Math.min(1, particle.life * 3));
    context.beginPath();
    context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 1;
  });
}

function drawBuffalo(context: CanvasRenderingContext2D, y: number, isBoosting: boolean): void {
  context.save();
  context.translate(BUFFALO_X, y);

  context.fillStyle = "#6f3e24";
  roundCanvasRect(context, 8, 14, BUFFALO_WIDTH - 12, 34, 16);
  context.fill();

  context.fillStyle = "#2d1a10";
  roundCanvasRect(context, 18, 5, 38, 34, 17);
  context.fill();

  context.fillStyle = "#f6ead0";
  context.beginPath();
  context.arc(14, 9, 14, Math.PI * 0.72, Math.PI * 1.56);
  context.arc(58, 9, 14, Math.PI * 1.44, Math.PI * 0.28);
  context.lineTo(56, 20);
  context.lineTo(16, 20);
  context.closePath();
  context.fill();

  context.fillStyle = "#f6ead0";
  context.beginPath();
  context.arc(31, 19, 3.4, 0, Math.PI * 2);
  context.arc(47, 19, 3.4, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#a96f39";
  roundCanvasRect(context, 30, 29, 24, 15, 8);
  context.fill();

  context.fillStyle = "#30363d";
  roundCanvasRect(context, -2, 25, 20, 19, 5);
  context.fill();

  if (isBoosting) {
    const flame = context.createLinearGradient(5, 40, 5, 72);
    flame.addColorStop(0, "#fff2a8");
    flame.addColorStop(0.42, "#ff9d3d");
    flame.addColorStop(1, "rgba(255, 61, 90, 0)");
    context.fillStyle = flame;
    context.beginPath();
    context.moveTo(2, 42);
    context.lineTo(16, 42);
    context.lineTo(9, 76);
    context.closePath();
    context.fill();
  }

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
    if (state.lastEvent) {
      context.fillStyle = state.lastEvent === "spark" ? "#35ff84" : "#f0c66a";
      context.font = "900 18px Inter, system-ui, sans-serif";
      context.fillText(state.lastEvent === "spark" ? "+50 SPARK" : "+25 NEAR MISS", 360, 72);
    }
    return;
  }

  context.save();
  context.fillStyle = "rgba(5, 5, 5, 0.52)";
  context.fillRect(0, 0, BRAVE_WIDTH, FLOOR_Y);
  context.textAlign = "center";
  context.fillStyle = "#f6ead0";
  context.font = '900 34px Georgia, Cambria, "Times New Roman", serif';
  context.fillText(state.phase === "gameOver" ? "Run Over" : "Hold to Boost", BRAVE_WIDTH / 2, 214);
  context.fillStyle = "#35ff84";
  context.font = "850 16px Inter, system-ui, sans-serif";
  context.fillText("Dodge six hazard types, collect sparks, and chase a new best.", BRAVE_WIDTH / 2, 246);
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
