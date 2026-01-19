"use client";

import React, { useState, useRef, useEffect } from 'react';
import { ProcessorSettings, ShapeType, SHAPES, processFrame } from '@/lib/processor';
import { Upload, Download, Settings2, Image as ImageIcon, Video, ArrowLeftRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Switch } from "@/components/ui/switch";
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';

const logoUrl = '/assets/Reticulations logo.png';
const DEMO_IMAGE = '/assets/giraffe.jpg';

export default function Page() {
  // State
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isVideo, setIsVideo] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [videoFps, setVideoFps] = useState(8);
  const [exportMode, setExportMode] = useState<'video' | 'png'>('video');
  const [uploadStatus, setUploadStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [mediaState, setMediaState] = useState<'idle' | 'loading' | 'ready' | 'error'>('loading');
  const [settings, setSettings] = useState<ProcessorSettings>({
    gridSize: 20,
    contrast: 1.8,
    fgColor: '#ffffff',
    bgColor: '#1a1a1a',
    shape: 'circle',
    invert: true,
    uniformSize: false,
    overlap: 0.3,
    edgeDetection: false,
    sensitivity: 1
  });
  const isBgTransparent = settings.bgColor.trim().toLowerCase() === 'transparent';

  // Refs
  const sourceCanvasRef = useRef<HTMLCanvasElement>(null);
  const targetCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const ffmpegRef = useRef<any>(null);
  const animationFrameRef = useRef<number | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const loadSeqRef = useRef(0);
  const statusTimerRef = useRef<number | null>(null);

  // Load demo image on start
  useEffect(() => {
    setMediaState('loading');
    loadImage(DEMO_IMAGE);
    initFFmpeg();
  }, []);

  useEffect(() => {
    return () => {
      if (statusTimerRef.current) {
        window.clearTimeout(statusTimerRef.current);
        statusTimerRef.current = null;
      }
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  const initFFmpeg = async () => {
    if (!ffmpegRef.current) {
      try {
        const { FFmpeg } = await import('@ffmpeg/ffmpeg');
        const { toBlobURL } = await import('@ffmpeg/util');

        const ffmpeg = new FFmpeg();
        ffmpegRef.current = { ffmpeg, toBlobURL };

        const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm';
        await ffmpeg.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
          workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript'),
        });
      } catch (error) {
        console.warn('FFmpeg initialization skipped (will only affect video export):', error);
      }
    }
  };

  const ensureFFmpegLoaded = async (): Promise<boolean> => {
    await initFFmpeg();
    const ref = ffmpegRef.current;
    if (!ref || !ref.ffmpeg) return false;
    if (ref.ffmpeg.loaded) return true;
    try {
      const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm';
      await ref.ffmpeg.load({
        coreURL: await ref.toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await ref.toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        workerURL: await ref.toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript'),
      });
      return true;
    } catch (error) {
      console.warn('FFmpeg failed to load:', error);
      return false;
    }
  };

  // Update canvas when video plays or settings change
  useEffect(() => {
    if (!isVideo || !videoRef.current || !sourceCanvasRef.current || !targetCanvasRef.current) return;

    const video = videoRef.current;
    const sourceCanvas = sourceCanvasRef.current;
    let frameCount = 0;
    const frameSkip = Math.max(1, Math.round(30 / videoFps)); // Skip frames based on desired FPS

    const updateFrame = () => {
      // Only process every Nth frame based on FPS setting
      if (frameCount % frameSkip === 0 && video.readyState >= 2) {
        const ctx = sourceCanvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0);
          processFrame(sourceCanvas, targetCanvasRef.current!, settings);
        }
      }
      frameCount++;
      animationFrameRef.current = requestAnimationFrame(updateFrame);
    };

    video.play().catch(() => {});
    animationFrameRef.current = requestAnimationFrame(updateFrame);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isVideo, settings, videoFps]);

  useEffect(() => {
    if (isVideo || !imageSrc || !sourceCanvasRef.current || !targetCanvasRef.current) return;
    processFrame(sourceCanvasRef.current, targetCanvasRef.current, settings);
  }, [imageSrc, isVideo, settings]);

  const setStatus = (type: 'success' | 'error', message: string) => {
    if (statusTimerRef.current) {
      window.clearTimeout(statusTimerRef.current);
      statusTimerRef.current = null;
    }
    setUploadStatus({ type, message });
    statusTimerRef.current = window.setTimeout(() => {
      setUploadStatus(null);
      statusTimerRef.current = null;
    }, 4000);
  };

  const loadImage = (src: string, loadSeq?: number) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      if (loadSeq !== undefined && loadSeq !== loadSeqRef.current) return;
      const canvas = sourceCanvasRef.current;
      if (canvas) {
        const maxDim = 1200;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          const ratio = Math.min(maxDim / w, maxDim / h);
          w *= ratio;
          h *= ratio;
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, w, h);
        setImageSrc(src);
        setIsVideo(false);
        setMediaState('ready');
        processFrame(canvas, targetCanvasRef.current!, settings);
        setStatus('success', 'Image loaded');
      }
    };
    img.onerror = () => {
      if (loadSeq !== undefined && loadSeq !== loadSeqRef.current) return;
      setImageSrc(null);
      setIsVideo(false);
      setMediaState('error');
      setStatus('error', 'Image failed to load');
    };
    img.src = src;
  };

  const loadVideo = (src: string, loadSeq?: number) => {
    if (videoRef.current) {
      const video = videoRef.current;
      video.pause();
      video.src = src;
      video.load();
      video.onloadedmetadata = () => {
        if (loadSeq !== undefined && loadSeq !== loadSeqRef.current) return;
        if (videoRef.current && sourceCanvasRef.current) {
          sourceCanvasRef.current.width = videoRef.current.videoWidth;
          sourceCanvasRef.current.height = videoRef.current.videoHeight;
          setImageSrc(src);
          setIsVideo(true);
          video.currentTime = 0;
        }
      };
      video.onloadeddata = () => {
        if (loadSeq !== undefined && loadSeq !== loadSeqRef.current) return;
        if (sourceCanvasRef.current && targetCanvasRef.current) {
          const ctx = sourceCanvasRef.current.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0);
            processFrame(sourceCanvasRef.current, targetCanvasRef.current, settings);
            setMediaState('ready');
            setStatus('success', 'Video loaded');
          }
        }
      };
      video.onerror = () => {
        if (loadSeq !== undefined && loadSeq !== loadSeqRef.current) return;
        setImageSrc(null);
        setIsVideo(false);
        setMediaState('error');
        setStatus('error', 'Video failed to load');
      };
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const isVideoFile = file.type.startsWith('video/');
      loadSeqRef.current += 1;
      const currentSeq = loadSeqRef.current;
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      const src = URL.createObjectURL(file);
      objectUrlRef.current = src;
      setImageSrc(src);
      setIsVideo(isVideoFile);
      setMediaState('loading');
      if (isVideoFile) {
        loadVideo(src, currentSeq);
      } else {
        loadImage(src, currentSeq);
      }
      e.target.value = '';
    }
  };

  const handleDownloadImage = () => {
    if (targetCanvasRef.current) {
      const link = document.createElement('a');
      link.download = 'reticulations-art.png';
      link.href = targetCanvasRef.current.toDataURL('image/png');
      link.click();
    }
  };

  const handleDownloadVideo = async () => {
    if (!videoRef.current || !sourceCanvasRef.current || !targetCanvasRef.current) return;

    setIsExporting(true);
    setExportProgress(0);

    try {
      const ffmpegReady = await ensureFFmpegLoaded();
      const video = videoRef.current;
      const sourceCanvas = sourceCanvasRef.current;
      const targetCanvas = targetCanvasRef.current;
      const sourceCtx = sourceCanvas.getContext('2d');

      if (!sourceCtx) return;

      // Get video metadata - use optimized FPS for export
      const fps = videoFps;
      const duration = video.duration;
      const totalFrames = Math.max(1, Math.round(duration * fps));
      const frameIntervalMs = 1000 / fps;

      // Create canvas stream and record as WebM
      if (typeof MediaRecorder === 'undefined') {
        setStatus('error', 'Video export not supported in this browser');
        setIsExporting(false);
        setExportProgress(0);
        return;
      }

      const stream = targetCanvas.captureStream(fps);
      const preferredTypes = [
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm',
      ];
      const canCheckTypes = typeof MediaRecorder.isTypeSupported === 'function';
      const mimeType = canCheckTypes
        ? preferredTypes.find((type) => MediaRecorder.isTypeSupported(type))
        : undefined;

      let mediaRecorder: MediaRecorder;
      try {
        mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      } catch (error) {
        setStatus('error', 'Video export not supported in this browser');
        setIsExporting(false);
        setExportProgress(0);
        return;
      }
      const chunks: BlobPart[] = [];

      const seekTo = (time: number) => {
        return new Promise<void>((resolve, reject) => {
          const handleSeeked = () => {
            cleanup();
            resolve();
          };
          const handleError = () => {
            cleanup();
            reject(new Error('Video seek failed'));
          };
          const cleanup = () => {
            video.removeEventListener('seeked', handleSeeked);
            video.removeEventListener('error', handleError);
          };
          video.addEventListener('seeked', handleSeeked, { once: true });
          video.addEventListener('error', handleError, { once: true });
          video.currentTime = Math.min(time, duration);
        });
      };

      const previousLoop = video.loop;
      video.loop = false;
      video.pause();

      await new Promise<void>((resolve) => {
        mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
        mediaRecorder.onstop = () => resolve();

        mediaRecorder.start();

        // Process video frame by frame
        let currentFrame = 0;
        const renderNext = () => {
          if (currentFrame >= totalFrames) {
            setTimeout(() => {
              mediaRecorder.stop();
              video.loop = previousLoop;
            }, 100);
            return;
          }

          const targetTime = currentFrame / fps;
          const tickStart = performance.now();

          seekTo(targetTime)
            .then(() => {
              sourceCtx.drawImage(video, 0, 0);
              processFrame(sourceCanvas, targetCanvas, settings);
              currentFrame++;
              setExportProgress(Math.round((currentFrame / totalFrames) * 50));
            })
            .catch(() => {
              currentFrame = totalFrames;
            })
            .finally(() => {
              const elapsed = performance.now() - tickStart;
              const delay = Math.max(0, frameIntervalMs - elapsed);
              setTimeout(renderNext, delay);
            });
        };

        renderNext();
      });

      // Convert WebM to MP4 using FFmpeg
      if (!ffmpegRef.current || !ffmpegRef.current.ffmpeg || !ffmpegReady) {
        // Fallback: download as WebM if FFmpeg is not available
        const webmBlob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(webmBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'reticulations-video.webm';
        link.click();
        URL.revokeObjectURL(url);
        setStatus('success', 'Exported WebM (MP4 unavailable)');
        setIsExporting(false);
        setExportProgress(0);
        return;
      }

      const webmBlob = new Blob(chunks, { type: 'video/webm' });
      const webmBuffer = await webmBlob.arrayBuffer();
      const { ffmpeg, toBlobURL } = ffmpegRef.current;

      ffmpeg.writeFile('input.webm', new Uint8Array(webmBuffer));
      await ffmpeg.exec([
        '-i', 'input.webm',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-c:a', 'aac',
        'output.mp4'
      ]);

      const data = await ffmpeg.readFile('output.mp4');
      const mp4Blob = new Blob([data.buffer], { type: 'video/mp4' });
      const url = URL.createObjectURL(mp4Blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = 'reticulations-video.mp4';
      link.click();

      URL.revokeObjectURL(url);
      ffmpeg.deleteFile('input.webm');
      ffmpeg.deleteFile('output.mp4');

      setIsExporting(false);
      setExportProgress(0);
    } catch (error) {
      console.error('Error exporting video:', error);
      setStatus('error', 'Video export failed');
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  const handleDownloadPngSequence = async () => {
    if (!videoRef.current || !sourceCanvasRef.current || !targetCanvasRef.current) return;

    setIsExporting(true);
    setExportProgress(0);

    try {
      const video = videoRef.current;
      const sourceCanvas = sourceCanvasRef.current;
      const targetCanvas = targetCanvasRef.current;
      const sourceCtx = sourceCanvas.getContext('2d');

      if (!sourceCtx) return;

      const fps = videoFps;
      const duration = video.duration;
      const totalFrames = Math.max(1, Math.round(duration * fps));
      const frameIntervalMs = 1000 / fps;

      const seekTo = (time: number) => {
        return new Promise<void>((resolve, reject) => {
          const handleSeeked = () => {
            cleanup();
            resolve();
          };
          const handleError = () => {
            cleanup();
            reject(new Error('Video seek failed'));
          };
          const cleanup = () => {
            video.removeEventListener('seeked', handleSeeked);
            video.removeEventListener('error', handleError);
          };
          video.addEventListener('seeked', handleSeeked, { once: true });
          video.addEventListener('error', handleError, { once: true });
          video.currentTime = Math.min(time, duration);
        });
      };

      const previousLoop = video.loop;
      video.loop = false;
      video.pause();

      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();

      for (let frame = 0; frame < totalFrames; frame += 1) {
        const targetTime = frame / fps;
        const tickStart = performance.now();

        await seekTo(targetTime);
        sourceCtx.drawImage(video, 0, 0);
        processFrame(sourceCanvas, targetCanvas, settings);

        const blob = await new Promise<Blob | null>((resolve) =>
          targetCanvas.toBlob(resolve, 'image/png')
        );
        if (blob) {
          const index = String(frame + 1).padStart(4, '0');
          zip.file(`reticulations-frame-${index}.png`, blob);
        }

        setExportProgress(Math.round(((frame + 1) / totalFrames) * 100));
        const elapsed = performance.now() - tickStart;
        const delay = Math.max(0, frameIntervalMs - elapsed);
        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      video.loop = previousLoop;
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'reticulations-frames.zip';
      link.click();
      URL.revokeObjectURL(url);
      setStatus('success', 'PNG sequence downloaded');
      setIsExporting(false);
      setExportProgress(0);
    } catch (error) {
      console.error('Error exporting PNG sequence:', error);
      setStatus('error', 'PNG sequence export failed');
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row overflow-hidden font-sans">
      <div className="p-4 border-b border-border md:hidden">
        <div className="flex items-center gap-2">
          <img src={logoUrl} className="w-8 h-8 rounded object-contain" alt="Reticulations Logo" />
          <h1 className="text-xl font-bold tracking-tight">Reticulations</h1>
        </div>
      </div>

      <aside className="order-3 md:order-1 w-full md:w-[380px] border-r border-border bg-card/50 backdrop-blur-xl h-full flex flex-col md:h-screen z-10 overflow-y-auto custom-scrollbar">
        <div className="hidden md:block p-6 border-b border-border">
          <div className="flex items-center gap-2">
            <img src={logoUrl} className="w-8 h-8 rounded object-contain" alt="Reticulations Logo" />
            <h1 className="text-xl font-bold tracking-tight">Reticulations</h1>
          </div>
        </div>

        <div className="flex-1 p-4 md:p-6 space-y-6 md:space-y-8">
          <section className="space-y-2 md:space-y-4">
            <Label className="hidden md:block text-xs uppercase tracking-wider font-semibold text-muted-foreground">Source</Label>
            <div
              className="border-2 border-dashed border-border rounded-lg p-3 md:p-6 hover:bg-accent/50 transition-colors cursor-pointer text-center group"
              onClick={() => fileInputRef.current?.click()}
            >
              {isVideo ? (
                <Video className="w-7 h-7 md:w-8 md:h-8 mx-auto mb-1.5 md:mb-2 text-muted-foreground group-hover:text-primary transition-colors" />
              ) : (
                <Upload className="w-7 h-7 md:w-8 md:h-8 mx-auto mb-1.5 md:mb-2 text-muted-foreground group-hover:text-primary transition-colors" />
              )}
              <p className="text-xs md:text-sm font-medium">Click to upload image or video</p>
              <p className="text-[10px] md:text-xs text-muted-foreground mt-1">JPG, PNG, WEBP, MP4, WebM, OGG</p>
            </div>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" onChange={handleFileUpload} />
            <video ref={videoRef} className="hidden" />
          </section>

          <Separator />

          <section className="space-y-4 md:space-y-6">
            <Label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Parameters</Label>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="gridSize">Grid Density</Label>
                <span className="text-xs text-muted-foreground">{settings.gridSize}px</span>
              </div>
              <Slider
                id="gridSize" min={4} max={40} step={1} value={[settings.gridSize]}
                onValueChange={([val]) => setSettings(s => ({ ...s, gridSize: val }))}
              />
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="contrast">Contrast</Label>
                <span className="text-xs text-muted-foreground">{settings.contrast.toFixed(1)}x</span>
              </div>
              <Slider
                id="contrast" min={0.5} max={3} step={0.1} value={[settings.contrast]}
                onValueChange={([val]) => setSettings(s => ({ ...s, contrast: val }))}
              />
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="overlap">Shape Overlap</Label>
                <span className="text-xs text-muted-foreground">{settings.overlap.toFixed(1)}x</span>
              </div>
              <Slider
                id="overlap" min={-0.5} max={1} step={0.1} value={[settings.overlap]}
                onValueChange={([val]) => setSettings(s => ({ ...s, overlap: val }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="invert">Invert Source</Label>
              <Switch
                id="invert" checked={settings.invert}
                onCheckedChange={(checked) => setSettings(s => ({ ...s, invert: checked }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="uniformSize">Threshold Mode</Label>
              <Switch
                id="uniformSize" checked={settings.uniformSize}
                onCheckedChange={(checked) => setSettings(s => ({ ...s, uniformSize: checked }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="edgeDetection">Edge Detection</Label>
              <Switch
                id="edgeDetection" checked={settings.edgeDetection ?? false}
                onCheckedChange={(checked) => setSettings(s => ({ ...s, edgeDetection: checked }))}
              />
            </div>
            {settings.edgeDetection && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="sensitivity">Edge Sensitivity</Label>
                  <span className="text-xs text-muted-foreground">{(settings.sensitivity ?? 1).toFixed(1)}x</span>
                </div>
                <Slider
                  id="sensitivity" min={0.1} max={5} step={0.1} value={[settings.sensitivity ?? 1]}
                  onValueChange={([val]) => setSettings(s => ({ ...s, sensitivity: val }))}
                />
              </div>
            )}
            {isVideo && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="videoFps">Video FPS</Label>
                  <span className="text-xs text-muted-foreground">{videoFps} fps</span>
                </div>
                <Slider
                  id="videoFps" min={8} max={24} step={1} value={[videoFps]}
                  onValueChange={([val]) => setVideoFps(val)}
                />
              </div>
            )}
          </section>

          <Separator />

          <section className="space-y-3 md:space-y-4">
            <Label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Shape Primitive</Label>
            <div className="grid grid-cols-4 gap-2">
              {Object.keys(SHAPES).map((shapeKey) => (
                <button
                  key={shapeKey}
                  onClick={() => setSettings(s => ({ ...s, shape: shapeKey as ShapeType }))}
                  className={`
                    aspect-square rounded-md flex items-center justify-center transition-all border
                    ${settings.shape === shapeKey
                      ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20'
                      : 'bg-card border-border hover:border-primary/50 text-muted-foreground'}
                  `}
                  title={shapeKey}
                >
                  {shapeKey === 'circle' && <div className="w-3 h-3 rounded-full bg-current" />}
                  {shapeKey === 'square' && <div className="w-3 h-3 bg-current" />}
                  {shapeKey === 'triangle' && <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[10px] border-b-current" />}
                  {shapeKey === 'diamond' && <div className="w-3 h-3 bg-current rotate-45" />}
                  {shapeKey === 'star' && (
                    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
                      <path d="M12 2.5l2.9 6.04 6.66.97-4.82 4.7 1.14 6.64L12 17.77 6.12 20.85l1.14-6.64-4.82-4.7 6.66-.97L12 2.5z" />
                    </svg>
                  )}
                  {shapeKey === 'heart' && (
                    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
                      <path d="M12 21s-6.7-4.35-9.2-7.7C1 11.2 1.2 7.8 3.5 6c1.8-1.4 4.4-1.2 6 0.6L12 9l2.5-2.4c1.6-1.8 4.2-2 6-0.6 2.3 1.8 2.5 5.2 0.7 7.3C18.7 16.7 12 21 12 21z" />
                    </svg>
                  )}
                  {shapeKey === 'hex' && <div className="w-3 h-3 bg-current [clip-path:polygon(25%_0%,_75%_0%,_100%_50%,_75%_100%,_25%_100%,_0%_50%)]" />}
                  {shapeKey === 'parallel' && <div className="text-xs">|||</div>}
                </button>
              ))}
            </div>
          </section>

          <Separator />

          <section className="space-y-3 md:space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Palette</Label>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => {
                  if (settings.bgColor.trim().toLowerCase() === 'transparent') return;
                  setSettings(s => ({ ...s, bgColor: s.fgColor, fgColor: s.bgColor }));
                }}
                disabled={settings.bgColor.trim().toLowerCase() === 'transparent'}
                title="Swap colors"
              >
                <ArrowLeftRight className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Foreground Color</Label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Input
                      type="text"
                      value={settings.fgColor}
                      onChange={(e) => setSettings(s => ({ ...s, fgColor: e.target.value }))}
                      className="pl-10 font-mono text-xs h-9 uppercase"
                      placeholder="#FFFFFF"
                    />
                    <div
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded border border-white/10"
                      style={{ backgroundColor: settings.fgColor }}
                    />
                  </div>
                  <input
                    type="color"
                    value={settings.fgColor}
                    onChange={(e) => setSettings(s => ({ ...s, fgColor: e.target.value }))}
                    className="h-9 w-12 cursor-pointer rounded-md border border-input bg-background p-1"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Background Color</Label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Input
                      type="text"
                      value={settings.bgColor}
                      onChange={(e) => setSettings(s => ({ ...s, bgColor: e.target.value }))}
                      className="pl-10 font-mono text-xs h-9 uppercase"
                      placeholder="#000000"
                    />
                    <div
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded border border-white/10"
                      style={{ backgroundColor: settings.bgColor }}
                    />
                  </div>
                  <input
                    type="color"
                    value={settings.bgColor}
                    onChange={(e) => setSettings(s => ({ ...s, bgColor: e.target.value }))}
                    className="h-9 w-12 cursor-pointer rounded-md border border-input bg-background p-1"
                    disabled={settings.bgColor.trim().toLowerCase() === 'transparent'}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="bgTransparent"
                    checked={settings.bgColor.trim().toLowerCase() === 'transparent'}
                    onCheckedChange={(checked) =>
                      setSettings(s => ({ ...s, bgColor: checked ? 'transparent' : '#1a1a1a' }))
                    }
                  />
                  <Label htmlFor="bgTransparent" className="text-xs text-muted-foreground">Transparent</Label>
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="p-4 md:p-6 border-t border-border mt-auto space-y-2">
          {isVideo && (
            <div className="flex gap-2">
              <Button
                type="button"
                variant={exportMode === 'video' ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => setExportMode('video')}
              >
                Video
              </Button>
              <Button
                type="button"
                variant={exportMode === 'png' ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => setExportMode('png')}
              >
                PNG Sequence
              </Button>
            </div>
          )}
          <Button
            onClick={
              isVideo
                ? exportMode === 'video'
                  ? handleDownloadVideo
                  : handleDownloadPngSequence
                : handleDownloadImage
            }
            className="w-full"
            size="lg"
            disabled={isVideo ? isExporting : false}
          >
            <Download className="w-4 h-4 mr-2" />
            {isVideo
              ? isExporting
                ? `Exporting ${exportProgress}%`
                : exportMode === 'video'
                  ? 'Export Video'
                  : 'Export PNG Sequence'
              : 'Export Image'}
          </Button>
        </div>
      </aside>

      <main className="order-2 md:order-2 flex-1 bg-stone-900/50 relative flex items-center justify-center p-4 md:p-8 overflow-hidden bg-[radial-gradient(#2a2a2a_1px,transparent_1px)] [background-size:16px_16px]">
        <canvas ref={sourceCanvasRef} className="hidden" />
        <div className="flex flex-col items-center max-w-full">
          <div className="relative shadow-2xl shadow-black/50 rounded-lg overflow-hidden border border-white/10 max-w-full max-h-full">
            {mediaState !== 'ready' && (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground z-10 bg-card/80 backdrop-blur-sm">
                <div className="text-center px-6 py-10 w-full max-w-3xl">
                  <ImageIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  {mediaState === 'loading' && <p>Loading media...</p>}
                  {mediaState === 'error' && <p>Failed to load media. Try again.</p>}
                  {mediaState === 'idle' && <p>Upload an image or video to start</p>}
                </div>
              </div>
            )}
            {isVideo && imageSrc ? (
              <div className="relative w-full max-h-[85vh]">
                <video
                  ref={videoRef}
                  className="hidden"
                  crossOrigin="anonymous"
                  loop
                />
                <canvas
                  ref={targetCanvasRef}
                  className="max-w-full max-h-[85vh] w-full object-contain block"
                />
              </div>
            ) : (
              <canvas
                ref={targetCanvasRef}
                className={`max-w-full max-h-[85vh] object-contain block ${isBgTransparent ? '' : 'bg-checkered'}`}
                style={{ opacity: imageSrc ? 1 : 0.5, transition: 'opacity 0.3s ease' }}
              />
            )}
          </div>
          {isVideo && imageSrc && (
            <p className="mt-3 text-xs text-muted-foreground text-center">
              Video loaded, start changing parameters to see the effect
            </p>
          )}
        </div>
      </main>
      {uploadStatus && (
        <div className="fixed bottom-4 right-4 z-50">
          <div
            className={`rounded-md border px-3 py-2 text-xs shadow-lg backdrop-blur-md ${
              uploadStatus.type === 'success'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
                : 'border-red-500/30 bg-red-500/10 text-red-100'
            }`}
            role={uploadStatus.type === 'error' ? 'alert' : 'status'}
          >
            {uploadStatus.message}
          </div>
        </div>
      )}
    </div>
  );
}
