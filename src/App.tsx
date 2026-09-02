import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  CaptionSegment,
  CaptionSettings,
  SUPPORTED_LANGUAGES,
  SUPPORTED_INPUT_LANGUAGES,
  PHYSICS_TOPICS,
  ViewMode,
} from "./types";
import { useAudioRecorder } from "./hooks/useAudioRecorder";
import { SessionTranscript } from "./components/SessionTranscript";
import { ShareModal } from "./components/ShareModal";
import { PhysicsTermCard } from "./components/PhysicsTermCard";
import {
  UILanguage,
  SUPPORTED_UI_LANGUAGES,
  getTranslation,
} from "./i18n";
import {
  Mic,
  MicOff,
  Share2,
  FileText,
  Sparkles,
  Layers,
  Languages,
  Sliders,
  Users,
  Atom,
  ChevronDown,
  Volume2,
  RefreshCw,
  Eye,
  Check,
  Zap,
  Globe,
} from "lucide-react";

export default function App() {
  // Read initial query params
  const [roomId, setRoomId] = useState<string>("physics-8a");
  const [currentTopic, setCurrentTopic] = useState<string>(PHYSICS_TOPICS[0]);
  const [viewMode, setViewMode] = useState<ViewMode>("standard");
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const [connectedStudents, setConnectedStudents] = useState<number>(0);
  const [isProcessingAudio, setIsProcessingAudio] = useState<boolean>(false);

  // UI interface language state
  const [uiLanguage, setUiLanguage] = useState<UILanguage>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("physics_caption_ui_lang");
      if (saved && ["en", "es", "he", "fr", "ar", "zh", "pt", "de", "ru"].includes(saved)) {
        return saved as UILanguage;
      }
    }
    return "es";
  });

  const t = getTranslation(uiLanguage);
  const isUiRtl = ["he", "ar"].includes(uiLanguage);

  const handleUpdateUiLanguage = (lang: UILanguage) => {
    setUiLanguage(lang);
    if (typeof window !== "undefined") {
      localStorage.setItem("physics_caption_ui_lang", lang);
    }
  };

  // Caption settings
  const [settings, setSettings] = useState<CaptionSettings>({
    inputLanguage: "auto", // "auto" for auto-detection or language code
    targetLanguage: "Spanish",
    opacity: 35, // default translucent glass (35% opacity)
    fontSize: "xl",
    position: "bottom",
    bilingual: true,
    highContrast: true,
    highlightPhysicsTerms: true,
    autoScroll: true,
    theme: "glass",
  });

  // Captions and transcript state
  const [transcript, setTranscript] = useState<CaptionSegment[]>([]);
  const [latestSegment, setLatestSegment] = useState<CaptionSegment | null>(null);

  // Parse URL params on load
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlRoom = params.get("room");
      const urlLang = params.get("lang");
      const urlUiLang = params.get("uiLang");

      if (urlRoom) setRoomId(urlRoom);
      if (urlLang) {
        // match supported language
        const found = SUPPORTED_LANGUAGES.find(
          (l) =>
            l.name.toLowerCase() === urlLang.toLowerCase() ||
            l.code.toLowerCase() === urlLang.toLowerCase()
        );
        if (found) {
          setSettings((prev) => ({ ...prev, targetLanguage: found.name }));
          // If URL specifies language, also set matching UI language if valid
          if (["en", "es", "he", "fr", "ar", "zh", "pt", "de", "ru"].includes(found.code)) {
            setUiLanguage(found.code as UILanguage);
          }
        }
      }
      if (urlUiLang && ["en", "es", "he", "fr", "ar", "zh", "pt", "de", "ru"].includes(urlUiLang)) {
        setUiLanguage(urlUiLang as UILanguage);
      }
    }
  }, []);

  // Fetch initial room history
  useEffect(() => {
    if (!roomId) return;
    fetch(`/api/session/${encodeURIComponent(roomId)}/history`)
      .then((res) => res.json())
      .then((data) => {
        if (data.history && Array.isArray(data.history) && data.history.length > 0) {
          setTranscript(data.history);
          setLatestSegment(data.history[data.history.length - 1]);
        }
        if (data.activeTopic) setCurrentTopic(data.activeTopic);
        if (data.activeStudents) setConnectedStudents(data.activeStudents);
      })
      .catch((err) => console.warn("Could not fetch room history:", err));
  }, [roomId]);

  // Connect to Server-Sent Events (SSE) for real-time live captions broadcast
  useEffect(() => {
    if (!roomId) return;

    const eventSource = new EventSource(`/api/session/${encodeURIComponent(roomId)}/events`);

    eventSource.onmessage = async (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "connected") {
          setConnectedStudents(data.studentCount || 1);
        } else if (data.type === "meta") {
          if (data.activeTopic) setCurrentTopic(data.activeTopic);
        } else if (data.type === "caption" && data.segment) {
          const seg: CaptionSegment = data.segment;

          // Check if segment has our target language translation
          const targetLang = settings.targetLanguage;
          if (!seg.translations[targetLang] && seg.originalText) {
            // Student has a different language selected than what was broadcast, translate locally via API
            try {
              const res = await fetch("/api/translate-text", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  text: seg.originalText,
                  targetLanguage: targetLang,
                  currentTopic,
                }),
              });
              const transData = await res.json();
              if (transData.translatedText) {
                seg.translations[targetLang] = transData.translatedText;
                if (transData.physicsTerms && transData.physicsTerms.length > 0) {
                  seg.physicsTerms = [
                    ...(seg.physicsTerms || []),
                    ...transData.physicsTerms,
                  ];
                }
              }
            } catch (err) {
              console.warn("Translation fallback error:", err);
            }
          }

          setLatestSegment(seg);
          setTranscript((prev) => {
            // Avoid duplicate ids
            if (prev.some((s) => s.id === seg.id)) return prev;
            return [...prev, seg];
          });
        }
      } catch (err) {
        console.warn("SSE parse error:", err);
      }
    };

    eventSource.onerror = () => {
      // EventSource will automatically retry connection
    };

    return () => {
      eventSource.close();
    };
  }, [roomId, settings.targetLanguage, currentTopic]);

  // Process recorded audio chunks with Gemini API
  const handleAudioChunk = useCallback(
    async (blob: Blob, mimeType: string) => {
      setIsProcessingAudio(true);
      try {
        // Convert blob to base64
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onloadend = () => {
            const base64 = (reader.result as string).split(",")[1];
            resolve(base64);
          };
          reader.onerror = reject;
        });
        reader.readAsDataURL(blob);
        const base64Audio = await base64Promise;

        const response = await fetch("/api/transcribe-translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            audio: base64Audio,
            mimeType,
            inputLanguage: settings.inputLanguage || "auto",
            targetLanguage: settings.targetLanguage,
            currentTopic,
            roomId,
          }),
        });

        const data = await response.json();
        if (data.segment && data.segment.originalText) {
          const seg: CaptionSegment = data.segment;
          setLatestSegment(seg);
          setTranscript((prev) => {
            if (prev.some((s) => s.id === seg.id)) return prev;
            return [...prev, seg];
          });
        }
      } catch (err) {
        console.error("Audio chunk processing failed:", err);
      } finally {
        setIsProcessingAudio(false);
      }
    },
    [settings.inputLanguage, settings.targetLanguage, currentTopic, roomId]
  );

  // Determine speech recognition language for live client-side preview
  const selectedInputOption = SUPPORTED_INPUT_LANGUAGES.find(
    (l) => l.code === settings.inputLanguage
  );
  const speechLang = selectedInputOption?.speechCode || "auto";

  // Audio recorder hook
  const {
    isRecording,
    audioLevel,
    speechPreview,
    error: micError,
    startRecording,
    stopRecording,
  } = useAudioRecorder({
    onAudioChunk: handleAudioChunk,
    chunkIntervalMs: 3800,
    speechLang,
  });

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Test sample physics phrase generator (for demo or pre-class test)
  const handleSendTestPhysicsSpeech = async () => {
    setIsProcessingAudio(true);
    const testSamples = [
      "Newton's second law states that acceleration is directly proportional to net force and inversely proportional to mass: F equals m times a.",
      "When a roller coaster descends from the highest peak, its gravitational potential energy is converted directly into kinetic energy.",
      "Inertia is an object's resistance to any change in its state of motion. A heavier mass has greater inertia.",
      "Friction is the force opposing motion between two surfaces touching each other, transforming mechanical energy into thermal energy.",
      "Ohm's law relates voltage, current, and resistance in a circuit: voltage equals current multiplied by resistance in ohms.",
    ];
    const randomSample = testSamples[Math.floor(Math.random() * testSamples.length)];

    try {
      const res = await fetch("/api/translate-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: randomSample,
          targetLanguage: settings.targetLanguage,
          currentTopic,
        }),
      });
      const data = await res.json();
      const seg: CaptionSegment = {
        id: "test_" + Date.now(),
        timestamp: Date.now(),
        originalText: randomSample,
        detectedLanguage: "English",
        translations: {
          [settings.targetLanguage]: data.translatedText || randomSample,
        },
        physicsTerms: data.physicsTerms || [],
      };

      // Broadcast to room
      await fetch(`/api/session/${encodeURIComponent(roomId)}/caption`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segment: seg }),
      });

      setLatestSegment(seg);
      setTranscript((prev) => [...prev, seg]);
    } catch (err) {
      console.error("Test speech error:", err);
    } finally {
      setIsProcessingAudio(false);
    }
  };

  const handleUpdateSettings = (newSettings: Partial<CaptionSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  const currentTranslation =
    latestSegment?.translations[settings.targetLanguage] ||
    (latestSegment && Object.values(latestSegment.translations)[0]) ||
    "";

  const isRtl = ["Hebrew", "Arabic", "Urdu", "Persian / Farsi"].includes(
    settings.targetLanguage
  );

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 flex flex-col font-sans relative overflow-x-hidden selection:bg-blue-500 selection:text-white">
      {/* Frosted ambient background mesh */}
      <div
        className="fixed inset-0 pointer-events-none opacity-45 z-0"
        style={{
          background:
            "radial-gradient(circle at 0% 0%, #3b82f6 0%, transparent 45%), radial-gradient(circle at 100% 100%, #8b5cf6 0%, transparent 45%), radial-gradient(circle at 50% 50%, #1e293b 0%, transparent 100%)",
        }}
      />

      {/* Top Main Navigation Header with Frosted Glass */}
      <header className="sticky top-0 z-40 bg-[#020617]/70 backdrop-blur-2xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-3">
          {/* Logo & Class Title */}
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 bg-blue-500/20 backdrop-blur-xl border border-blue-400/30 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/10 flex-shrink-0 text-blue-400">
              <Atom className="w-6 h-6 animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-white leading-tight">
                  Physics VoiceLink
                </h1>
                <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 border border-blue-400/30 text-blue-300">
                  Gemini Live
                </span>
              </div>
              <p className="text-xs text-blue-300/80 font-mono tracking-widest uppercase">
                8th Grade Physics • Room {roomId}
              </p>
            </div>
          </div>

          {/* Mode Switcher Tabs (Live Class vs Transcript) */}
          <div className="hidden md:flex items-center p-1 bg-white/5 backdrop-blur-md border border-white/10 rounded-full text-xs font-semibold">
            <button
              type="button"
              id="nav-tab-standard"
              onClick={() => setViewMode("standard")}
              className={`px-4 py-2 rounded-full transition flex items-center gap-2 ${
                viewMode === "standard"
                  ? "bg-blue-600/30 border border-blue-400/30 text-white shadow-lg shadow-blue-900/20"
                  : "text-slate-300 hover:text-white hover:bg-white/5"
              }`}
            >
              <Languages className="w-3.5 h-3.5 text-blue-400" />
              <span>{t.liveClassTab}</span>
            </button>
            <button
              type="button"
              id="nav-tab-transcript"
              onClick={() => setViewMode("transcript")}
              className={`px-4 py-2 rounded-full transition flex items-center gap-2 ${
                viewMode === "transcript"
                  ? "bg-blue-600/30 border border-blue-400/30 text-white shadow-lg shadow-blue-900/20"
                  : "text-slate-300 hover:text-white hover:bg-white/5"
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-indigo-400" />
              <span>{t.transcriptTab} ({transcript.length})</span>
            </button>
          </div>

          {/* Right Action Controls: UI Language, Students pill, Subtitles Language, Share, Role */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* App UI Interface Language Dropdown */}
            <div
              className="flex items-center gap-1.5 bg-blue-500/10 hover:bg-blue-500/20 backdrop-blur-md border border-blue-400/30 rounded-full px-3 py-1.5 transition"
              title="Cambiar idioma de toda la interfaz / Change app UI language"
            >
              <Globe className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
              <span className="text-[10px] font-mono text-blue-300 uppercase hidden xl:inline">
                {t.uiLanguageLabel}:
              </span>
              <select
                id="header-ui-language-select"
                value={uiLanguage}
                onChange={(e) => handleUpdateUiLanguage(e.target.value as UILanguage)}
                className="text-xs font-semibold bg-transparent text-white outline-none cursor-pointer"
              >
                {SUPPORTED_UI_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code} className="bg-slate-900 text-white">
                    {lang.flag} {lang.nativeName}
                  </option>
                ))}
              </select>
            </div>

            {/* Live Students Badge */}
            <div className="hidden lg:flex bg-white/5 backdrop-blur-md border border-white/10 rounded-full px-3.5 py-1.5 items-center gap-2.5 select-none">
              <div className="flex -space-x-1.5">
                <div className="w-5 h-5 rounded-full bg-orange-400 border border-[#020617]" />
                <div className="w-5 h-5 rounded-full bg-emerald-400 border border-[#020617]" />
                <div className="w-5 h-5 rounded-full bg-blue-500 border border-[#020617] text-[9px] flex items-center justify-center font-bold text-white">
                  +{connectedStudents > 2 ? connectedStudents - 2 : "22"}
                </div>
              </div>
              <span className="text-xs font-medium text-slate-300">{t.studentsLive}</span>
            </div>

            {/* Quick Output Subtitle Language Dropdown */}
            <div className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 backdrop-blur-md border border-white/10 rounded-full px-3 py-1.5 transition">
              <span className="text-[10px] font-mono text-slate-400 uppercase hidden sm:inline">
                {t.subtitlesLabel}:
              </span>
              <select
                id="header-language-select"
                value={settings.targetLanguage}
                onChange={(e) => handleUpdateSettings({ targetLanguage: e.target.value })}
                className="text-xs font-semibold bg-transparent text-white outline-none cursor-pointer max-w-[120px] sm:max-w-none truncate"
                title="Translate captions into this output language"
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.name} value={lang.name} className="bg-slate-900 text-white">
                    {lang.flag} {lang.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Share Link Button */}
            <button
              type="button"
              id="open-share-modal-btn"
              onClick={() => setIsShareModalOpen(true)}
              className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs font-semibold shadow-lg shadow-blue-900/30 border border-blue-400/20 transition active:scale-95"
              title="Share classroom link and QR Code with students"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.shareLink}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Tab Bar (Frosted Glass) */}
      <div className="md:hidden flex items-center justify-around bg-[#020617]/80 backdrop-blur-xl border-b border-white/10 px-2 py-2 text-xs font-medium z-30">
        <button
          type="button"
          onClick={() => setViewMode("standard")}
          className={`flex-1 py-1.5 text-center rounded-full transition ${
            viewMode === "standard"
              ? "bg-blue-600/30 border border-blue-400/30 text-white font-bold shadow-sm"
              : "text-slate-400"
          }`}
        >
          {t.liveClassTab}
        </button>
        <button
          type="button"
          onClick={() => setViewMode("transcript")}
          className={`flex-1 py-1.5 text-center rounded-full transition ${
            viewMode === "transcript"
              ? "bg-blue-600/30 border border-blue-400/30 text-white font-bold shadow-sm"
              : "text-slate-400"
          }`}
        >
          {t.transcriptTab} ({transcript.length})
        </button>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Error Alert (e.g. mic permission) */}
        {micError && (
          <div className="p-4 bg-red-500/10 backdrop-blur-xl border border-red-500/30 text-red-200 rounded-2xl text-xs flex items-center justify-between">
            <span>{micError}</span>
            <button
              type="button"
              onClick={() => startRecording()}
              className="px-3.5 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold shadow-md transition"
            >
              Retry
            </button>
          </div>
        )}

        {/* VIEW 1: Standard Classroom View */}
        {viewMode === "standard" && (
          <div className="space-y-6">
            {/* Control Bar: Microphone Controls and Topic Selector */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 sm:p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              {/* Left: Interactive Mic & Language Controls */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  id="mic-toggle-btn"
                  onClick={toggleRecording}
                  className={`inline-flex items-center gap-2.5 px-6 py-3 rounded-xl font-bold text-sm tracking-wide transition-all shadow-lg active:scale-95 ${
                    isRecording
                      ? "bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 ring-2 ring-red-500/30 animate-pulse"
                      : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/30 border border-blue-400/20"
                  }`}
                >
                  {isRecording ? <Mic className="w-5 h-5 text-red-400" /> : <MicOff className="w-5 h-5" />}
                  <span>{isRecording ? t.endSession : t.startMic}</span>
                </button>

                {/* Microphone Input Spoken Language Selector */}
                <div
                  className="flex items-center gap-2 text-xs bg-white/5 border border-white/10 px-3.5 py-2 rounded-xl text-slate-200"
                  title="Select the language you are speaking into the microphone, or leave on Auto-detect"
                >
                  <Languages className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-[9px] uppercase font-mono text-emerald-400 font-bold tracking-wider leading-none mb-0.5">
                      {t.micInLabel}
                    </span>
                    <select
                      id="mic-input-language-select"
                      value={settings.inputLanguage || "auto"}
                      onChange={(e) => handleUpdateSettings({ inputLanguage: e.target.value })}
                      className="bg-transparent font-medium outline-none cursor-pointer text-white truncate max-w-[150px] text-xs"
                    >
                      {SUPPORTED_INPUT_LANGUAGES.map((lang) => (
                        <option key={lang.code} value={lang.code} className="bg-slate-900 text-white">
                          {lang.flag} {lang.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Audio visualizer level meter */}
                {isRecording && (
                  <div className="flex items-center gap-2.5 bg-white/5 border border-white/10 backdrop-blur-md px-3.5 py-2.5 rounded-xl text-xs">
                    <Volume2 className="w-4 h-4 text-emerald-400 animate-pulse" />
                    <div className="w-24 h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-400 transition-all duration-75 rounded-full"
                        style={{ width: `${Math.min(100, audioLevel * 1.5)}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-emerald-300 tracking-wider">LIVE</span>
                  </div>
                )}

                {/* Test Physics Speech button */}
                <button
                  type="button"
                  id="test-speech-btn"
                  disabled={isProcessingAudio}
                  onClick={handleSendTestPhysicsSpeech}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-semibold text-slate-200 transition disabled:opacity-50"
                  title="Simulate speaking an 8th-grade physics concept"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>{t.sampleSpeech}</span>
                </button>
              </div>

              {/* Right: Physics Topic Selector */}
              <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
                <div className="flex items-center gap-2 text-xs bg-white/5 border border-white/10 px-3.5 py-2.5 rounded-xl text-slate-200 w-full md:w-auto">
                  <Atom className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  <span className="text-[10px] uppercase font-mono text-slate-400 tracking-wider">{t.topicLabel}:</span>
                  <select
                    id="physics-topic-select"
                    value={currentTopic}
                    onChange={(e) => {
                      setCurrentTopic(e.target.value);
                      fetch(`/api/session/${encodeURIComponent(roomId)}/meta`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ activeTopic: e.target.value }),
                      }).catch(() => {});
                    }}
                    className="bg-transparent font-medium outline-none cursor-pointer text-white truncate max-w-[200px]"
                  >
                    {PHYSICS_TOPICS.map((topic) => (
                      <option key={topic} value={topic} className="bg-slate-900 text-white">
                        {topic}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Informative Mic Input Language Status Banner */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 px-4 sm:px-5 py-3 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 text-xs shadow-md">
              <div className="flex items-center gap-2.5">
                {settings.inputLanguage === "auto" ? (
                  <>
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                    <span className="text-slate-200">
                      <strong className="text-emerald-300 font-mono">{t.autoDetectTitle}:</strong> {t.autoDetectDesc}
                    </span>
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                    <span className="text-slate-200">
                      <strong className="text-blue-300 font-mono">{t.fixedInputTitle}:</strong>{" "}
                      <strong className="text-white">
                        {SUPPORTED_INPUT_LANGUAGES.find((l) => l.code === settings.inputLanguage)?.name || settings.inputLanguage}
                      </strong>
                      .
                    </span>
                  </>
                )}
              </div>
              <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5 flex-shrink-0">
                <span>{t.translatingTo}:</span>
                <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-200 border border-blue-400/30 font-semibold">
                  {settings.targetLanguage}
                </span>
              </div>
            </div>

            {/* Live Caption Hero Card with Deep Frosted Glass Backdrop */}
            <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[32px] p-8 md:p-12 flex flex-col items-center justify-center relative shadow-2xl overflow-hidden min-h-[340px]">
              {/* Subtle top indicator bar */}
              <div className="w-full flex items-center justify-between border-b border-white/10 pb-4 mb-6">
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-[10px] uppercase font-bold tracking-widest text-slate-300/80 font-mono">
                    {latestSegment?.detectedLanguage || "English"} → {settings.targetLanguage}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-400">
                  {isProcessingAudio && (
                    <span className="flex items-center gap-1.5 text-blue-400 font-medium animate-pulse font-mono text-[11px]">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      {t.processingAudio}
                    </span>
                  )}
                  {latestSegment && (
                    <span className="font-mono text-[10px] text-slate-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded">
                      {new Date(latestSegment.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </span>
                  )}
                </div>
              </div>

              {/* Main Subtitle Display */}
              <div className="w-full flex-grow flex flex-col justify-center items-center py-4 space-y-6 text-center">
                {currentTranslation ? (
                  <p
                    dir={isRtl ? "rtl" : "ltr"}
                    className={`text-3xl sm:text-4xl md:text-5xl font-medium text-white/95 leading-relaxed tracking-tight max-w-4xl ${
                      isRtl ? "text-right" : "text-center"
                    }`}
                  >
                    "{currentTranslation}"
                  </p>
                ) : speechPreview ? (
                  <p className="text-2xl sm:text-3xl font-medium text-slate-400 italic animate-pulse max-w-3xl">
                    "{speechPreview}"...
                  </p>
                ) : (
                  <div className="text-lg sm:text-xl text-slate-400 italic font-normal py-6 max-w-2xl text-center">
                    {t.teacherInstruction}
                  </div>
                )}

                {/* Original verbatim English speech */}
                {settings.bilingual && latestSegment?.originalText && (
                  <p className="text-xl sm:text-2xl text-center italic text-slate-400 max-w-3xl font-light">
                    "{latestSegment.originalText}"
                  </p>
                )}
              </div>

              {/* Physics Concept Chips (if mentioned) */}
              {latestSegment?.physicsTerms && latestSegment.physicsTerms.length > 0 && (
                <div className="w-full mt-6 pt-4 border-t border-white/10 flex flex-wrap items-center justify-center gap-2">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-amber-400 flex items-center gap-1 mr-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    {t.keyPhysicsConcepts}:
                  </span>
                  {latestSegment.physicsTerms.map((term, idx) => (
                    <PhysicsTermCard
                      key={idx}
                      term={term}
                      targetLanguageName={settings.targetLanguage}
                      t={t}
                    />
                  ))}
                </div>
              )}

              {/* Bottom STT indicator badge */}
              <div className="w-full mt-4 pt-3 flex items-center justify-between text-[10px] font-mono text-slate-500 border-t border-white/5 select-none">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  <span>{t.acousticAdaptation}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>{t.sttConfidence}</span>
                </div>
              </div>
            </div>

            {/* Recent Classroom Speech History Feed */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <h3 className="font-semibold text-sm uppercase tracking-widest text-slate-300 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-400" />
                  {t.recentSpeechTitle} ({transcript.length})
                </h3>
                <button
                  type="button"
                  id="view-all-transcript-btn"
                  onClick={() => setViewMode("transcript")}
                  className="text-xs text-blue-300 hover:text-blue-200 font-mono tracking-wide hover:underline"
                >
                  {t.fullTranscriptTitle} →
                </button>
              </div>

              {transcript.length === 0 ? (
                <div className="text-xs text-slate-400 text-center py-8">
                  {t.noCaptionsYet}
                </div>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                  {transcript
                    .slice(-6)
                    .reverse()
                    .map((item, idx) => {
                      const trans =
                        item.translations[settings.targetLanguage] ||
                        Object.values(item.translations)[0] ||
                        item.originalText;
                      return (
                        <div
                          key={item.id || idx}
                          className={`p-4 rounded-2xl border text-xs space-y-1.5 transition ${
                            idx === 0
                              ? "bg-blue-500/10 border-blue-500/20 text-blue-100 shadow-md shadow-blue-900/10"
                              : "bg-white/5 border-white/10 text-slate-200 border-l-2 border-l-orange-500/60"
                          }`}
                        >
                          <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                            <span>
                              {new Date(item.timestamp).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            <span className="text-blue-300 uppercase tracking-wider">
                              {settings.targetLanguage}
                            </span>
                          </div>
                          <div
                            dir={isRtl ? "rtl" : "ltr"}
                            className={`font-medium text-sm text-white leading-relaxed ${
                              isRtl ? "text-right" : "text-left"
                            }`}
                          >
                            {trans}
                          </div>
                          {item.originalText && item.originalText !== trans && (
                            <div className="text-slate-400 italic text-[11px]">
                              "{item.originalText}"
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* VIEW 2: Dedicated Session Transcript View */}
        {viewMode === "transcript" && (
          <SessionTranscript
            transcript={transcript}
            targetLanguage={settings.targetLanguage}
            onSelectLanguage={(lang) => handleUpdateSettings({ targetLanguage: lang })}
            onClearTranscript={() => setTranscript([])}
            topic={currentTopic}
            t={t}
          />
        )}
      </main>

      {/* Share Modal with QR code and copyable session link */}
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        roomId={roomId}
        currentLanguage={settings.targetLanguage}
        uiLanguage={uiLanguage}
        t={t}
      />
    </div>
  );
}
