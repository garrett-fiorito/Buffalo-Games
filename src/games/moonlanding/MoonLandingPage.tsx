import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { ArrowLeft, Fuel, Gauge, HeartPulse, Maximize2, Minimize2, Play, RotateCcw, Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import {
  MAX_FUEL,
  MAX_HEALTH,
  MOON_GROUND_Y,
  MOON_HEIGHT,
  MOON_WIDTH,
  PLANET_DISTANCE,
  SAFE_HORIZONTAL_SPEED,
  SAFE_LANDING_SPEED,
  SHIP_HEIGHT,
  SHIP_WIDTH,
  createInitialMoonLandingState,
  startMoonLanding,
  stepMoonLanding,
} from "./moonLandingEngine";
import type { MoonAsteroid, MoonControls, MoonGasStation, MoonLandingState, MoonShip } from "./moonLandingTypes";

const bestDistanceKey = "black-buffalo-moon-landing-best";

export function MoonLandingPage() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);
  const controlsRef = useRef<MoonControls>({ left: false, right: false, up: false });
  const stateRef = useRef<MoonLandingState>(createInitialMoonLandingState(readBestDistance()));
  const [state, setState] = useState(stateRef.current);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const updateState = useCallback((updater: (current: MoonLandingState) => MoonLandingState) => {
    setState((current) => {
      const next = updater(current);
      stateRef.current = next;
      return next;
    });
  }, []);

  const setControl = useCallback((control: keyof MoonControls, active: boolean) => {
    controlsRef.current = {
      ...controlsRef.current,
      [control]: active,
    };
  }, []);

  const beginMission = useCallback(() => {
    updateState((current) => startMoonLanding(current));
  }, [updateState]);

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
    document.body.classList.add("moon-game-active");

    return () => {
      document.body.classList.remove("moon-game-active");
    };
  }, []);

  useEffect(() => {
    drawMoonLanding(canvasRef.current, state, controlsRef.current);
    stateRef.current = state;

    if (state.best > 0) {
      window.localStorage.setItem(bestDistanceKey, String(state.best));
    }
  }, [state]);

  useEffect(() => {
    const tick = (timestamp: number) => {
      const lastFrame = lastFrameRef.current ?? timestamp;
      const deltaMs = timestamp - lastFrame;
      lastFrameRef.current = timestamp;

      updateState((current) => stepMoonLanding(current, deltaMs, controlsRef.current));
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
    const keyMap: Partial<Record<string, keyof MoonControls>> = {
      ArrowLeft: "left",
      ArrowRight: "right",
      ArrowUp: "up",
      KeyA: "left",
      KeyD: "right",
      KeyW: "up",
      Space: "up",
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const control = keyMap[event.code];

      if (!control) {
        return;
      }

      event.preventDefault();
      setControl(control, true);
      beginMission();
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const control = keyMap[event.code];

      if (!control) {
        return;
      }

      event.preventDefault();
      setControl(control, false);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [beginMission, setControl]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === stageRef.current);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const fuelPercent = Math.round((state.fuel / MAX_FUEL) * 100);
  const healthPercent = Math.round((state.health / MAX_HEALTH) * 100);
  const nextPlanetMeters = Math.max(0, state.nextPlanetDistance - state.distance);

  return (
    <section className="moon-view" aria-labelledby="moon-title">
      <div className="table-hero moon-hero">
        <div className="table-hero__copy">
          <Link className="back-link" to="/">
            <ArrowLeft size={18} aria-hidden="true" />
            Lobby
          </Link>
          <h1 id="moon-title">Moon Landing</h1>
        </div>
        <div className="table-stats moon-stats" aria-label="Moon Landing stats">
          <Stat label="Distance" value={`${state.distance}m`} icon={<Gauge />} />
          <Stat label="Best" value={`${state.best}m`} icon={<Trophy />} />
          <Stat label="Planet" value={state.planetIndex} icon={<Fuel />} />
        </div>
      </div>

      <div className="moon-layout">
        <div ref={stageRef} className="moon-stage" onContextMenu={(event) => event.preventDefault()}>
          <button
            className="moon-fullscreen-button"
            type="button"
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            onClick={handleFullscreen}
          >
            {isFullscreen ? <Minimize2 size={17} aria-hidden="true" /> : <Maximize2 size={17} aria-hidden="true" />}
            <span>{isFullscreen ? "Exit" : "Fullscreen"}</span>
          </button>
          <canvas
            ref={canvasRef}
            className="moon-canvas"
            width={MOON_WIDTH}
            height={MOON_HEIGHT}
            aria-label="Moon Landing game canvas"
            onPointerDown={() => beginMission()}
          />
          <div className="moon-mobile-controls" aria-label="Touch flight controls">
            <TouchButton label="Left" onChange={(active) => setControl("left", active)} />
            <TouchButton label="Thrust" primary onChange={(active) => setControl("up", active)} />
            <TouchButton label="Right" onChange={(active) => setControl("right", active)} />
          </div>
        </div>

        <aside className="moon-panel" aria-live="polite">
          <div>
            <span className="panel-kicker">Lunar run</span>
            <h2>{getMoonStatusTitle(state)}</h2>
            <p>{state.message}</p>
          </div>
          <div className="moon-bars" aria-label="Ship status">
            <Meter label="Fuel" value={fuelPercent} tone="fuel" />
            <Meter label="Health" value={healthPercent} tone="health" />
          </div>
          <div className="moon-readout">
            <span>Next planet</span>
            <strong>{nextPlanetMeters}m</strong>
          </div>
          <div className="moon-readout">
            <span>Landing limit</span>
            <strong>
              {SAFE_LANDING_SPEED}v / {SAFE_HORIZONTAL_SPEED}h
            </strong>
          </div>
          <button
            className="button button-primary"
            type="button"
            onClick={beginMission}
          >
            {state.phase === "gameOver" ? <RotateCcw size={18} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}
            {state.phase === "gameOver" ? "Restart mission" : "Start mission"}
          </button>
          <p className="table-note">Desktop: arrow keys or WASD. Mobile: use the touch buttons and fullscreen in landscape.</p>
        </aside>
      </div>
    </section>
  );
}

function TouchButton({
  label,
  primary,
  onChange,
}: {
  label: string;
  primary?: boolean;
  onChange: (active: boolean) => void;
}) {
  const handlePointer = (event: ReactPointerEvent<HTMLButtonElement>, active: boolean) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    onChange(active);
  };

  return (
    <button
      className={`moon-touch-button${primary ? " moon-touch-button--primary" : ""}`}
      type="button"
      onPointerDown={(event) => handlePointer(event, true)}
      onPointerUp={(event) => handlePointer(event, false)}
      onPointerCancel={(event) => handlePointer(event, false)}
      onPointerLeave={() => onChange(false)}
    >
      {label}
    </button>
  );
}

function Stat({ label, value, icon }: { label: string; value: string | number; icon: ReactNode }) {
  return (
    <div className="stat-pill">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Meter({ label, value, tone }: { label: string; value: number; tone: "fuel" | "health" }) {
  return (
    <div className="moon-meter">
      <span>
        {tone === "fuel" ? <Fuel size={16} aria-hidden="true" /> : <HeartPulse size={16} aria-hidden="true" />}
        {label}
      </span>
      <strong>{value}%</strong>
      <div>
        <span className={`moon-meter__fill moon-meter__fill--${tone}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function drawMoonLanding(
  canvas: HTMLCanvasElement | null,
  state: MoonLandingState,
  controls: MoonControls,
) {
  if (!canvas) {
    return;
  }

  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  context.clearRect(0, 0, MOON_WIDTH, MOON_HEIGHT);
  drawSpace(context, state.cameraX, state.planetIndex, state.checkpointFlashMs);
  drawTerrain(context, state.cameraX);
  drawPlanetGate(context, state.cameraX, state.nextPlanetDistance);
  state.gasStations.forEach((station) => drawGasStation(context, station, state.cameraX));
  state.asteroids.forEach((asteroid) => drawAsteroid(context, asteroid, state.cameraX));
  drawShip(context, state.ship, state.cameraX, controls);
  drawCanvasHud(context, state);
}

function drawSpace(context: CanvasRenderingContext2D, cameraX: number, planetIndex: number, flashMs: number) {
  const gradient = context.createLinearGradient(0, 0, 0, MOON_HEIGHT);
  gradient.addColorStop(0, flashMs > 0 ? "#172b4f" : "#081326");
  gradient.addColorStop(0.58, "#0a0d18");
  gradient.addColorStop(1, "#050505");
  context.fillStyle = gradient;
  context.fillRect(0, 0, MOON_WIDTH, MOON_HEIGHT);

  context.fillStyle = "rgba(246, 234, 208, 0.68)";
  for (let index = 0; index < 80; index += 1) {
    const x = ((index * 157 - cameraX * 0.22) % MOON_WIDTH + MOON_WIDTH) % MOON_WIDTH;
    const y = 26 + ((index * 89 + planetIndex * 31) % 390);
    const size = index % 7 === 0 ? 2 : 1;
    context.fillRect(x, y, size, size);
  }

  context.fillStyle = "rgba(240, 198, 106, 0.24)";
  context.beginPath();
  context.arc(980 - (cameraX * 0.05) % 220, 96, 56, 0, Math.PI * 2);
  context.fill();
}

function drawTerrain(context: CanvasRenderingContext2D, cameraX: number) {
  context.fillStyle = "#181716";
  context.beginPath();
  context.moveTo(0, MOON_GROUND_Y);
  for (let x = 0; x <= MOON_WIDTH; x += 60) {
    const worldX = cameraX + x;
    const ridge = Math.sin(worldX / 120) * 14 + Math.sin(worldX / 48) * 6;
    context.lineTo(x, MOON_GROUND_Y + ridge);
  }
  context.lineTo(MOON_WIDTH, MOON_HEIGHT);
  context.lineTo(0, MOON_HEIGHT);
  context.closePath();
  context.fill();

  context.strokeStyle = "rgba(246, 234, 208, 0.15)";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(0, MOON_GROUND_Y);
  context.lineTo(MOON_WIDTH, MOON_GROUND_Y);
  context.stroke();
}

function drawPlanetGate(context: CanvasRenderingContext2D, cameraX: number, nextPlanetDistance: number) {
  const x = nextPlanetDistance - cameraX;

  if (x < -120 || x > MOON_WIDTH + 160) {
    return;
  }

  context.save();
  context.translate(x, MOON_GROUND_Y - 132);
  context.shadowBlur = 24;
  context.shadowColor = "rgba(95, 239, 255, 0.7)";
  context.strokeStyle = "#5fefff";
  context.lineWidth = 5;
  context.beginPath();
  context.arc(0, 0, 74, 0, Math.PI * 2);
  context.stroke();
  context.fillStyle = "rgba(95, 239, 255, 0.12)";
  context.fill();
  context.shadowBlur = 0;
  context.fillStyle = "#f6ead0";
  context.font = "900 17px Inter, system-ui, sans-serif";
  context.textAlign = "center";
  context.fillText("PLANET", 0, 5);
  context.restore();
}

function drawGasStation(context: CanvasRenderingContext2D, station: MoonGasStation, cameraX: number) {
  const x = station.x - cameraX;

  if (x < -180 || x > MOON_WIDTH + 180) {
    return;
  }

  context.save();
  context.translate(x, station.y);
  context.fillStyle = station.used ? "rgba(80, 100, 94, 0.9)" : "#0d6f52";
  roundRect(context, 0, 0, station.width, station.height, 8);
  context.fill();
  context.strokeStyle = station.used ? "rgba(246, 234, 208, 0.26)" : "#35ff84";
  context.lineWidth = 3;
  context.stroke();
  context.fillStyle = station.used ? "#9aa49d" : "#f6ead0";
  context.font = "900 14px Inter, system-ui, sans-serif";
  context.textAlign = "center";
  context.fillText(station.used ? "USED" : "FUEL", station.width / 2, 17);
  context.fillStyle = "#d9aa42";
  roundRect(context, station.width * 0.38, -30, station.width * 0.24, 30, 6);
  context.fill();
  context.restore();
}

function drawAsteroid(context: CanvasRenderingContext2D, asteroid: MoonAsteroid, cameraX: number) {
  const x = asteroid.x - cameraX;

  if (x < -80 || x > MOON_WIDTH + 80 || asteroid.hit) {
    return;
  }

  context.save();
  context.translate(x, asteroid.y);
  context.fillStyle = "#795b4c";
  context.strokeStyle = "#2f211d";
  context.lineWidth = 3;
  context.beginPath();
  for (let index = 0; index < 9; index += 1) {
    const angle = (Math.PI * 2 * index) / 9;
    const radius = asteroid.radius * (0.78 + (index % 3) * 0.12);
    const px = Math.cos(angle) * radius;
    const py = Math.sin(angle) * radius;
    if (index === 0) {
      context.moveTo(px, py);
    } else {
      context.lineTo(px, py);
    }
  }
  context.closePath();
  context.fill();
  context.stroke();
  context.fillStyle = "rgba(246, 234, 208, 0.18)";
  context.beginPath();
  context.arc(-asteroid.radius * 0.2, -asteroid.radius * 0.18, asteroid.radius * 0.24, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawShip(context: CanvasRenderingContext2D, ship: MoonShip, cameraX: number, controls: MoonControls) {
  const x = ship.position.x - cameraX;
  const y = ship.position.y;

  context.save();
  context.translate(x, y);
  if (controls.up) {
    context.fillStyle = "#f0c66a";
    context.beginPath();
    context.moveTo(-10, SHIP_HEIGHT / 2 - 4);
    context.lineTo(0, SHIP_HEIGHT / 2 + 34);
    context.lineTo(10, SHIP_HEIGHT / 2 - 4);
    context.closePath();
    context.fill();
  }
  context.fillStyle = "#d9dde6";
  context.beginPath();
  context.moveTo(0, -SHIP_HEIGHT / 2);
  context.lineTo(SHIP_WIDTH / 2, SHIP_HEIGHT / 2 - 8);
  context.lineTo(0, SHIP_HEIGHT / 2);
  context.lineTo(-SHIP_WIDTH / 2, SHIP_HEIGHT / 2 - 8);
  context.closePath();
  context.fill();
  context.strokeStyle = "#111827";
  context.lineWidth = 3;
  context.stroke();
  context.fillStyle = "#5fefff";
  context.beginPath();
  context.arc(0, -10, 10, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#c9152a";
  context.fillRect(-SHIP_WIDTH / 2 - 8, SHIP_HEIGHT / 2 - 12, 14, 12);
  context.fillRect(SHIP_WIDTH / 2 - 6, SHIP_HEIGHT / 2 - 12, 14, 12);
  context.restore();
}

function drawCanvasHud(context: CanvasRenderingContext2D, state: MoonLandingState) {
  context.fillStyle = "rgba(5, 5, 5, 0.58)";
  roundRect(context, 18, 18, 292, 124, 8);
  context.fill();
  context.fillStyle = "#f6ead0";
  context.font = "900 20px Inter, system-ui, sans-serif";
  context.fillText(`${state.distance}m`, 36, 48);
  context.fillStyle = "#f0c66a";
  context.font = "900 13px Inter, system-ui, sans-serif";
  context.fillText(`PLANET ${state.planetIndex}`, 36, 72);
  drawHudBar(context, "FUEL", state.fuel / MAX_FUEL, 36, 88, "#35ff84");
  drawHudBar(context, "HEALTH", state.health / MAX_HEALTH, 36, 114, "#ff7a68");

  if (state.phase !== "playing") {
    context.fillStyle = "rgba(5, 5, 5, 0.72)";
    roundRect(context, MOON_WIDTH / 2 - 230, 210, 460, 116, 12);
    context.fill();
    context.fillStyle = "#f6ead0";
    context.font = "900 34px Fraunces, Georgia, serif";
    context.textAlign = "center";
    context.fillText(state.phase === "gameOver" ? "Mission Over" : "Moon Landing", MOON_WIDTH / 2, 258);
    context.fillStyle = "#b9c1b8";
    context.font = "800 15px Inter, system-ui, sans-serif";
    context.fillText(state.phase === "gameOver" ? state.message : "Arrow keys to thrust and steer.", MOON_WIDTH / 2, 292);
    context.textAlign = "left";
  }
}

function drawHudBar(
  context: CanvasRenderingContext2D,
  label: string,
  value: number,
  x: number,
  y: number,
  color: string,
) {
  const width = 184;
  const height = 9;
  const clamped = Math.max(0, Math.min(1, value));
  context.fillStyle = "#b9c1b8";
  context.font = "900 11px Inter, system-ui, sans-serif";
  context.fillText(label, x, y + 8);
  context.fillStyle = "rgba(246, 234, 208, 0.14)";
  roundRect(context, x + 68, y, width, height, 5);
  context.fill();
  context.fillStyle = color;
  roundRect(context, x + 68, y, width * clamped, height, 5);
  context.fill();
}

function getMoonStatusTitle(state: MoonLandingState): string {
  if (state.phase === "gameOver") {
    return "Mission over";
  }

  if (state.phase === "ready") {
    return "Ready for launch";
  }

  if (state.checkpointFlashMs > 0) {
    return "New planet reached";
  }

  return "Stay alive";
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
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function readBestDistance(): number {
  const raw = Number(window.localStorage.getItem(bestDistanceKey));
  return Number.isFinite(raw) ? raw : 0;
}
