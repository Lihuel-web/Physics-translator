import React, { useState, useEffect } from "react";
import QRCode from "qrcode";
import { X, Copy, Check, QrCode, ExternalLink, Globe, Users } from "lucide-react";
import { SUPPORTED_LANGUAGES } from "../types";
import { TranslationDictionary } from "../i18n";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  currentLanguage: string;
  uiLanguage?: string;
  t?: TranslationDictionary;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  roomId,
  currentLanguage,
  uiLanguage = "es",
  t,
}) => {
  const [selectedLang, setSelectedLang] = useState(currentLanguage);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);

  // Construct direct session link (everyone gets full interactive access with mic and language controls)
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const shareUrl = `${origin}/?room=${encodeURIComponent(roomId)}&lang=${encodeURIComponent(
    selectedLang
  )}&uiLang=${encodeURIComponent(uiLanguage)}`;

  useEffect(() => {
    if (isOpen) {
      QRCode.toDataURL(shareUrl, {
        width: 260,
        margin: 1.5,
        color: {
          dark: "#0f172a",
          light: "#ffffff",
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error("QR Code generation error:", err));
    }
  }, [isOpen, shareUrl]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(true);
    }
  };

  return (
    <div
      id="share-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        id="share-modal-container"
        className="relative w-full max-w-md bg-slate-950/80 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/15 overflow-hidden text-white animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-blue-500/20 border border-blue-400/30 text-blue-300">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">
                {t?.shareTitle || "Share with Students"}
              </h3>
              <p className="text-xs text-slate-400">
                {t?.shareSubtitle || "8th-Grade Physics Live Captions"}
              </p>
            </div>
          </div>
          <button
            type="button"
            id="close-share-modal-btn"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Preset Language Selection */}
          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-2">
              {t?.presetLanguageLabel || "Preset Student Subtitle Language"}
            </label>
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <select
                id="share-lang-select"
                value={selectedLang}
                onChange={(e) => setSelectedLang(e.target.value)}
                className="w-full text-sm rounded-xl border border-white/15 bg-white/10 text-white px-3.5 py-2.5 font-medium focus:ring-1 focus:ring-blue-400 outline-none"
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.name} value={lang.name} className="bg-slate-900 text-white">
                    {lang.flag} {lang.name} ({lang.nativeName})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* QR Code Container */}
          <div className="flex flex-col items-center justify-center p-5 bg-white/5 rounded-2xl border border-white/10">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="Classroom QR Code"
                className="w-48 h-48 rounded-xl shadow-lg bg-white p-2.5"
              />
            ) : (
              <div className="w-48 h-48 flex items-center justify-center text-slate-400">
                {t?.generatingQr || "Generating QR code..."}
              </div>
            )}
            <p className="mt-3 text-xs font-medium text-slate-400 text-center">
              {t?.qrInstruction || "Students point camera or Chromebook to join automatically"}
            </p>
          </div>

          {/* Room ID Tag */}
          <div className="flex items-center justify-between px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs">
            <span className="text-slate-400 font-mono uppercase text-[11px]">
              {t?.classroomCodeLabel || "Classroom Room Code:"}
            </span>
            <span className="font-mono font-bold text-blue-300 uppercase tracking-widest text-sm">
              {roomId}
            </span>
          </div>

          {/* Copy Link Input Group */}
          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
              {t?.directLink || "Direct Student Link"}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                id="share-link-input"
                value={shareUrl}
                className="flex-1 text-xs bg-white/5 text-slate-200 px-3.5 py-2.5 rounded-xl border border-white/10 outline-none truncate font-mono select-all"
              />
              <button
                type="button"
                id="copy-share-link-btn"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition-all shadow-lg shadow-blue-900/30 active:scale-95 flex-shrink-0 border border-blue-400/20"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-300" />
                    <span>{t?.copied || "Copied!"}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>{t?.copy || "Copy"}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-white/5 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-slate-400" /> {t?.noSignIn || "No student sign-in required"}
          </span>
          <a
            href={shareUrl}
            target="_blank"
            rel="noreferrer"
            className="text-blue-300 hover:text-blue-200 hover:underline flex items-center gap-1 font-mono text-[11px]"
          >
            {t?.openNewTab || "Open in new tab"} <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
};
