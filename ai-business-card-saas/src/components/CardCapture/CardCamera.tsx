// components/CardCapture/CardCamera.tsx
import { useRef, useCallback, useState, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Camera, SwitchCamera, AlertCircle } from 'lucide-react';

interface Props {
  onCapture: (file: File) => void;
}

export function CardCamera({ onCapture }: Props) {
  const webcamRef = useRef<Webcam>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string>('');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  // Enumerate video devices
  const handleDevices = useCallback(
    (mediaDevices: MediaDeviceInfo[]) => {
      const videoDevices = mediaDevices.filter(({ kind }) => kind === 'videoinput');
      setDevices(videoDevices);
      
      if (videoDevices.length > 0 && !activeDeviceId) {
        // Prefer rear camera if available on load
        const environmentCamera = videoDevices.find(device => 
          device.label.toLowerCase().includes('back') || 
          device.label.toLowerCase().includes('rear') ||
          device.label.toLowerCase().includes('environment')
        );
        setActiveDeviceId(environmentCamera ? environmentCamera.deviceId : videoDevices[0].deviceId);
      }
    },
    [activeDeviceId]
  );

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(handleDevices);
  }, [handleDevices]);

  const capture = useCallback(() => {
    const dataUrl = webcamRef.current?.getScreenshot({ width: 1920, height: 1080 });
    if (!dataUrl) return;

    // Convert base64 data URL → File object
    fetch(dataUrl)
      .then(r => r.blob())
      .then(blob => {
        const file = new File([blob], `card-${Date.now()}.jpg`, { type: 'image/jpeg' });
        onCapture(file);
      });
  }, [onCapture]);

  const switchCamera = () => {
    if (devices.length < 2) return;
    const currentIndex = devices.findIndex(d => d.deviceId === activeDeviceId);
    const nextIndex = (currentIndex + 1) % devices.length;
    setActiveDeviceId(devices[nextIndex].deviceId);
  };

  const handleUserMedia = () => {
    setHasPermission(true);
  };

  const handleUserMediaError = (error: string | DOMException) => {
    console.error('Webcam permission error:', error);
    setHasPermission(false);
  };

  return (
    <div className="flex flex-col gap-4">
      {hasPermission === false ? (
        <div className="flex flex-col items-center justify-center p-8 bg-red-50 border border-red-100 rounded-xl text-center gap-3">
          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
            <AlertCircle size={24} />
          </div>
          <h3 className="font-semibold text-gray-900 text-sm">Camera access denied</h3>
          <p className="text-xs text-gray-500 max-w-xs">
            Please allow camera permissions in your browser settings to scan cards directly.
          </p>
        </div>
      ) : (
        <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/3] sm:aspect-video shadow-lg group">
          {activeDeviceId ? (
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              screenshotQuality={0.95}
              videoConstraints={{
                deviceId: activeDeviceId,
                width: { ideal: 1920 },
                height: { ideal: 1080 },
              }}
              onUserMedia={handleUserMedia}
              onUserMediaError={handleUserMediaError}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <div className="spinner border-gray-600 border-t-white" />
            </div>
          )}

          {/* Alignment guide overlay */}
          <div className="absolute inset-8 sm:inset-12 border-2 border-brand-400/50 rounded-lg pointer-events-none flex flex-col items-center justify-center">
            {/* Corner styling guides */}
            <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-brand-400 rounded-tl-md -mt-1.5 -ml-1.5" />
            <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-brand-400 rounded-tr-md -mt-1.5 -mr-1.5" />
            <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-brand-400 rounded-bl-md -mb-1.5 -ml-1.5" />
            <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-brand-400 rounded-br-md -mb-1.5 -mr-1.5" />
            
            <p className="text-[10px] sm:text-xs text-brand-400 font-semibold tracking-wider uppercase bg-black/60 px-3 py-1 rounded-full backdrop-blur-sm">
              Place Business Card Here
            </p>
          </div>

          {/* Quick toggle cameras button */}
          {devices.length > 1 && (
            <button
              onClick={switchCamera}
              className="absolute bottom-4 right-4 p-2.5 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-sm transition-all duration-150 active:scale-95"
              title="Switch Camera"
            >
              <SwitchCamera size={18} />
            </button>
          )}
        </div>
      )}

      {hasPermission !== false && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-[11px] text-gray-500 text-center">
            Align card details clearly in the box · hold steady
          </p>
          <button
            onClick={capture}
            className="w-16 h-16 rounded-full border-4 border-white shadow-lg bg-white/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center relative cursor-pointer"
          >
            <div className="w-12 h-12 rounded-full bg-brand-400 hover:bg-brand-500 flex items-center justify-center text-white transition-colors shadow-inner">
              <Camera size={20} />
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

export default CardCamera;