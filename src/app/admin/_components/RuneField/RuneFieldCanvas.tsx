'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { RuneFieldProps } from './RuneField';

/**
 * Arcane rune field — instanced quads drifting across a dark canvas with
 * procedural SDF glyphs drawn in the fragment shader. 6 glyph variants chosen
 * deterministically per instance. Runs at ~30fps via a dt accumulator to
 * spare mobile GPUs.
 *
 * All uniforms live on a single ShaderMaterial; no per-frame allocations.
 */

const COUNTS: Record<NonNullable<RuneFieldProps['density']>, number> = {
  low: 48,
  medium: 160,
  high: 280,
};

const VERT = /* glsl */`
  attribute float aInstanceId;
  attribute float aScale;
  attribute vec2  aOffset;
  attribute float aPhase;

  uniform float uTime;
  uniform vec2  uMouse;      // -1..1
  uniform float uParallax;
  uniform float uAspect;

  varying float vInstanceId;
  varying vec2  vUv;
  varying float vPhase;
  varying float vTwinkle;

  void main() {
    vInstanceId = aInstanceId;
    vUv = uv;
    vPhase = aPhase;

    // Slow drift across screen (wraps at edges)
    vec2 drifted = aOffset;
    drifted.y += uTime * 0.015 * (0.6 + fract(aInstanceId * 0.191));
    drifted.x += uTime * 0.005 * (fract(aInstanceId * 0.373) - 0.5);
    drifted.x = mod(drifted.x + 1.3, 2.6) - 1.3;
    drifted.y = mod(drifted.y + 1.3, 2.6) - 1.3;

    // Parallax toward mouse
    drifted += uMouse * uParallax * (0.3 + fract(aInstanceId * 0.509));

    // Twinkle factor for fragment
    vTwinkle = 0.5 + 0.5 * sin(uTime * 0.6 + aPhase);

    vec3 pos = vec3(position.xy * aScale, 0.0);
    pos.x = pos.x / uAspect;
    pos.xy += drifted;
    gl_Position = vec4(pos, 1.0);
  }
`;

const FRAG = /* glsl */`
  precision mediump float;

  uniform vec3  uAccent;
  uniform float uTime;

  varying float vInstanceId;
  varying vec2  vUv;
  varying float vPhase;
  varying float vTwinkle;

  // Rotated SDF helpers
  float sdCircle(vec2 p, float r) { return length(p) - r; }
  float sdBox(vec2 p, vec2 b) {
    vec2 d = abs(p) - b;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
  }
  float sdTriangle(vec2 p, float s) {
    // Upward triangle, rough SDF via rotated stripes
    p.y -= s * 0.2;
    float k = sqrt(3.0);
    p.x = abs(p.x) - s;
    p.y = p.y + s / k;
    if (p.x + k * p.y > 0.0) p = vec2(p.x - k * p.y, -k * p.x - p.y) / 2.0;
    p.x -= clamp(p.x, -2.0 * s, 0.0);
    return -length(p) * sign(p.y);
  }

  // Procedural glyph — choose one of 6 shapes by instance ID
  float glyph(vec2 p, int kind) {
    if (kind == 0) {
      // Circle with inner dot
      float a = sdCircle(p, 0.30);
      float b = sdCircle(p, 0.10);
      return min(abs(a) - 0.02, b);
    } else if (kind == 1) {
      // Rotated square (diamond)
      vec2 r = vec2(p.x * 0.707 + p.y * 0.707, -p.x * 0.707 + p.y * 0.707);
      return abs(sdBox(r, vec2(0.26))) - 0.02;
    } else if (kind == 2) {
      // Cross / plus
      float a = sdBox(p, vec2(0.06, 0.32));
      float b = sdBox(p, vec2(0.32, 0.06));
      return min(a, b);
    } else if (kind == 3) {
      // Triangle
      return abs(sdTriangle(p, 0.32)) - 0.02;
    } else if (kind == 4) {
      // Hexagon outline
      vec2 q = abs(p);
      float d = max(q.y + q.x * 0.577, q.x) - 0.3;
      return abs(d) - 0.02;
    }
    // Sparkle (4 little dots)
    float d = 1.0;
    for (int i = 0; i < 4; i++) {
      float a = float(i) * 1.5708;
      vec2 c = vec2(cos(a), sin(a)) * 0.22;
      d = min(d, sdCircle(p - c, 0.05));
    }
    return d;
  }

  void main() {
    vec2 p = vUv - 0.5;

    // Deterministic glyph choice
    int kind = int(mod(vInstanceId, 6.0));
    float d = glyph(p, kind);

    // Soft edge + radial falloff (runes fade at tile edges)
    float line = smoothstep(0.025, 0.0, abs(d));
    float edge = smoothstep(0.5, 0.3, length(p));

    float alpha = line * edge * (0.18 + 0.32 * vTwinkle);
    if (alpha < 0.01) discard;

    vec3 col = uAccent * (0.6 + 0.4 * vTwinkle);
    gl_FragColor = vec4(col, alpha);
  }
`;

