import { a as require_react, o as __toESM, t as require_jsx_runtime } from "../index.js";
//#region app/login/particle-sphere.tsx
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var import_jsx_runtime = require_jsx_runtime();
var POINT_COUNT = 2600;
var GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
function createSphere() {
	return Array.from({ length: POINT_COUNT }, (_, index) => {
		const y = 1 - index / (POINT_COUNT - 1) * 2;
		const radius = Math.sqrt(1 - y * y);
		const angle = GOLDEN_ANGLE * index;
		return {
			x: Math.cos(angle) * radius,
			y,
			z: Math.sin(angle) * radius
		};
	});
}
function ParticleSphere() {
	const canvasRef = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const context = canvas.getContext("2d");
		if (!context) return;
		const points = createSphere();
		const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		let width = 0;
		let height = 0;
		let frame = 0;
		let animationId = 0;
		const resize = () => {
			const rect = canvas.getBoundingClientRect();
			const density = Math.min(window.devicePixelRatio || 1, 2);
			width = rect.width;
			height = rect.height;
			canvas.width = Math.max(1, Math.round(width * density));
			canvas.height = Math.max(1, Math.round(height * density));
			context.setTransform(density, 0, 0, density, 0, 0);
		};
		const draw = () => {
			context.clearRect(0, 0, width, height);
			const sphereRadius = Math.min(width * .36, height * .36, 330);
			const centerX = width * .5;
			const centerY = height * .48;
			const rotationY = frame * .0032;
			const rotationX = -.18 + Math.sin(frame * .0011) * .07;
			const cosY = Math.cos(rotationY);
			const sinY = Math.sin(rotationY);
			const cosX = Math.cos(rotationX);
			const sinX = Math.sin(rotationX);
			for (const point of points) {
				const rotatedX = point.x * cosY - point.z * sinY;
				const rotatedZ = point.x * sinY + point.z * cosY;
				const rotatedY = point.y * cosX - rotatedZ * sinX;
				const depth = point.y * sinX + rotatedZ * cosX;
				const perspective = 1 / (1.22 - depth * .2);
				const x = centerX + rotatedX * sphereRadius * perspective;
				const y = centerY + rotatedY * sphereRadius * perspective;
				const alpha = .26 + (depth + 1) / 2 * .72;
				const size = .55 + (depth + 1) / 2 * 1.1;
				context.beginPath();
				context.arc(x, y, size, 0, Math.PI * 2);
				context.fillStyle = `rgba(255, 255, 255, ${alpha})`;
				context.fill();
			}
			if (!reducedMotion) {
				frame += 1;
				animationId = requestAnimationFrame(draw);
			}
		};
		const observer = new ResizeObserver(() => {
			resize();
			if (reducedMotion) draw();
		});
		resize();
		draw();
		observer.observe(canvas);
		return () => {
			observer.disconnect();
			cancelAnimationFrame(animationId);
		};
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("canvas", {
		ref: canvasRef,
		className: "particle-sphere-canvas"
	});
}
//#endregion
export { ParticleSphere as default };
