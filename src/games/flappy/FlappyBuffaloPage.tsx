import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ArrowLeft, Maximize2, Minimize2, Play, RotateCcw, Trophy, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import {
  BUFFALO_RADIUS,
  BUFFALO_X,
  FLAPPY_HEIGHT,
  FLAPPY_WIDTH,
  FLOOR_HEIGHT,
  PIPE_GAP,
  PIPE_WIDTH,
  PLAYABLE_BOTTOM,
  createInitialFlappyState,
  flap,
  stepFlappy,
} from "./flappyEngine";
import type { FlappyState, PipePair } from "./flappyTypes";

const bestScoreKey = "black-buffalo-flappy-best";

export function FlappyBuffaloPage() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);
  const stateRef = useRef<FlappyState>(createInitialFlappyState(readBestScore()));
  const [state, setState] = useState(stateRef.current);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const updateState = useCallback((updater: (current: FlappyState) => FlappyState) => {
    setState((current) => {
      const next = updater(current);
      stateRef.current = next;
      return next;
    });
  }, []);

  const handleFlap = useCallback(() => {
    updateState((current) => flap(current));
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
    drawFlappy(canvasRef.current, state);
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

      updateState((current) =>
        current.phase === "playing" ? stepFlappy(current, deltaMs) : current,
      );
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
      if (event.code === "Space") {
        event.preventDefault();
        handleFlap();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleFlap]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === stageRef.current);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const actionLabel =
    state.phase === "gameOver" ? "Restart" : state.phase === "ready" ? "Start" : "Flap";
  const actionIcon = state.phase === "gameOver" ? <RotateCcw size={18} /> : <Play size={18} />;

  return (
    <section className="flappy-view" aria-labelledby="flappy-title">
      <div className="table-hero flappy-hero">
        <div className="table-hero__copy">
          <Link className="back-link" to="/">
            <ArrowLeft size={18} aria-hidden="true" />
            Lobby
          </Link>
          <h1 id="flappy-title">Flappy Buffalo</h1>
        </div>
        <div className="table-stats" aria-label="Flappy Buffalo stats">
          <Stat label="Score" value={state.score} icon={<Zap />} />
          <Stat label="Best" value={state.best} icon={<Trophy />} />
        </div>
      </div>

      <div className="flappy-layout">
        <div ref={stageRef} className="flappy-stage">
          <button
            className="flappy-fullscreen-button"
            type="button"
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            onClick={handleFullscreen}
            onPointerDown={(event) => event.stopPropagation()}
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
            className="flappy-canvas"
            width={FLAPPY_WIDTH}
            height={FLAPPY_HEIGHT}
            aria-label="Flappy Buffalo game canvas"
            onPointerDown={handleFlap}
          />
        </div>

        <aside className="flappy-panel" aria-live="polite">
          <div>
            <span className="panel-kicker">Buffalo altitude</span>
            <h2>{getStatusTitle(state)}</h2>
            <p>{getStatusMessage(state)}</p>
          </div>

          <button className="button button-primary" type="button" onClick={handleFlap}>
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

function getStatusTitle(state: FlappyState): string {
  if (state.phase === "gameOver") {
    return "Flight ended";
  }

  if (state.phase === "playing") {
    return "Keep climbing";
  }

  return "Ready";
}

function getStatusMessage(state: FlappyState): string {
  if (state.phase === "gameOver") {
    return "Tap restart and thread the buffalo between the green gates.";
  }

  if (state.phase === "playing") {
    return "Tap, click, or press Space to keep the buffalo airborne.";
  }

  return "Tap, click, or press Space to start.";
}

function drawFlappy(canvas: HTMLCanvasElement | null, state: FlappyState): void {
  if (!canvas) {
    return;
  }

  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  context.clearRect(0, 0, FLAPPY_WIDTH, FLAPPY_HEIGHT);
  drawBackdrop(context);
  state.pipes.forEach((pipe) => drawPipe(context, pipe));
  drawGround(context);
  drawBuffaloFace(context, state.buffaloY, state.phase);
  drawOverlay(context, state);
}

function drawBackdrop(context: CanvasRenderingContext2D): void {
  const skyGradient = context.createLinearGradient(0, 0, 0, PLAYABLE_BOTTOM);
  skyGradient.addColorStop(0, "#050505");
  skyGradient.addColorStop(0.52, "#0c1f18");
  skyGradient.addColorStop(1, "#102b1f");
  context.fillStyle = skyGradient;
  context.fillRect(0, 0, FLAPPY_WIDTH, FLAPPY_HEIGHT);

  context.strokeStyle = "rgba(240, 198, 106, 0.14)";
  context.lineWidth = 1;
  for (let x = 28; x < FLAPPY_WIDTH; x += 54) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x - 90, PLAYABLE_BOTTOM);
    context.stroke();
  }
}

