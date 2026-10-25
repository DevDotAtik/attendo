'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Camera, RefreshCw, AlertCircle, Sparkles, SwitchCamera } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import jsQR from 'jsqr';

export default function ScannerPage() {
  const router = useRouter();
  const [manualToken, setManualToken] = useState('');
  const [cameraError, setCameraError] = useState('');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scannedRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);

  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const handleQrDetected = (text: string) => {
    if (scannedRef.current) return;
    scannedRef.current = true;

    // Haptic feedback if available on mobile
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(100);
      } catch {}
    }

    stopCamera();

    const token = text.includes('/s/')
      ? text.split('/s/')[1].split('?')[0].trim()
      : text.trim();

    router.push(`/s/${token}`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCameraError('');
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, img.width, img.height);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code && code.data) {
          handleQrDetected(code.data);
        } else {
          setCameraError('No QR code detected in the photo. Please take a closer, clearer picture.');
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const startCamera = async (mode: 'environment' | 'user') => {
    stopCamera();
    setCameraError('');

    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraError('Live video requires HTTPS or localhost. Tap below to snap a photo of the QR code with your camera.');
      return;
    }

    try {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter((d) => d.kind === 'videoinput');
        setHasMultipleCameras(videoDevices.length > 1);
      } catch {}

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        scanFrame();
      }
    } catch (err: any) {
      console.warn('[Scanner Error]:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Camera access was denied. You can snap a photo or enter the token below.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError('No live camera found on this device. You can snap/upload a photo below.');
      } else {
        setCameraError('Unable to start live camera. You can snap/upload a photo below.');
      }
    }
  };

  const scanFrame = () => {
    if (scannedRef.current) return;

    const video = videoRef.current;
    if (video && video.readyState === video.HAVE_ENOUGH_DATA) {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });

        if (code && code.data) {
          handleQrDetected(code.data);
          return;
        }
      }
    }

    animationFrameRef.current = requestAnimationFrame(scanFrame);
  };

  useEffect(() => {
    scannedRef.current = false;
    startCamera(facingMode);

    return () => {
      stopCamera();
    };
  }, [facingMode]);

  const toggleCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualToken.trim()) return;

    const token = manualToken.includes('/s/')
      ? manualToken.split('/s/')[1].split('?')[0].trim()
      : manualToken.trim();

    stopCamera();
    router.push(`/s/${token}`);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="border-b border-teal-200 dark:border-teal-900 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            href="/student"
            className="p-2 -ml-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <span className="font-bold text-lg text-slate-900 dark:text-slate-100">Scan QR Code</span>
          <ThemeToggle />
        </div>
      </header>

      {/* Camera Viewfinder Area */}
      <main className="max-w-md mx-auto px-4 py-6 flex-1 w-full flex flex-col items-center justify-between">
        <div className="w-full flex flex-col items-center">
          {/* Hidden camera snapshot input */}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
          />

          {/* Scanner Box */}
          <div className="relative w-full aspect-square max-w-xs bg-slate-950 rounded-3xl overflow-hidden shadow-2xl border-4 border-teal-500/40 flex flex-col items-center justify-center text-center text-white">
            {cameraError ? (
              <div className="p-6 flex flex-col items-center">
                <AlertCircle className="w-10 h-10 text-amber-400 mb-2" />
                <p className="text-xs text-slate-300 mb-4">{cameraError}</p>
                <div className="flex flex-col gap-2 w-full max-w-[200px]">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-2.5 px-3 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow"
                  >
                    <Camera className="w-4 h-4" /> Snap Photo of QR
                  </button>
                  <button
                    type="button"
                    onClick={() => startCamera(facingMode)}
                    className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Retry Live Stream
                  </button>
                </div>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  autoPlay
                  className="w-full h-full object-cover"
                />

                {/* Corner Reticles */}
                <div className="absolute top-4 left-4 w-6 h-6 border-t-4 border-l-4 border-teal-400 rounded-tl pointer-events-none" />
                <div className="absolute top-4 right-4 w-6 h-6 border-t-4 border-r-4 border-teal-400 rounded-tr pointer-events-none" />
                <div className="absolute bottom-4 left-4 w-6 h-6 border-b-4 border-l-4 border-teal-400 rounded-bl pointer-events-none" />
                <div className="absolute bottom-4 right-4 w-6 h-6 border-b-4 border-r-4 border-teal-400 rounded-br pointer-events-none" />

                {/* Scanning line animation */}
                <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-teal-400 to-transparent animate-pulse pointer-events-none" />

                {hasMultipleCameras && (
                  <button
                    onClick={toggleCamera}
                    className="absolute bottom-3 right-3 p-2.5 bg-black/60 hover:bg-black/80 text-white rounded-xl backdrop-blur-md transition-colors"
                    title="Switch Camera"
                  >
                    <SwitchCamera className="w-4 h-4" />
                  </button>
                )}
              </>
            )}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-teal-50 dark:hover:bg-slate-800 text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm text-slate-700 dark:text-slate-300"
            >
              <Camera className="w-3.5 h-3.5 text-teal-600" /> Snap Photo / Upload QR
            </button>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 text-center mt-3 max-w-xs">
            Point camera at the live rotating QR on the classroom board. Native phone cameras also work directly.
          </p>
        </div>

        {/* Manual Token / Link Fallback */}
        <div className="w-full bg-white dark:bg-slate-900 border border-teal-100 dark:border-teal-900 p-5 rounded-2xl shadow-sm mt-6">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-teal-600" /> Or Enter Token Directly
          </h2>
          <form onSubmit={handleManualSubmit} className="space-y-3">
            <input
              type="text"
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
              placeholder="Paste token or /s/{token} URL"
              className="w-full px-3.5 py-2.5 text-xs border border-slate-300 dark:border-slate-700 rounded-xl shadow-sm focus:ring-2 focus:ring-teal-500 dark:bg-slate-800 dark:text-white"
            />
            <button
              type="submit"
              className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow transition-colors"
            >
              Continue to Attendance
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
