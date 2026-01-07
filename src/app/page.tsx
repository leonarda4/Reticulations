"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ProcessorSettings, ShapeType, SHAPES, processImage } from '@/lib/processor';
import { Upload, Download, Settings2, Image as ImageIcon, Plus, Layers, X } from 'lucide-react';
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
  const [isProcessing, setIsProcessing] = useState(false);
  const [settings, setSettings] = useState<ProcessorSettings>({
    gridSize: 12,
    contrast: 1.2,
    fgColor: '#ffffff',
    bgColor: '#1a1a1a',
    shape: 'circle',
    invert: false,
    uniformSize: false,
    overlap: 0
  });

  // Refs
  const sourceCanvasRef = useRef<HTMLCanvasElement>(null);
  const targetCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load demo image on start
  useEffect(() => {
    loadImage(DEMO_IMAGE);
  }, []);

  // Process effect
  useEffect(() => {
    if (imageSrc && sourceCanvasRef.current && targetCanvasRef.current) {
      process();
    }
  }, [imageSrc, settings]);

  const loadImage = (src: string) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
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
      }
    };
    img.src = src;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          loadImage(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const process = useCallback(() => {
    if (!sourceCanvasRef.current || !targetCanvasRef.current) return;
    setIsProcessing(true);
    requestAnimationFrame(() => {
      processImage(sourceCanvasRef.current!, targetCanvasRef.current!, settings);
      setIsProcessing(false);
    });
  }, [settings]);

  const handleDownload = () => {
    if (targetCanvasRef.current) {
      const link = document.createElement('a');
      link.download = 'reticulations-art.png';
      link.href = targetCanvasRef.current.toDataURL('image/png');
      link.click();
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row overflow-hidden font-sans">
      <aside className="w-full md:w-[380px] border-r border-border bg-card/50 backdrop-blur-xl h-full flex flex-col md:h-screen z-10 overflow-y-auto custom-scrollbar">
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-2">
            <img src={logoUrl} className="w-8 h-8 rounded object-contain" alt="Reticulations Logo" />
            <h1 className="text-xl font-bold tracking-tight">Reticulations</h1>
          </div>
        </div>

        <div className="flex-1 p-6 space-y-8">
          <section className="space-y-4">
            <Label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Source</Label>
            <div
              className="border-2 border-dashed border-border rounded-lg p-6 hover:bg-accent/50 transition-colors cursor-pointer text-center group"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground group-hover:text-primary transition-colors" />
              <p className="text-sm font-medium">Click to upload image</p>
              <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WEBP</p>
            </div>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
          </section>

          <Separator />

          <section className="space-y-6">
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
                id="overlap" min={0} max={1} step={0.1} value={[settings.overlap]}
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
          </section>

          <Separator />

          <section className="space-y-4">
            <Label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Shape Primitive</Label>
            <div className="grid grid-cols-4 gap-2">
              {Object.keys(SHAPES).map((shapeKey) => (
                <button
                  key={shapeKey}
                  onClick={() => setSettings(s => ({ ...s, shape: shapeKey as ShapeType }))}
                  className={`
                    aspect-square rounded-md flex items-center justify-center transition-all border
                    ${settings.shape === shapeKey
                      ? 'bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/20'
                      : 'bg-card border-border hover:border-primary/50 text-muted-foreground'}
                  `}
                  title={shapeKey}
                >
                  {shapeKey === 'circle' && <div className="w-3 h-3 rounded-full bg-current" />}
                  {shapeKey === 'square' && <div className="w-3 h-3 bg-current" />}
                  {shapeKey === 'triangle' && <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[10px] border-b-current" />}
                  {shapeKey === 'diamond' && <div className="w-3 h-3 bg-current rotate-45" />}
                  {shapeKey === 'star' && <Settings2 className="w-4 h-4" />}
                  {shapeKey === 'heart' && <div className="text-[10px]">♥</div>}
                  {shapeKey === 'hex' && <div className="w-3 h-3 bg-current [clip-path:polygon(25%_0%,_75%_0%,_100%_50%,_75%_100%,_25%_100%,_0%_50%)]" />}
                  {shapeKey === 'parallel' && <div className="text-xs">|||</div>}
                </button>
              ))}
            </div>
          </section>

          <Separator />

          <section className="space-y-4">
            <Label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Palette</Label>
            <div className="grid grid-cols-1 gap-4">
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
                  />
                </div>
              </div>
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
            </div>
          </section>
        </div>

        <div className="p-6 border-t border-border mt-auto">
          <Button onClick={handleDownload} className="w-full" size="lg">
            <Download className="w-4 h-4 mr-2" />
            Export Image
          </Button>
        </div>
      </aside>

      <main className="flex-1 bg-stone-900/50 relative flex items-center justify-center p-8 overflow-hidden bg-[radial-gradient(#2a2a2a_1px,transparent_1px)] [background-size:16px_16px]">
        <canvas ref={sourceCanvasRef} className="hidden" />
        <div className="relative shadow-2xl shadow-black/50 rounded-lg overflow-hidden border border-white/10 max-w-full max-h-full">
          {!imageSrc && (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground z-10 bg-card/80 backdrop-blur-sm">
              <div className="text-center">
                <ImageIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Upload an image to start</p>
              </div>
            </div>
          )}
          <canvas
            ref={targetCanvasRef}
            className="max-w-full max-h-[85vh] object-contain block bg-checkered"
            style={{ opacity: imageSrc ? 1 : 0.5, transition: 'opacity 0.3s ease' }}
          />
        </div>
      </main>
    </div>
  );
}