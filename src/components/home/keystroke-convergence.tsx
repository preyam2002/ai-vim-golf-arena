"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";

type Props = {
  className?: string;
};

export type KeystrokeConvergenceHandle = {
  pulse: () => void;
};

export const KeystrokeConvergence = forwardRef<
  KeystrokeConvergenceHandle,
  Props
>(function KeystrokeConvergence({ className }: Props, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pulseRef = useRef<() => void>(() => {});
  const [fallback, setFallback] = useState(false);

  useImperativeHandle(
    ref,
    () => ({
      pulse: () => pulseRef.current?.(),
    }),
    []
  );

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    let teardown: (() => void) | undefined;
    let started = false;
    let cancelled = false;

    const startEffect = async () => {
      const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;
      const isMobile = window.matchMedia("(max-width: 768px)").matches;

      let THREE: typeof import("three");
      try {
        THREE = await import("three");
      } catch (err) {
        console.warn("Three.js failed to load", err);
        setFallback(true);
        return;
      }

      if (cancelled) return;

      let renderer: import("three").WebGLRenderer | null = null;
      try {
        renderer = new THREE.WebGLRenderer({
          canvas,
          antialias: false,
          alpha: true,
          powerPreference: "high-performance",
        });
      } catch (err) {
        console.warn("WebGL unavailable, showing fallback", err);
        setFallback(true);
        return;
      }

      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;

      const scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(new THREE.Color("#050507"), 0.08);

      const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
      camera.position.set(0, 0, 12);

      const particleCount = isMobile ? 1400 : 2200;
      const areaWidth = 11;
      const areaHeight = 6;

      const basePositions = new Float32Array(particleCount * 3);
      const targetPositions = new Float32Array(particleCount * 3);
      const sizes = new Float32Array(particleCount);
      const phaseSeeds = new Float32Array(particleCount);

      const { sampledPositions } = buildMask(
        areaWidth,
        areaHeight,
        particleCount
      );

      for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        const jitterX = (Math.random() - 0.5) * 0.5;
        const jitterY = (Math.random() - 0.5) * 0.35;
        basePositions[i3] = (Math.random() - 0.5) * areaWidth + jitterX;
        basePositions[i3 + 1] = (Math.random() - 0.5) * areaHeight + jitterY;
        basePositions[i3 + 2] = (Math.random() - 0.5) * 0.8 - 2.4;

        const sample = sampledPositions[i % sampledPositions.length];
        targetPositions[i3] = sample.x + (Math.random() - 0.5) * 0.12;
        targetPositions[i3 + 1] = sample.y + (Math.random() - 0.5) * 0.12;
        targetPositions[i3 + 2] = -2.2 + (Math.random() - 0.5) * 0.15;

        sizes[i] = 1.1 + Math.random() * (isMobile ? 1.0 : 1.4);
        phaseSeeds[i] = Math.random() * Math.PI * 2;
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(basePositions, 3).setUsage(
          THREE.DynamicDrawUsage
        )
      );
      geometry.setAttribute(
        "aSize",
        new THREE.Float32BufferAttribute(sizes, 1)
      );

      const material = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uAlpha: {
            value: prefersReducedMotion ? 0.35 : isMobile ? 0.65 : 0.85,
          },
        },
        vertexShader: `
          attribute float aSize;
          uniform float uTime;
          varying float vStrength;
          void main() {
            vStrength = 0.6 + 0.4 * sin(uTime * 0.7 + aSize * 2.1);
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = aSize * (120.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
          }
        `,
        fragmentShader: `
          varying float vStrength;
          void main() {
            float d = length(gl_PointCoord - 0.5);
            float alpha = smoothstep(0.5, 0.0, d) * vStrength;
            vec3 color = mix(vec3(0.4, 0.95, 0.7), vec3(0.55, 0.75, 1.0), d * 1.2);
            gl_FragColor = vec4(color, alpha);
          }
        `,
      });

      const points = new THREE.Points(geometry, material);
      points.position.set(0, 0.4, 0);
      scene.add(points);

      let isVisible = true;
      let frame = 0;
      let start = performance.now();
      let focus = 0;

      const resize = () => {
        const { width, height } = container.getBoundingClientRect();
        if (width === 0 || height === 0) return;
        renderer!.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      };
      resize();

      const observer = new ResizeObserver(resize);
      observer.observe(container);

      const visibilityObserver = new IntersectionObserver(
        (entries) => {
          isVisible = entries.some((entry) => entry.isIntersecting);
        },
        { rootMargin: "120px" }
      );
      visibilityObserver.observe(container);

      const positionsAttr = geometry.getAttribute(
        "position"
      ) as THREE.BufferAttribute;

      pulseRef.current = () => {
        start = performance.now();
        focus = 0;
      };

      const renderLoop = (time: number) => {
        frame = requestAnimationFrame(renderLoop);
        if (!isVisible) return;

        const elapsed = (time - start) / 1000;
        const focusTarget = prefersReducedMotion
          ? 0
          : focusTimeline(elapsed, THREE);
        focus = THREE.MathUtils.lerp(focus, focusTarget, 0.05);

        const driftStrength = prefersReducedMotion ? 0 : isMobile ? 0.16 : 0.22;
        const wobbleStrength = prefersReducedMotion ? 0 : isMobile ? 0.1 : 0.14;

        for (let i = 0; i < particleCount; i++) {
          const i3 = i * 3;
          const baseX = basePositions[i3];
          const baseY = basePositions[i3 + 1];
          const baseZ = basePositions[i3 + 2];

          const targetX = targetPositions[i3];
          const targetY = targetPositions[i3 + 1];
          const targetZ = targetPositions[i3 + 2];

          const drift = Math.sin(elapsed * 0.6 + phaseSeeds[i]) * driftStrength;
          const wobble =
            Math.cos(elapsed * 0.35 + phaseSeeds[i] * 0.6) * wobbleStrength;

          positionsAttr.array[i3] =
            THREE.MathUtils.lerp(baseX, targetX, focus) + drift * 0.55;
          positionsAttr.array[i3 + 1] =
            THREE.MathUtils.lerp(baseY, targetY, focus) + wobble * 0.65;
          positionsAttr.array[i3 + 2] =
            THREE.MathUtils.lerp(baseZ, targetZ, focus) + drift * 0.18;
        }

        positionsAttr.needsUpdate = true;
        material.uniforms.uTime.value = elapsed;
        renderer!.render(scene, camera);
      };

      frame = requestAnimationFrame(renderLoop);

      teardown = () => {
        cancelAnimationFrame(frame);
        visibilityObserver.disconnect();
        observer.disconnect();
        geometry.dispose();
        material.dispose();
        renderer?.dispose();
      };
    };

    const maybeStart = (entries?: IntersectionObserverEntry[]) => {
      if (started) return;
      if (!entries || entries.some((entry) => entry.isIntersecting)) {
        started = true;
        startEffect();
      }
    };

    const io = new IntersectionObserver((entries) => maybeStart(entries), {
      rootMargin: "200px",
    });

    io.observe(container);
    maybeStart();

    return () => {
      cancelled = true;
      io.disconnect();
      teardown?.();
    };
  }, []);

  return (
    <div ref={containerRef} className={cn("absolute inset-0", className)}>
      {!fallback && <canvas ref={canvasRef} className="h-full w-full" />}
      {fallback && (
        <div className="h-full w-full bg-gradient-to-br from-black via-zinc-950 to-zinc-900">
          <div className="absolute inset-0 opacity-25 [background-image:radial-gradient(circle_at_20%_20%,rgba(48,255,200,0.14),transparent_40%),radial-gradient(circle_at_82%_12%,rgba(255,65,165,0.16),transparent_38%)]" />
          <div className="absolute inset-0 grid-overlay opacity-30" />
          <div className="flex h-full items-center justify-center">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Static frame
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

function focusTimeline(elapsed: number, THREE: typeof import("three")) {
  if (elapsed < 1.25) {
    const t = elapsed / 1.25;
    return easeOutCubic(t);
  }
  if (elapsed < 2.0) {
    return 1.0;
  }
  if (elapsed < 4.5) {
    const t = (elapsed - 2.0) / 2.5;
    return THREE.MathUtils.lerp(1.0, 0.25, t);
  }
  const pulse = 0.03 * Math.sin(elapsed * 0.8);
  return 0.25 + pulse;
}

function easeOutCubic(t: number) {
  const inv = 1 - t;
  return 1 - inv * inv * inv;
}

function buildMask(width: number, height: number, count: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 420;
  canvas.height = 220;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return {
      sampledPositions: [{ x: 0, y: 0 }],
    };
  }

  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "white";
  ctx.font = "900 118px 'IBM Plex Mono', 'VT323', 'Fira Code', monospace";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText("VIM", 116, canvas.height / 2);

  ctx.fillRect(72, canvas.height / 2 - 64, 20, 128);

  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const samples: { x: number; y: number }[] = [];
  const step = 3;

  for (let y = 0; y < canvas.height; y += step) {
    for (let x = 0; x < canvas.width; x += step) {
      const idx = (y * canvas.width + x) * 4 + 3;
      if (data[idx] > 80) {
        const nx = (x / canvas.width - 0.5) * width;
        const ny = (0.5 - y / canvas.height) * height;
        samples.push({ x: nx, y: ny });
      }
    }
  }

  if (samples.length === 0) {
    samples.push({ x: 0, y: 0 });
  }

  const sampledPositions = new Array(count)
    .fill(0)
    .map((_, i) => samples[i % samples.length]);

  return { sampledPositions };
}
