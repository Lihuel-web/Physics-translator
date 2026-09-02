import { useState, useRef, useCallback, useEffect } from "react";

interface UseAudioRecorderProps {
  onAudioChunk: (blob: Blob, mimeType: string) => Promise<void>;
  chunkIntervalMs?: number; // default 3500ms
  speechLang?: string; // e.g. 'en-US', 'es-ES', 'he-IL', or 'auto'
}

export function useAudioRecorder({
  onAudioChunk,
  chunkIntervalMs = 3500,
  speechLang = "auto",
}: UseAudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [speechPreview, setSpeechPreview] = useState<string>("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const recognitionRef = useRef<any>(null);
  const chunkTimerRef = useRef<number | null>(null);
  const chunksQueueRef = useRef<Blob[]>([]);

  const stopRecording = useCallback(() => {
    if (chunkTimerRef.current) {
      window.clearInterval(chunkTimerRef.current);
      chunkTimerRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }

    setIsRecording(false);
    setAudioLevel(0);
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;

      // Setup audio visualizer analyzer
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const audioCtx = new AudioContextClass();
        audioContextRef.current = audioCtx;
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyserRef.current = analyser;

        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const updateMeter = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const average = sum / dataArray.length;
          // Normalize to 0 - 100
          setAudioLevel(Math.min(100, Math.round((average / 128) * 100)));
          animFrameRef.current = requestAnimationFrame(updateMeter);
        };
        updateMeter();
      } catch (e) {
        console.warn("Audio meter setup skipped", e);
      }

      // Determine supported mimeType
      let mimeType = "audio/webm;codecs=opus";
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        if (MediaRecorder.isTypeSupported("audio/webm")) {
          mimeType = "audio/webm";
        } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
          mimeType = "audio/mp4";
        } else {
          mimeType = "";
        }
      }

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      chunksQueueRef.current = [];

      recorder.ondataavailable = async (e) => {
        if (e.data && e.data.size > 0) {
          chunksQueueRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        if (chunksQueueRef.current.length > 0) {
          const fullBlob = new Blob(chunksQueueRef.current, {
            type: mimeType || "audio/webm",
          });
          chunksQueueRef.current = [];
          if (fullBlob.size > 2000) {
            await onAudioChunk(fullBlob, mimeType || "audio/webm");
          }
        }
      };

      recorder.start();
      setIsRecording(true);

      // Periodically stop and restart recorder to create distinct chunks for Gemini processing
      chunkTimerRef.current = window.setInterval(() => {
        if (recorder.state === "recording") {
          recorder.stop();
          recorder.start();
        }
      }, chunkIntervalMs);

      // Optional Web Speech API for instantaneous live preview while Gemini processes
      const SpeechRecognitionClass =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognitionClass) {
        try {
          const recognition = new SpeechRecognitionClass();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang =
            speechLang && speechLang !== "auto"
              ? speechLang
              : navigator.language || "en-US";

          recognition.onresult = (event: any) => {
            let interim = "";
            for (let i = event.resultIndex; i < event.results.length; ++i) {
              interim += event.results[i][0].transcript;
            }
            setSpeechPreview(interim);
          };

          recognition.onerror = (e: any) => {
            // Ignore non-fatal speech recognition errors (e.g. no-speech)
            if (e.error !== "no-speech") {
              console.warn("Speech recognition error:", e.error);
            }
          };

          recognition.start();
          recognitionRef.current = recognition;
        } catch (e) {
          console.warn("Local SpeechRecognition not started:", e);
        }
      }
    } catch (err: any) {
      console.error("Microphone access error:", err);
      setError(
        err?.message || "Could not access microphone. Please allow microphone permissions."
      );
      setIsRecording(false);
    }
  }, [chunkIntervalMs, onAudioChunk, speechLang]);

  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, [stopRecording]);

  return {
    isRecording,
    audioLevel,
    speechPreview,
    error,
    startRecording,
    stopRecording,
  };
}
