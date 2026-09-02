import React, { useState } from "react";
import { CaptionSegment, LanguageOption, SUPPORTED_LANGUAGES } from "../types";
import { TranslationDictionary } from "../i18n";
import { PhysicsTermCard } from "./PhysicsTermCard";
import {
  FileText,
  Download,
  Copy,
  Check,
  Search,
  Trash2,
  BookOpen,
  Sparkles,
  Loader2,
  Clock,
  Languages,
  Filter,
} from "lucide-react";

interface SessionTranscriptProps {
  transcript: CaptionSegment[];
  targetLanguage: string;
  onSelectLanguage: (lang: string) => void;
  onClearTranscript: () => void;
  topic?: string;
  t?: TranslationDictionary;
}

export const SessionTranscript: React.FC<SessionTranscriptProps> = ({
  transcript,
  targetLanguage,
  onSelectLanguage,
  onClearTranscript,
  topic = "8th-Grade Physics",
  t,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [generatingStudyGuide, setGeneratingStudyGuide] = useState(false);
  const [studyGuide, setStudyGuide] = useState<string | null>(null);

  // Filter segments
  const filteredSegments = transcript.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const orig = item.originalText.toLowerCase();
    const trans = (item.translations[targetLanguage] || "").toLowerCase();
    const terms = (item.physicsTerms || []).some(
      (termItem) =>
        termItem.term.toLowerCase().includes(q) ||
        termItem.definition.toLowerCase().includes(q)
    );
    return orig.includes(q) || trans.includes(q) || terms;
  });

  // Extract all unique physics terms from entire transcript
  const allPhysicsTerms = React.useMemo(() => {
    const map = new Map<string, any>();
    transcript.forEach((seg) => {
      (seg.physicsTerms || []).forEach((termItem) => {
        if (!map.has(termItem.term.toLowerCase())) {
          map.set(termItem.term.toLowerCase(), termItem);
        }
      });
    });
    return Array.from(map.values());
  }, [transcript]);

  // Copy full transcript text
  const handleCopyTranscript = async () => {
    if (transcript.length === 0) return;
    const textLines = transcript.map((s) => {
      const time = new Date(s.timestamp).toLocaleTimeString();
      const trans = s.translations[targetLanguage] || s.originalText;
      return `[${time}] (Spoken): ${s.originalText}\n[${targetLanguage}]: ${trans}\n`;
    });
    const fullText = `8th-Grade Physics Class Transcript - Topic: ${topic}\nDate: ${new Date().toLocaleDateString()}\n\n${textLines.join(
      "\n"
    )}`;

    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(true);
    }
  };

  // Download transcript as text file
  const handleDownload = () => {
    if (transcript.length === 0) return;
    const textLines = transcript.map((s) => {
      const time = new Date(s.timestamp).toLocaleTimeString();
      const trans = s.translations[targetLanguage] || s.originalText;
      let terms = "";
      if (s.physicsTerms && s.physicsTerms.length > 0) {
        terms = `\n  * Physics Terms: ${s.physicsTerms
          .map((termItem) => `${termItem.term} (${termItem.definition})`)
          .join("; ")}`;
      }
      return `[${time}] Spoken: "${s.originalText}"\n${targetLanguage}: "${trans}"${terms}\n`;
    });

    const fileContent = `# 8th-Grade Physics Classroom Transcript
Topic: ${topic}
Generated: ${new Date().toLocaleString()}
Target Language: ${targetLanguage}
Total Spoken Segments: ${transcript.length}

=======================================================
${textLines.join("\n")}
=======================================================

Key Physics Vocabulary Mentioned:
${allPhysicsTerms.map((termItem) => `- ${termItem.term}: ${termItem.definition}`).join("\n")}
`;

    const blob = new Blob([fileContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `physics-class-transcript-${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Generate 8th-grade study guide using Gemini
  const handleGenerateStudyGuide = async () => {
    if (transcript.length === 0) return;
    setGeneratingStudyGuide(true);
    try {
      const res = await fetch("/api/summarize-transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: transcript.slice(-40),
          targetLanguage,
        }),
      });
      const data = await res.json();
      if (data.summary) {
        setStudyGuide(data.summary);
      }
    } catch (err) {
      console.error("Failed to generate study guide:", err);
    } finally {
      setGeneratingStudyGuide(false);
    }
  };

  return (
    <div id="session-transcript-view" className="space-y-6 max-w-6xl mx-auto">
      {/* Top Action Bar */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-5 md:p-7 rounded-3xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-blue-500/20 border border-blue-400/30 text-blue-300">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                {t?.fullTranscriptTitle || "Full Session Transcript"}
              </h2>
              <p className="text-xs text-slate-400">
                {transcript.length} {t?.transcriptMeta || "speech segments recorded • Topic:"} {topic}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Target Language Selector */}
          <div className="flex items-center gap-1.5 bg-white/10 border border-white/10 px-3 py-2 rounded-xl text-xs font-medium text-slate-200">
            <Languages className="w-3.5 h-3.5 text-slate-300" />
            <select
              id="transcript-language-select"
              value={targetLanguage}
              onChange={(e) => onSelectLanguage(e.target.value)}
              className="bg-transparent font-semibold outline-none cursor-pointer text-white"
            >
              {SUPPORTED_LANGUAGES.map((l) => (
                <option key={l.name} value={l.name} className="bg-slate-900 text-white">
                  {l.flag} {l.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            id="copy-transcript-btn"
            onClick={handleCopyTranscript}
            disabled={transcript.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 rounded-xl text-xs font-semibold transition disabled:opacity-40"
            title="Copy all transcript lines"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? (t?.copied || "Copied!") : (t?.copy || "Copy")}</span>
          </button>

          <button
            type="button"
            id="download-transcript-btn"
            onClick={handleDownload}
            disabled={transcript.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 rounded-xl text-xs font-semibold transition disabled:opacity-40"
            title="Download notes as text file"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t?.downloadTxt || "Download .TXT"}</span>
          </button>

          <button
            type="button"
            id="generate-study-guide-btn"
            onClick={handleGenerateStudyGuide}
            disabled={transcript.length === 0 || generatingStudyGuide}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/40 text-blue-200 rounded-xl text-xs font-semibold transition shadow-lg shadow-blue-900/20 disabled:opacity-50"
          >
            {generatingStudyGuide ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span>{t?.aiStudyGuide || "AI Study Guide"}</span>
          </button>

          {transcript.length > 0 && (
            <button
              type="button"
              id="clear-transcript-btn"
              onClick={onClearTranscript}
              className="p-2 text-slate-400 hover:text-red-300 hover:bg-red-500/20 rounded-xl transition border border-transparent hover:border-red-500/30"
              title="Clear transcript"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Physics Concept Glossary Section (if terms exist) */}
      {allPhysicsTerms.length > 0 && (
        <div className="bg-amber-500/10 backdrop-blur-xl border border-amber-400/20 rounded-3xl p-5 shadow-xl">
          <div className="flex items-center gap-2 mb-3.5">
            <BookOpen className="w-4 h-4 text-amber-400" />
            <h3 className="font-semibold text-xs uppercase tracking-widest text-amber-200">
              {t?.physicsGlossaryTitle.replace("{count}", String(allPhysicsTerms.length)) ||
                `Physics Vocabulary Mentioned in this Session (${allPhysicsTerms.length})`}
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {allPhysicsTerms.map((termItem, i) => (
              <PhysicsTermCard
                key={i}
                term={termItem}
                targetLanguageName={targetLanguage}
                t={t}
              />
            ))}
          </div>
        </div>
      )}

      {/* AI Generated Study Guide Display */}
      {studyGuide && (
        <div className="bg-indigo-950/40 backdrop-blur-2xl border border-indigo-400/30 rounded-3xl p-6 shadow-2xl space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-indigo-300 font-bold text-sm">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>{t?.studyGuideModalTitle || "8th-Grade Physics Lesson Study Guide"}</span>
            </div>
            <button
              type="button"
              onClick={() => setStudyGuide(null)}
              className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded-lg bg-white/5 border border-white/10"
            >
              {t?.close || "Close"}
            </button>
          </div>
          <div className="text-xs md:text-sm text-slate-200 leading-relaxed whitespace-pre-wrap font-sans bg-white/5 backdrop-blur-md p-5 rounded-2xl border border-white/10 shadow-inner">
            {studyGuide}
          </div>
        </div>
      )}

      {/* Search Input Filter */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          id="transcript-search-input"
          placeholder={t?.searchPlaceholder || "Search spoken transcript by keyword (e.g. 'gravity', 'inertia', 'energy')..."}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-11 pr-12 py-3 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl text-sm text-white placeholder-slate-400 outline-none focus:border-blue-400/50 shadow-lg transition"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
          >
            {t?.clear || "Clear"}
          </button>
        )}
      </div>

      {/* Transcript Segments List */}
      <div className="space-y-3">
        {filteredSegments.length === 0 ? (
          <div className="text-center py-16 bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-8 shadow-xl">
            <FileText className="w-10 h-10 text-slate-500 mx-auto mb-3" />
            <h4 className="font-semibold text-white text-sm">
              {transcript.length === 0
                ? (t?.noCaptionsYet || "No spoken captions in this session yet.")
                : "No matching transcript segments found."}
            </h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {transcript.length === 0
                ? (t?.startMicInstruction || "Start the microphone in the classroom view to begin transcribing physics lectures in real time.")
                : "Try searching for a different physics term or clearing the search."}
            </p>
          </div>
        ) : (
          filteredSegments.map((segment, index) => {
            const timeStr = new Date(segment.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            });
            const transText =
              segment.translations[targetLanguage] ||
              Object.values(segment.translations)[0] ||
              segment.originalText;

            const isRtl = ["Hebrew", "Arabic", "Urdu", "Persian / Farsi"].includes(
              targetLanguage
            );

            return (
              <div
                key={segment.id || index}
                className="bg-white/5 backdrop-blur-xl p-5 md:p-6 rounded-2xl border border-white/10 shadow-lg hover:border-blue-400/30 transition group"
              >
                {/* Header row: timestamp & language badge */}
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2.5">
                  <div className="flex items-center gap-2 font-mono">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-slate-300">{timeStr}</span>
                    <span className="text-slate-600">•</span>
                    <span className="text-slate-400 font-sans text-[11px]">
                      Detected: {segment.detectedLanguage || "English"}
                    </span>
                  </div>

                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-blue-500/20 text-blue-200 border border-blue-400/30 uppercase tracking-wider">
                    {targetLanguage}
                  </span>
                </div>

                {/* Primary: Translated Subtitle in chosen language */}
                <div
                  dir={isRtl ? "rtl" : "ltr"}
                  className={`text-base md:text-lg font-medium text-white leading-relaxed mb-2.5 ${
                    isRtl ? "text-right" : "text-left"
                  }`}
                >
                  {transText}
                </div>

                {/* Secondary: Original spoken English verbatim */}
                {segment.originalText && segment.originalText !== transText && (
                  <div className="text-xs md:text-sm text-slate-300/80 italic bg-white/5 p-3 rounded-xl border border-white/10 mb-2">
                    <span className="font-semibold text-slate-300 not-italic mr-1.5 text-[10px] font-mono uppercase tracking-wider">
                      {t?.teacherSpoke || "Teacher Spoke"}:
                    </span>
                    "{segment.originalText}"
                  </div>
                )}

                {/* Physics Vocabulary Chips */}
                {segment.physicsTerms && segment.physicsTerms.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] font-mono text-amber-400 uppercase tracking-wider font-semibold mr-1">
                      {t?.vocabulary || "Vocabulary"}:
                    </span>
                    {segment.physicsTerms.map((termItem, tIdx) => (
                      <PhysicsTermCard
                        key={tIdx}
                        term={termItem}
                        targetLanguageName={targetLanguage}
                        t={t}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