function parseAccent(value: string | undefined): THREE.Color {
  if (!value) return new THREE.Color('#5fb3ff');
  try {
    return new THREE.Color(value);
  } catch {
    return new THREE.Color('#5fb3ff');
  }
}

function Scene({ count, drift, parallax, tone }: { count: number; drift: number; parallax: number; tone: string }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const { size, invalidate } = useThree();
  const accumRef = useRef(0);

  // Build per-instance attributes once
  const { geometry, material } = useMemo(() => {
    const geo = new THREE.PlaneGeometry(0.18, 0.18);
    const ids = new Float32Array(count);
    const scales = new Float32Array(count);
    const offsets = new Float32Array(count * 2);
    const phases = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      ids[i] = i;
      scales[i] = 0.6 + Math.random() * 1.3;
      offsets[i * 2] = (Math.random() - 0.5) * 2.6;
      offsets[i * 2 + 1] = (Math.random() - 0.5) * 2.6;
      phases[i] = Math.random() * Math.PI * 2;
    }
    geo.setAttribute('aInstanceId', new THREE.InstancedBufferAttribute(ids, 1));
    geo.setAttribute('aScale', new THREE.InstancedBufferAttribute(scales, 1));
    geo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offsets, 2));
    geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));

    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime:     { value: 0 },
        uMouse:    { value: new THREE.Vector2(0, 0) },
        uParallax: { value: parallax },
        uAspect:   { value: 1 },
        uAccent:   { value: parseAccent(tone) },
      },
    });

    return { geometry: geo, material: mat };
  }, [count, parallax, tone]);

  // Update aspect on resize
  useEffect(() => {
    if (material.uniforms.uAspect) {
      material.uniforms.uAspect.value = Math.max(0.1, size.width / Math.max(1, size.height));
    }
    invalidate();
  }, [size.width, size.height, material, invalidate]);

  // Mouse parallax — global so it works across the whole shell
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      material.uniforms.uMouse.value.set(
        (e.clientX / window.innerWidth) * 2 - 1,
        1 - (e.clientY / window.innerHeight) * 2,
      );
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, [material]);

  // Animated frame — demand-driven, but we need continuous invalidation since
  // the field is always drifting. Cap at ~30fps by accumulating dt.
  useFrame((_state, dt) => {
    accumRef.current += dt;
    if (accumRef.current < 1 / 30) return;
    material.uniforms.uTime.value += accumRef.current * (drift * 60);
    accumRef.current = 0;
    invalidate();
  });

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  return (
    <instancedMesh ref={meshRef} args={[geometry, material, count]} frustumCulled={false}>
      <primitive attach="material" object={material} ref={materialRef} />
    </instancedMesh>
  );
}

export default function RuneFieldCanvas({
  density = 'medium',
  drift = 1.0,
  parallax = 0.08,
  tone,
}: RuneFieldProps) {
  const count = COUNTS[density] ?? COUNTS.medium;
  const color = tone ?? resolveAccentFromCss() ?? '#5fb3ff';

  return (
    <Canvas
      className="av-runefield-canvas"
      frameloop="demand"
      dpr={[1, 1.5]}
      orthographic
      camera={{ position: [0, 0, 1], zoom: 1 }}
      gl={{ antialias: false, powerPreference: 'low-power', alpha: true }}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    >
      <Scene count={count} drift={drift} parallax={parallax} tone={color} />
    </Canvas>
  );
}

function resolveAccentFromCss(): string | null {
  if (typeof window === 'undefined') return null;
  const shell = document.querySelector('.admin-v2-shell') as HTMLElement | null;
  if (!shell) return null;
  const v = getComputedStyle(shell).getPropertyValue('--accent-primary').trim();
  return v || null;
}
