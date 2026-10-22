"use client";

import { useEffect, useRef } from "react";
import styles from "./styles.module.css";

const DOT_COUNT = 1500;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const COLORS = ["#00c7dc", "#04d3bd", "#76cf4b", "#e9f8ff"];

export default function ParticleSphere() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    let frame = 0;
    let width = 0;
    let height = 0;
    let rotation = 0;
    let animationFrame = 0;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      width = bounds.width;
      height = bounds.height;
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };

    const points = Array.from({ length: DOT_COUNT }, (_, index) => {
      const y = 1 - (index / (DOT_COUNT - 1)) * 2;
      const ringRadius = Math.sqrt(1 - y * y);
      const angle = GOLDEN_ANGLE * index;
      return {
        x: Math.cos(angle) * ringRadius,
        y,
        z: Math.sin(angle) * ringRadius,
        color: COLORS[(index * 17 + Math.floor(index / 9)) % COLORS.length],
        size: 0.75 + ((index * 13) % 5) * 0.14,
      };
    });

    const draw = () => {
      if (!width || !height) return;
      context.clearRect(0, 0, width, height);
      const radius = Math.min(width, height) * 0.29;
      const centerX = width / 2;
      const centerY = height / 2;
      const cosine = Math.cos(rotation);
      const sine = Math.sin(rotation);
      const perspective = radius * 3.7;

      const projected = points.map((point) => {
        const x = point.x * cosine - point.z * sine;
        const z = point.x * sine + point.z * cosine;
        const scale = perspective / (perspective - z * radius);
        return {
          x: centerX + x * radius * scale,
          y: centerY + point.y * radius * scale,
          z,
          scale,
          color: point.color,
          size: point.size,
        };
      }).sort((left, right) => left.z - right.z);

      for (const point of projected) {
        const depth = (point.z + 1) / 2;
        context.globalAlpha = 0.28 + depth * 0.72;
        context.fillStyle = point.color;
        context.beginPath();
        context.arc(point.x, point.y, point.size * point.scale, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;

      frame += 1;
      if (!reduceMotion.matches) rotation += 0.004;
      animationFrame = window.requestAnimationFrame(draw);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    draw();

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  return <canvas ref={canvasRef} className={styles.sphereCanvas} role="img" aria-label="Esfera de pontos em tons de azul, verde e branco girando" />;
}
