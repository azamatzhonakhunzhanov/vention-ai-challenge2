import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";
import { Button } from "@/components/ui/button";
import { Camera, CameraOff, RefreshCw } from "lucide-react";

type Props = {
  onDecode: (text: string) => void;
  paused?: boolean;
};

export function QrScanner({ onDecode, paused }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const lastRef = useRef<{ text: string; at: number }>({ text: "", at: 0 });
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined);

  const stop = () => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setActive(false);
  };

  const start = async (preferredId?: string) => {
    setError(null);
    try {
      const reader = new BrowserMultiFormatReader();
      // Enumerate cameras (after a getUserMedia prompt may be needed)
      let chosen = preferredId;
      try {
        const list = await BrowserMultiFormatReader.listVideoInputDevices();
        setDevices(list);
        if (!chosen) {
          const back = list.find((d) => /back|rear|environment/i.test(d.label));
          chosen = back?.deviceId ?? list[0]?.deviceId;
        }
        setDeviceId(chosen);
      } catch {
        // ignore enumeration errors; fallback to facingMode
      }

      const constraints: MediaStreamConstraints = chosen
        ? { video: { deviceId: { exact: chosen } } }
        : { video: { facingMode: { ideal: "environment" } } };

      const controls = await reader.decodeFromConstraints(
        constraints,
        videoRef.current!,
        (result) => {
          if (!result) return;
          const text = result.getText();
          const now = Date.now();
          if (text === lastRef.current.text && now - lastRef.current.at < 2000) return;
          lastRef.current = { text, at: now };
          onDecode(text);
        },
      );
      controlsRef.current = controls;
      setActive(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Camera unavailable";
      setError(msg);
      setActive(false);
    }
  };

  useEffect(() => {
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (paused && active) stop();
  }, [paused, active]);

  const switchCamera = async () => {
    if (devices.length < 2) return;
    const idx = devices.findIndex((d) => d.deviceId === deviceId);
    const next = devices[(idx + 1) % devices.length];
    stop();
    await start(next.deviceId);
  };

  return (
    <div className="space-y-3">
      <div className="relative aspect-square w-full overflow-hidden rounded-lg border bg-muted">
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
        {!active && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
            <Camera className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {error ?? "Tap to enable the camera and scan tickets."}
            </p>
          </div>
        )}
        {active && (
          <div className="pointer-events-none absolute inset-8 rounded-lg border-2 border-primary/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.25)]" />
        )}
      </div>
      <div className="flex gap-2">
        {!active ? (
          <Button onClick={() => start(deviceId)} size="sm" className="flex-1">
            <Camera className="mr-1 h-4 w-4" /> Start camera
          </Button>
        ) : (
          <>
            <Button onClick={stop} size="sm" variant="outline" className="flex-1">
              <CameraOff className="mr-1 h-4 w-4" /> Stop
            </Button>
            {devices.length > 1 && (
              <Button onClick={switchCamera} size="sm" variant="outline">
                <RefreshCw className="mr-1 h-4 w-4" /> Switch
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
