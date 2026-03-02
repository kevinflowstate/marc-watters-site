"use client";

import { useEffect, useRef } from "react";

export default function HeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w: number, h: number;
    let animationId: number;
    const blue = [34, 114, 222];

    function resize() {
      w = canvas!.width = window.innerWidth;
      h = canvas!.height = window.innerHeight;
    }

    // --- COGS ---
    class Cog {
      x: number; y: number; r: number; teeth: number;
      speed: number; opacity: number; angle: number;
      toothDepth: number; toothWidth: number; innerR: number;
      constructor(x: number, y: number, r: number, teeth: number, speed: number, opacity: number) {
        this.x = x; this.y = y; this.r = r; this.teeth = teeth;
        this.speed = speed; this.opacity = opacity;
        this.angle = Math.random() * Math.PI * 2;
        this.toothDepth = r * 0.18;
        this.toothWidth = (Math.PI * 2) / (teeth * 2);
        this.innerR = r * 0.35;
      }
      update() { this.angle += this.speed; }
      draw() {
        ctx!.save();
        ctx!.translate(this.x, this.y);
        ctx!.rotate(this.angle);
        ctx!.strokeStyle = `rgba(${blue[0]},${blue[1]},${blue[2]},${this.opacity})`;
        ctx!.lineWidth = 1;
        ctx!.shadowColor = `rgba(${blue[0]},${blue[1]},${blue[2]},${this.opacity * 0.5})`;
        ctx!.shadowBlur = 8;
        ctx!.beginPath();
        for (let i = 0; i < this.teeth; i++) {
          const a1 = (i / this.teeth) * Math.PI * 2;
          const a2 = a1 + this.toothWidth * 0.3;
          const a4 = a1 + this.toothWidth * 1.3;
          const a5 = a1 + this.toothWidth * 2;
          const rOuter = this.r + this.toothDepth;
          const rInner = this.r;
          if (i === 0) ctx!.moveTo(Math.cos(a1) * rInner, Math.sin(a1) * rInner);
          ctx!.lineTo(Math.cos(a2) * rInner, Math.sin(a2) * rInner);
          ctx!.lineTo(Math.cos(a2) * rOuter, Math.sin(a2) * rOuter);
          ctx!.lineTo(Math.cos(a4) * rOuter, Math.sin(a4) * rOuter);
          ctx!.lineTo(Math.cos(a4) * rInner, Math.sin(a4) * rInner);
          ctx!.lineTo(Math.cos(a5) * rInner, Math.sin(a5) * rInner);
        }
        ctx!.closePath();
        ctx!.stroke();
        ctx!.beginPath();
        ctx!.arc(0, 0, this.innerR, 0, Math.PI * 2);
        ctx!.stroke();
        ctx!.beginPath();
        ctx!.arc(0, 0, this.innerR * 0.4, 0, Math.PI * 2);
        ctx!.stroke();
        for (let i = 0; i < 4; i++) {
          const sa = (i / 4) * Math.PI * 2;
          ctx!.beginPath();
          ctx!.moveTo(Math.cos(sa) * this.innerR * 0.4, Math.sin(sa) * this.innerR * 0.4);
          ctx!.lineTo(Math.cos(sa) * this.innerR, Math.sin(sa) * this.innerR);
          ctx!.stroke();
        }
        ctx!.restore();
      }
    }

    // --- PIPES ---
    class Pipe {
      segments: { x: number; y: number }[] = [];
      opacity = 0; pipeWidth = 0; progress = 0; speed = 0;
      fadeOut = false; fadeOpacity = 1;
      flowDots: { pos: number; speed: number }[] = [];
      constructor() { this.reset(); }
      reset() {
        this.segments = [];
        let x = Math.random() * w;
        let y = Math.random() * h;
        const segCount = Math.floor(Math.random() * 4) + 3;
        let dir = Math.floor(Math.random() * 4);
        this.segments.push({ x, y });
        for (let i = 0; i < segCount; i++) {
          const len = Math.random() * 120 + 40;
          const dx = [1, 0, -1, 0][dir] * len;
          const dy = [0, 1, 0, -1][dir] * len;
          x += dx; y += dy;
          this.segments.push({ x, y });
          dir = (dir + (Math.random() > 0.5 ? 1 : 3)) % 4;
        }
        this.opacity = Math.random() * 0.1 + 0.06;
        this.pipeWidth = Math.random() * 4 + 3;
        this.progress = 0;
        this.speed = Math.random() * 0.004 + 0.002;
        this.fadeOut = false;
        this.fadeOpacity = 1;
        this.flowDots = [];
        for (let i = 0; i < 3; i++) {
          this.flowDots.push({ pos: Math.random(), speed: Math.random() * 0.003 + 0.001 });
        }
      }
      update() {
        if (!this.fadeOut) {
          this.progress += this.speed;
          if (this.progress >= 1.2) this.fadeOut = true;
        } else {
          this.fadeOpacity -= 0.005;
          if (this.fadeOpacity <= 0) this.reset();
        }
        this.flowDots.forEach(d => { d.pos += d.speed; if (d.pos > 1) d.pos = 0; });
      }
      getPointAtProgress(p: number) {
        if (this.segments.length < 2) return this.segments[0];
        const totalSegs = this.segments.length - 1;
        const segF = p * totalSegs;
        const segI = Math.min(Math.floor(segF), totalSegs - 1);
        const segP = segF - segI;
        const a = this.segments[segI]; const b = this.segments[segI + 1];
        return { x: a.x + (b.x - a.x) * segP, y: a.y + (b.y - a.y) * segP };
      }
      draw() {
        const alpha = this.opacity * (this.fadeOut ? this.fadeOpacity : 1);
        const drawProgress = Math.min(this.progress, 1);
        const totalSegs = this.segments.length - 1;
        const drawSegs = Math.floor(drawProgress * totalSegs);
        const partialProgress = (drawProgress * totalSegs) - drawSegs;
        for (let pass = 0; pass < 2; pass++) {
          ctx!.lineWidth = pass === 0 ? this.pipeWidth : this.pipeWidth - 2;
          ctx!.strokeStyle = pass === 0
            ? `rgba(${blue[0]},${blue[1]},${blue[2]},${alpha})`
            : `rgba(5,5,7,${alpha * 4})`;
          ctx!.lineCap = "round"; ctx!.lineJoin = "round";
          ctx!.beginPath();
          ctx!.moveTo(this.segments[0].x, this.segments[0].y);
          for (let i = 1; i <= drawSegs && i < this.segments.length; i++) {
            ctx!.lineTo(this.segments[i].x, this.segments[i].y);
          }
          if (drawSegs < totalSegs) {
            const a = this.segments[drawSegs]; const b = this.segments[drawSegs + 1];
            ctx!.lineTo(a.x + (b.x - a.x) * partialProgress, a.y + (b.y - a.y) * partialProgress);
          }
          ctx!.stroke();
        }
        ctx!.fillStyle = `rgba(${blue[0]},${blue[1]},${blue[2]},${alpha * 1.5})`;
        for (let i = 1; i < Math.min(drawSegs + 1, this.segments.length - 1); i++) {
          ctx!.beginPath();
          ctx!.arc(this.segments[i].x, this.segments[i].y, this.pipeWidth * 0.7, 0, Math.PI * 2);
          ctx!.fill();
        }
        if (!this.fadeOut && this.progress > 0.3) {
          this.flowDots.forEach(d => {
            if (d.pos <= drawProgress) {
              const pt = this.getPointAtProgress(d.pos);
              ctx!.beginPath();
              ctx!.arc(pt.x, pt.y, 1.5, 0, Math.PI * 2);
              ctx!.fillStyle = `rgba(${blue[0]},${blue[1]},${blue[2]},${alpha * 4})`;
              ctx!.fill();
            }
          });
        }
        ctx!.fillStyle = `rgba(${blue[0]},${blue[1]},${blue[2]},${alpha * 1.5})`;
        ctx!.beginPath();
        ctx!.arc(this.segments[0].x, this.segments[0].y, this.pipeWidth * 0.7, 0, Math.PI * 2);
        ctx!.fill();
      }
    }

    // --- I-BEAMS ---
    class IBeam {
      x: number; y: number; size: number; angle: number; opacity: number;
      rotSpeed: number; drift: { x: number; y: number };
      constructor(x: number, y: number, size: number, angle: number, opacity: number) {
        this.x = x; this.y = y; this.size = size; this.angle = angle; this.opacity = opacity;
        this.rotSpeed = (Math.random() - 0.5) * 0.002;
        this.drift = { x: (Math.random() - 0.5) * 0.15, y: (Math.random() - 0.5) * 0.1 };
      }
      update() {
        this.angle += this.rotSpeed;
        this.x += this.drift.x; this.y += this.drift.y;
        if (this.x < -100 || this.x > w + 100 || this.y < -100 || this.y > h + 100) {
          this.x = Math.random() * w; this.y = Math.random() * h;
        }
      }
      draw() {
        ctx!.save();
        ctx!.translate(this.x, this.y);
        ctx!.rotate(this.angle);
        ctx!.strokeStyle = `rgba(${blue[0]},${blue[1]},${blue[2]},${this.opacity})`;
        ctx!.lineWidth = 1;
        ctx!.shadowColor = `rgba(${blue[0]},${blue[1]},${blue[2]},${this.opacity * 0.4})`;
        ctx!.shadowBlur = 6;
        const s = this.size;
        const fw = s; const fh = s * 0.15; const ww = s * 0.12; const bh = s * 1.2;
        ctx!.beginPath();
        ctx!.moveTo(-fw/2, -bh/2); ctx!.lineTo(fw/2, -bh/2);
        ctx!.lineTo(fw/2, -bh/2 + fh); ctx!.lineTo(ww/2, -bh/2 + fh);
        ctx!.lineTo(ww/2, bh/2 - fh); ctx!.lineTo(fw/2, bh/2 - fh);
        ctx!.lineTo(fw/2, bh/2); ctx!.lineTo(-fw/2, bh/2);
        ctx!.lineTo(-fw/2, bh/2 - fh); ctx!.lineTo(-ww/2, bh/2 - fh);
        ctx!.lineTo(-ww/2, -bh/2 + fh); ctx!.lineTo(-fw/2, -bh/2 + fh);
        ctx!.closePath(); ctx!.stroke();
        ctx!.restore();
      }
    }

    // --- BOLTS ---
    class Bolt {
      x: number; y: number; size: number; opacity: number;
      pulsePhase: number; currentOpacity = 0;
      constructor(x: number, y: number, size: number, opacity: number) {
        this.x = x; this.y = y; this.size = size; this.opacity = opacity;
        this.pulsePhase = Math.random() * Math.PI * 2;
      }
      update(t: number) {
        this.currentOpacity = this.opacity * (0.6 + 0.4 * Math.sin(t * 0.008 + this.pulsePhase));
      }
      draw() {
        ctx!.strokeStyle = `rgba(${blue[0]},${blue[1]},${blue[2]},${this.currentOpacity})`;
        ctx!.lineWidth = 0.8;
        ctx!.shadowColor = `rgba(${blue[0]},${blue[1]},${blue[2]},${this.currentOpacity * 0.5})`;
        ctx!.shadowBlur = 5;
        ctx!.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
          const px = this.x + Math.cos(a) * this.size;
          const py = this.y + Math.sin(a) * this.size;
          if (i === 0) ctx!.moveTo(px, py); else ctx!.lineTo(px, py);
        }
        ctx!.closePath(); ctx!.stroke();
        ctx!.beginPath();
        ctx!.arc(this.x, this.y, this.size * 0.35, 0, Math.PI * 2);
        ctx!.stroke();
      }
    }

    // --- DIMENSION LINES ---
    class DimensionLine {
      horizontal = true; x1 = 0; y1 = 0; x2 = 0; y2 = 0;
      tickLen = 6; opacity = 0; progress = 0; speed = 0;
      fadeOut = false; fadeOpacity = 1;
      constructor() { this.reset(); }
      reset() {
        this.horizontal = Math.random() > 0.5;
        this.x1 = Math.random() * w; this.y1 = Math.random() * h;
        if (this.horizontal) { this.x2 = this.x1 + Math.random() * 180 + 60; this.y2 = this.y1; }
        else { this.x2 = this.x1; this.y2 = this.y1 + Math.random() * 180 + 60; }
        this.opacity = Math.random() * 0.08 + 0.05;
        this.progress = 0; this.speed = Math.random() * 0.005 + 0.002;
        this.fadeOut = false; this.fadeOpacity = 1;
      }
      update() {
        if (!this.fadeOut) { this.progress += this.speed; if (this.progress >= 1.3) this.fadeOut = true; }
        else { this.fadeOpacity -= 0.006; if (this.fadeOpacity <= 0) this.reset(); }
      }
      draw() {
        const alpha = this.opacity * (this.fadeOut ? this.fadeOpacity : 1);
        const p = Math.min(this.progress, 1);
        const cx = this.x1 + (this.x2 - this.x1) * p;
        const cy = this.y1 + (this.y2 - this.y1) * p;
        ctx!.strokeStyle = `rgba(${blue[0]},${blue[1]},${blue[2]},${alpha})`;
        ctx!.lineWidth = 0.5;
        ctx!.beginPath(); ctx!.moveTo(this.x1, this.y1); ctx!.lineTo(cx, cy); ctx!.stroke();
        if (this.horizontal) {
          ctx!.beginPath(); ctx!.moveTo(this.x1, this.y1 - this.tickLen); ctx!.lineTo(this.x1, this.y1 + this.tickLen); ctx!.stroke();
          if (p > 0.95) { ctx!.beginPath(); ctx!.moveTo(this.x2, this.y2 - this.tickLen); ctx!.lineTo(this.x2, this.y2 + this.tickLen); ctx!.stroke(); }
        } else {
          ctx!.beginPath(); ctx!.moveTo(this.x1 - this.tickLen, this.y1); ctx!.lineTo(this.x1 + this.tickLen, this.y1); ctx!.stroke();
          if (p > 0.95) { ctx!.beginPath(); ctx!.moveTo(this.x2 - this.tickLen, this.y2); ctx!.lineTo(this.x2 + this.tickLen, this.y2); ctx!.stroke(); }
        }
        if (p > 0.1) {
          const aSize = 4;
          ctx!.fillStyle = `rgba(${blue[0]},${blue[1]},${blue[2]},${alpha})`;
          if (this.horizontal) {
            ctx!.beginPath(); ctx!.moveTo(this.x1, this.y1);
            ctx!.lineTo(this.x1 + aSize, this.y1 - aSize/2);
            ctx!.lineTo(this.x1 + aSize, this.y1 + aSize/2); ctx!.fill();
          } else {
            ctx!.beginPath(); ctx!.moveTo(this.x1, this.y1);
            ctx!.lineTo(this.x1 - aSize/2, this.y1 + aSize);
            ctx!.lineTo(this.x1 + aSize/2, this.y1 + aSize); ctx!.fill();
          }
        }
      }
    }

    // --- GRID ---
    function drawGrid() {
      ctx!.shadowBlur = 0;
      const gridSize = 80;
      ctx!.strokeStyle = `rgba(${blue[0]},${blue[1]},${blue[2]},0.025)`;
      ctx!.lineWidth = 0.5;
      for (let x = 0; x < w; x += gridSize) { ctx!.beginPath(); ctx!.moveTo(x, 0); ctx!.lineTo(x, h); ctx!.stroke(); }
      for (let y = 0; y < h; y += gridSize) { ctx!.beginPath(); ctx!.moveTo(0, y); ctx!.lineTo(w, y); ctx!.stroke(); }
      ctx!.strokeStyle = `rgba(${blue[0]},${blue[1]},${blue[2]},0.012)`;
      const minor = gridSize / 4;
      for (let x = 0; x < w; x += minor) { ctx!.beginPath(); ctx!.moveTo(x, 0); ctx!.lineTo(x, h); ctx!.stroke(); }
      for (let y = 0; y < h; y += minor) { ctx!.beginPath(); ctx!.moveTo(0, y); ctx!.lineTo(w, y); ctx!.stroke(); }
    }

    const cogs: Cog[] = [];
    const pipes: Pipe[] = [];
    const ibeams: IBeam[] = [];
    const bolts: Bolt[] = [];
    const dims: DimensionLine[] = [];

    function initElements() {
      cogs.length = 0; pipes.length = 0; ibeams.length = 0; bolts.length = 0; dims.length = 0;
      const cogPositions = [
        { x: w * 0.08, y: h * 0.15, r: 55, teeth: 16, speed: 0.003, opacity: 0.14 },
        { x: w * 0.08 + 78, y: h * 0.15 + 48, r: 35, teeth: 10, speed: -0.00525, opacity: 0.12 },
        { x: w * 0.85, y: h * 0.7, r: 70, teeth: 20, speed: -0.002, opacity: 0.11 },
        { x: w * 0.85 + 98, y: h * 0.7 - 10, r: 42, teeth: 12, speed: 0.00367, opacity: 0.1 },
        { x: w * 0.5, y: h * 0.85, r: 45, teeth: 14, speed: 0.0025, opacity: 0.09 },
        { x: w * 0.35, y: h * 0.4, r: 30, teeth: 8, speed: -0.004, opacity: 0.08 },
        { x: w * 0.92, y: h * 0.2, r: 25, teeth: 8, speed: 0.005, opacity: 0.08 },
      ];
      cogPositions.forEach(c => cogs.push(new Cog(c.x, c.y, c.r, c.teeth, c.speed, c.opacity)));
      for (let i = 0; i < 5; i++) pipes.push(new Pipe());
      const beamConfigs = [
        { x: w * 0.2, y: h * 0.6, size: 28, angle: 0.2, opacity: 0.1 },
        { x: w * 0.7, y: h * 0.3, size: 22, angle: -0.5, opacity: 0.09 },
        { x: w * 0.45, y: h * 0.15, size: 18, angle: 0.8, opacity: 0.07 },
        { x: w * 0.15, y: h * 0.85, size: 24, angle: -0.3, opacity: 0.08 },
        { x: w * 0.75, y: h * 0.85, size: 20, angle: 1.2, opacity: 0.07 },
      ];
      beamConfigs.forEach(b => ibeams.push(new IBeam(b.x, b.y, b.size, b.angle, b.opacity)));
      for (let i = 0; i < 15; i++) {
        bolts.push(new Bolt(Math.random() * w, Math.random() * h, Math.random() * 6 + 4, Math.random() * 0.08 + 0.05));
      }
      for (let i = 0; i < 6; i++) dims.push(new DimensionLine());
    }

    resize();
    initElements();

    const handleResize = () => { resize(); initElements(); };
    window.addEventListener("resize", handleResize);

    let t = 0;
    function animate() {
      ctx!.clearRect(0, 0, w, h);
      t++;
      drawGrid();
      dims.forEach(d => { d.update(); d.draw(); });
      pipes.forEach(p => { p.update(); p.draw(); });
      ibeams.forEach(b => { b.update(); b.draw(); });
      cogs.forEach(c => { c.update(); c.draw(); });
      bolts.forEach(b => { b.update(t); b.draw(); });
      animationId = requestAnimationFrame(animate);
    }
    animate();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute top-0 left-0 w-full h-full z-0"
    />
  );
}
