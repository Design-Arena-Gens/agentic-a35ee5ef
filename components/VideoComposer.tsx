"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NewsItem } from '@/lib/types';

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(/\s+/);
  let line = '';
  let yy = y;
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      ctx.fillText(line, x, yy);
      line = words[n] + ' ';
      yy += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, yy);
}

function sentences(text: string, max = 4) {
  const parts = text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.slice(0, max);
}

export default function VideoComposer({ item }: { item: NewsItem }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [recording, setRecording] = useState(false);
  const [progress, setProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const width = 1280;
  const height = 720;
  const fps = 30;

  const slides = useMemo(() => {
    const pts = sentences(item.summary || item.title, 4);
    const domain = new URL(item.link).hostname.replace(/^www\./, '');
    const arr = [
      { type: 'title' as const, text: item.title },
      ...(item.image ? [{ type: 'image' as const, url: item.image }] : []),
      ...pts.map((p) => ({ type: 'bullet' as const, text: p })),
      { type: 'outro' as const, text: `${item.source} ? ${domain}` }
    ];
    return arr;
  }, [item]);

  const totalDurationSec = useMemo(() => {
    // Title: 3s, image: 3s, bullet: 3s each, outro: 2.5s
    let sec = 0;
    slides.forEach((s) => {
      if (s.type === 'title') sec += 3;
      else if (s.type === 'image') sec += 3;
      else if (s.type === 'bullet') sec += 3;
      else if (s.type === 'outro') sec += 2.5;
    });
    return sec;
  }, [slides]);

  const drawSlide = useCallback(async (ctx: CanvasRenderingContext2D, slide: any, t: number) => {
    // Background
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#0b1220');
    grad.addColorStop(1, '#0e1729');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Overlay grid glow
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.18)';
    for (let i = 0; i < width; i += 80) {
      ctx.beginPath();
      ctx.moveTo(i + (t % 80), 0);
      ctx.lineTo(i + (t % 80), height);
      ctx.stroke();
    }

    // Title or text
    ctx.fillStyle = '#eef2ff';
    ctx.textBaseline = 'top';

    if (slide.type === 'title') {
      ctx.font = 'bold 52px ui-sans-serif, system-ui, Segoe UI, Roboto, Arial';
      wrapText(ctx, slide.text, 60, 80, width - 120, 60);
      ctx.font = '600 24px ui-sans-serif, system-ui, Segoe UI, Roboto, Arial';
      ctx.fillStyle = '#93c5fd';
      ctx.fillText(`${item.source} ? ${new Date(item.date).toLocaleDateString()}`, 60, 60);
    } else if (slide.type === 'bullet') {
      ctx.font = 'bold 40px ui-sans-serif, system-ui, Segoe UI, Roboto, Arial';
      wrapText(ctx, slide.text, 80, 160, width - 160, 56);
    } else if (slide.type === 'outro') {
      ctx.font = 'bold 46px ui-sans-serif, system-ui, Segoe UI, Roboto, Arial';
      ctx.fillText('Learn more', 60, 160);
      ctx.font = '600 36px ui-sans-serif, system-ui, Segoe UI, Roboto, Arial';
      wrapText(ctx, slide.text, 60, 220, width - 120, 48);
      ctx.font = '600 24px ui-sans-serif, system-ui, Segoe UI, Roboto, Arial';
      ctx.fillStyle = '#93c5fd';
      wrapText(ctx, item.link, 60, 300, width - 120, 36);
    }

    if (slide.type === 'image' && slide.url) {
      await new Promise<void>((resolve) => {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = () => {
          const iw = image.width;
          const ih = image.height;
          const targetW = width - 200;
          const scale = targetW / iw;
          const targetH = ih * scale;
          const x = 100;
          const y = (height - targetH) / 2;
          ctx.drawImage(image, x, y, targetW, targetH);
          resolve();
        };
        image.onerror = () => resolve();
        image.src = slide.url;
      });
    }

    // Corner badge
    ctx.fillStyle = '#1f2a44';
    ctx.fillRect(width - 200, 40, 140, 40);
    ctx.fillStyle = '#93c5fd';
    ctx.font = '700 18px ui-sans-serif, system-ui, Segoe UI, Roboto, Arial';
    ctx.fillText('AI Tools', width - 190, 50);
  }, [height, item.date, item.link, item.source, slides, width]);

  const startRecording = useCallback(async () => {
    setError(null);
    setVideoUrl(null);
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | null;
    if (!ctx) return;

    const stream = canvas.captureStream(fps);

    // Audio via WebAudio synthetic ambient
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const dest = audioCtx.createMediaStreamDestination();

    const base = audioCtx.createOscillator();
    base.type = 'sine';
    base.frequency.value = 220; // A3 bass

    const harmony = audioCtx.createOscillator();
    harmony.type = 'sine';
    harmony.frequency.value = 329.63; // E4

    const lfo = audioCtx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.2; // slow wobble

    const baseGain = audioCtx.createGain();
    baseGain.gain.value = 0.02;
    const harmonyGain = audioCtx.createGain();
    harmonyGain.gain.value = 0.01;

    const lfoGain = audioCtx.createGain();
    lfoGain.gain.value = 0.006;

    lfo.connect(lfoGain);
    lfoGain.connect(baseGain.gain);

    base.connect(baseGain).connect(dest);
    harmony.connect(harmonyGain).connect(dest);

    base.start();
    harmony.start();
    lfo.start();

    const mixed = new MediaStream([stream.getVideoTracks()[0], ...dest.stream.getAudioTracks()]);

    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus' : 'video/webm;codecs=vp8,opus';
    const recorder = new MediaRecorder(mixed, { mimeType: mime, videoBitsPerSecond: 4_000_000, audioBitsPerSecond: 128_000 });

    const chunks: BlobPart[] = [];

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    recorder.onerror = (e) => {
      setError((e as any)?.error?.message || 'Recorder error');
    };

    let start = performance.now();
    let elapsedSec = 0;
    let currentSlideIndex = 0;
    let currentSlideElapsed = 0;

    function slideDuration(s: any) {
      if (s.type === 'title') return 3;
      if (s.type === 'image') return 3;
      if (s.type === 'bullet') return 3;
      return 2.5; // outro
    }

    function step(now: number) {
      const dt = (now - start) / 1000;
      start = now;
      elapsedSec += dt;
      currentSlideElapsed += dt;

      const slide = slides[currentSlideIndex];
      if (!slide) return;

      drawSlide(ctx as CanvasRenderingContext2D, slide, elapsedSec * 60).then(() => void 0);

      if (currentSlideElapsed >= slideDuration(slide)) {
        currentSlideIndex += 1;
        currentSlideElapsed = 0;
      }

      setProgress(Math.min(100, Math.floor((elapsedSec / totalDurationSec) * 100)));

      if (elapsedSec < totalDurationSec) {
        requestAnimationFrame(step);
      } else {
        recorder.stop();
      }
    }

    recorder.onstop = () => {
      base.stop();
      harmony.stop();
      lfo.stop();
      audioCtx.close();
      const blob = new Blob(chunks, { type: mime });
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);
      setRecording(false);
      setProgress(100);
    };

    setRecording(true);
    recorder.start(500);
    requestAnimationFrame((t) => {
      start = t;
      requestAnimationFrame(step);
    });
  }, [fps, slides, totalDurationSec, drawSlide]);

  return (
    <div>
      <canvas ref={canvasRef} width={width} height={height} style={{ width: '100%', height: 'auto', borderRadius: 12 }} />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
        <button className="button" onClick={startRecording} disabled={recording}>
          {recording ? 'Recording?' : 'Generate Video'}
        </button>
        <div className="small">Progress: {progress}%</div>
        {videoUrl && (
          <a className="button secondary" href={videoUrl} download={`ai-tool-video.webm`}>Download Video</a>
        )}
      </div>
      {error && <div className="small" style={{ color: '#fca5a5', marginTop: 8 }}>{error}</div>}
    </div>
  );
}