function drawPipe(context: CanvasRenderingContext2D, pipe: PipePair): void {
  const gapTop = pipe.gapY - PIPE_GAP / 2;
  const gapBottom = pipe.gapY + PIPE_GAP / 2;

  drawPipeSegment(context, pipe.x, 0, gapTop, true);
  drawPipeSegment(context, pipe.x, gapBottom, PLAYABLE_BOTTOM - gapBottom, false);
}

function drawPipeSegment(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  height: number,
  isTop: boolean,
): void {
  const capHeight = 24;
  const capY = isTop ? y + height - capHeight : y;
  const bodyY = isTop ? y : y + capHeight;
  const bodyHeight = Math.max(0, height - capHeight);
  const gradient = context.createLinearGradient(x, 0, x + PIPE_WIDTH, 0);
  gradient.addColorStop(0, "#0f8f55");
  gradient.addColorStop(0.48, "#3dff84");
  gradient.addColorStop(1, "#0a5c38");

  context.fillStyle = gradient;
  context.fillRect(x + 7, bodyY, PIPE_WIDTH - 14, bodyHeight);
  context.fillRect(x, capY, PIPE_WIDTH, capHeight);
  context.strokeStyle = "rgba(246, 234, 208, 0.28)";
  context.lineWidth = 2;
  context.strokeRect(x, capY, PIPE_WIDTH, capHeight);
}

function drawGround(context: CanvasRenderingContext2D): void {
  context.fillStyle = "#080705";
  context.fillRect(0, PLAYABLE_BOTTOM, FLAPPY_WIDTH, FLOOR_HEIGHT);
  context.fillStyle = "#d7a448";
  context.fillRect(0, PLAYABLE_BOTTOM, FLAPPY_WIDTH, 3);

  context.fillStyle = "rgba(246, 234, 208, 0.12)";
  for (let x = 0; x < FLAPPY_WIDTH; x += 34) {
    context.fillRect(x, PLAYABLE_BOTTOM + 18, 18, 3);
  }
}

function drawBuffaloFace(
  context: CanvasRenderingContext2D,
  y: number,
  phase: FlappyState["phase"],
): void {
  context.save();
  context.translate(BUFFALO_X, y);
  context.rotate(phase === "gameOver" ? 0.18 : -0.08);

  context.fillStyle = "#f6ead0";
  context.beginPath();
  context.arc(-20, -10, 16, Math.PI * 0.8, Math.PI * 1.55);
  context.arc(20, -10, 16, Math.PI * 1.45, Math.PI * 0.2);
  context.lineTo(20, 2);
  context.lineTo(-20, 2);
  context.closePath();
  context.fill();

  context.fillStyle = "#26170f";
  context.beginPath();
  context.arc(0, 0, BUFFALO_RADIUS, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#140c08";
  context.beginPath();
  context.arc(0, -11, 22, Math.PI, 0);
  context.fill();

  context.fillStyle = "#3a2417";
  context.beginPath();
  context.ellipse(0, 9, 18, 12, 0, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#f6ead0";
  context.beginPath();
  context.arc(-8, -3, 3.2, 0, Math.PI * 2);
  context.arc(8, -3, 3.2, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#050505";
  context.beginPath();
  context.arc(-5, 9, 2.4, 0, Math.PI * 2);
  context.arc(5, 9, 2.4, 0, Math.PI * 2);
  context.fill();

  context.restore();
}

function drawOverlay(context: CanvasRenderingContext2D, state: FlappyState): void {
  if (state.phase === "playing") {
    return;
  }

  context.save();
  context.fillStyle = "rgba(5, 5, 5, 0.48)";
  context.fillRect(0, 0, FLAPPY_WIDTH, PLAYABLE_BOTTOM);
  context.textAlign = "center";
  context.fillStyle = "#f6ead0";
  context.font = '800 26px Georgia, Cambria, "Times New Roman", serif';
  context.fillText(state.phase === "gameOver" ? "Game Over" : "Tap to Fly", FLAPPY_WIDTH / 2, 256);
  context.font = "800 16px Inter, system-ui, sans-serif";
  context.fillStyle = "#f0c66a";
  context.fillText(`Score ${state.score}`, FLAPPY_WIDTH / 2, 286);
  context.restore();
}

function readBestScore(): number {
  const stored = window.localStorage.getItem(bestScoreKey);
  const parsed = stored ? Number(stored) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}
