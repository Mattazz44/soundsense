import { useEffect, useRef } from 'react';

const WAVE_LAYERS = [
  {
    hex: '#78716C',
    glow: 'rgba(120, 113, 108, 0.35)',
    baseAlpha: 0.26,
    activeAlpha: 0.41,
    freq: 0.0042,
    speed: 0.48,
    amp: 28,
    yRatio: 0.14,
    lineWidth: 1.85,
    phaseOffset: 0.3,
    boostRange: 84,
  },
  {
    hex: '#D97757',
    glow: 'rgba(217, 119, 87, 0.55)',
    baseAlpha: 0.31,
    activeAlpha: 0.45,
    freq: 0.0056,
    speed: 0.72,
    amp: 36,
    yRatio: 0.3,
    lineWidth: 2.25,
    phaseOffset: 1.5,
    boostRange: 102,
  },
  {
    hex: '#16A34A',
    glow: 'rgba(22, 163, 74, 0.45)',
    baseAlpha: 0.25,
    activeAlpha: 0.43,
    freq: 0.0046,
    speed: 0.62,
    amp: 42,
    yRatio: 0.48,
    lineWidth: 2.45,
    phaseOffset: 2.8,
    boostRange: 108,
  },
  {
    hex: '#D97757',
    glow: 'rgba(217, 119, 87, 0.55)',
    baseAlpha: 0.29,
    activeAlpha: 0.45,
    freq: 0.0068,
    speed: 0.84,
    amp: 38,
    yRatio: 0.64,
    lineWidth: 2.1,
    phaseOffset: 4.1,
    boostRange: 98,
  },
  {
    hex: '#78716C',
    glow: 'rgba(120, 113, 108, 0.35)',
    baseAlpha: 0.28,
    activeAlpha: 0.42,
    freq: 0.0038,
    speed: 0.52,
    amp: 31,
    yRatio: 0.8,
    lineWidth: 1.9,
    phaseOffset: 5.3,
    boostRange: 88,
  },
  {
    hex: '#16A34A',
    glow: 'rgba(22, 163, 74, 0.4)',
    baseAlpha: 0.25,
    activeAlpha: 0.39,
    freq: 0.0082,
    speed: 0.94,
    amp: 26,
    yRatio: 0.91,
    lineWidth: 1.85,
    phaseOffset: 6.4,
    boostRange: 82,
  },
];

export function SoundwaveBackground({
  isAnalyzing = false,
  isPlaying = false,
  tempo = 100,
  energy = 0.5,
  currentTime = 0,
}) {
  const canvasRef = useRef(null);
  const stateRef = useRef({
    isAnalyzing,
    isPlaying,
    tempo,
    energy,
    currentTime,
  });

  stateRef.current = {
    isAnalyzing,
    isPlaying,
    tempo,
    energy,
    currentTime,
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let prefersReduced = reducedMotionQuery.matches;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let rafId = null;
    let phaseClock = 0;
    let smoothActivity = 0;
    let lastTimestamp = performance.now();

    const pointer = {
      x: -9999,
      y: -9999,
      targetX: -9999,
      targetY: -9999,
      strength: 0,
    };

    function resizeCanvas() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (prefersReduced) {
        drawFrame(0, 0);
      }
    }

    function onPointerMove(event) {
      const clientX = event.touches ? event.touches[0]?.clientX : event.clientX;
      const clientY = event.touches ? event.touches[0]?.clientY : event.clientY;
      if (typeof clientX !== 'number' || typeof clientY !== 'number') return;
      if (pointer.strength <= 0.02) {
        pointer.x = clientX;
        pointer.y = clientY;
      }
      pointer.targetX = clientX;
      pointer.targetY = clientY;
      pointer.strength = 1;
    }

    function drawFrame(dt, elapsedPhase) {
      ctx.clearRect(0, 0, width, height);

      const {
        isAnalyzing: analyzing,
        isPlaying: playing,
        tempo: activeTempo,
        energy: activeEnergy,
        currentTime: trackTime,
      } = stateRef.current;

      const targetActivity = analyzing
        ? 0.95
        : playing
          ? 0.7 + Math.min(0.45, activeEnergy * 0.45)
          : 0;
      smoothActivity += (targetActivity - smoothActivity) * Math.min(1, dt * 3.8);

      const safeTempo = Number.isFinite(activeTempo) ? Math.min(180, Math.max(60, activeTempo)) : 100;
      const beatPulse = playing
        ? 0.9 +
          0.35 *
            Math.pow(
              Math.abs(Math.sin((trackTime || elapsedPhase) * (safeTempo / 60) * Math.PI)),
              1.4
            )
        : analyzing
          ? 1.18 + 0.2 * Math.sin(elapsedPhase * 2.2)
          : 1;

      if (pointer.strength > 0.005) {
        pointer.x += (pointer.targetX - pointer.x) * Math.min(1, dt * 14);
        pointer.y += (pointer.targetY - pointer.y) * Math.min(1, dt * 14);
      }
      pointer.strength = Math.max(0, pointer.strength - dt * 0.55);

      const stepX = width > 900 ? 10 : 8;
      const radiusX = 250;
      const twoSigmaSq = 2 * radiusX * radiusX;
      const verticalRadius = 320;
      const twoVerticalSq = 2 * verticalRadius * verticalRadius;

      for (const layer of WAVE_LAYERS) {
        const baseY = height * layer.yRatio;
        const verticalProximity =
          pointer.strength > 0.01
            ? Math.exp(-Math.pow(baseY - pointer.y, 2) / twoVerticalSq)
            : 0;
        const localActivity = Math.min(
          1,
          Math.max(smoothActivity, pointer.strength * verticalProximity * 0.9)
        );
        const alpha = layer.baseAlpha + (layer.activeAlpha - layer.baseAlpha) * localActivity;
        const dynamicAmp = layer.amp * (1 + smoothActivity * 0.55) * beatPulse;

        const points = [];
        for (let x = 0; x <= width + stepX; x += stepX) {
          const primaryWave = Math.sin(
            x * layer.freq + elapsedPhase * layer.speed + layer.phaseOffset
          );
          const harmonicWave =
            0.34 *
            Math.sin(
              x * (layer.freq * 2.1) - elapsedPhase * (layer.speed * 0.68) + layer.phaseOffset
            );

          let cursorBoost = 0;
          if (pointer.strength > 0.01 && verticalProximity > 0.04) {
            const dx = x - pointer.x;
            if (Math.abs(dx) <= radiusX * 2.6) {
              const gaussian = Math.exp(-(dx * dx) / twoSigmaSq);
              const crestRipple =
                0.65 * Math.sin(dx * 0.028 - elapsedPhase * 4.4) +
                0.35 * Math.cos(dx * 0.014 + layer.phaseOffset);
              cursorBoost =
                gaussian *
                verticalProximity *
                pointer.strength *
                layer.boostRange *
                (crestRipple - 0.18);
            }
          }

          const y = baseY + (primaryWave + harmonicWave) * dynamicAmp + cursorBoost;
          points.push(x, y);
        }

        // Subtle luminous outer crest glow so peaks remain crisp over cream and frosted cards.
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(points[0], points[1]);
        for (let i = 2; i < points.length; i += 2) {
          ctx.lineTo(points[i], points[i + 1]);
        }
        ctx.strokeStyle = layer.hex;
        ctx.globalAlpha = Math.min(0.16, alpha * 0.36);
        ctx.lineWidth = layer.lineWidth + 3.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowColor = layer.glow;
        ctx.shadowBlur = pointer.strength > 0.04 || analyzing || playing ? 12 : 6;
        ctx.stroke();

        // Main sharp wave stroke.
        ctx.globalAlpha = alpha;
        ctx.lineWidth = layer.lineWidth;
        ctx.shadowBlur = pointer.strength > 0.04 ? 8 : 3;
        ctx.stroke();
        ctx.restore();
      }
    }

    function animate(now) {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTimestamp) / 1000));
      lastTimestamp = now;

      const { isAnalyzing: analyzing, isPlaying: playing, tempo: activeTempo } = stateRef.current;
      const speedFactor = analyzing
        ? 1.9
        : playing
          ? Math.max(0.85, (activeTempo || 100) / 95)
          : 0.78;
      phaseClock += dt * speedFactor;

      drawFrame(dt, phaseClock);
      rafId = window.requestAnimationFrame(animate);
    }

    function onMotionPrefChange(event) {
      prefersReduced = event.matches;
      if (prefersReduced) {
        if (rafId) window.cancelAnimationFrame(rafId);
        rafId = null;
        drawFrame(0, 0);
      } else if (!rafId) {
        lastTimestamp = performance.now();
        rafId = window.requestAnimationFrame(animate);
      }
    }

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('mousemove', onPointerMove, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    reducedMotionQuery.addEventListener('change', onMotionPrefChange);

    if (!prefersReduced) {
      rafId = window.requestAnimationFrame(animate);
    }

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('touchmove', onPointerMove);
      reducedMotionQuery.removeEventListener('change', onMotionPrefChange);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-0"
    />
  );
}
