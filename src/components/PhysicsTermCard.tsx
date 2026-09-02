import React, { useState } from "react";
import { PhysicsTerm } from "../types";
import { TranslationDictionary } from "../i18n";
import { Sparkles, X, BookOpen } from "lucide-react";

interface PhysicsTermCardProps {
  term: PhysicsTerm;
  targetLanguageName?: string;
  compact?: boolean;
  t?: TranslationDictionary;
}

export const PhysicsTermCard: React.FC<PhysicsTermCardProps> = ({
  term,
  targetLanguageName,
  compact = false,
  t,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative inline-block my-0.5 mx-1">
      <button
        type="button"
        id={`term-btn-${term.term.replace(/\s+/g, "-").toLowerCase()}`}
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition-all border ${
          compact
            ? "bg-amber-500/20 text-amber-300 border-amber-400/30 hover:bg-amber-500/30"
            : "bg-amber-500/15 text-amber-200 border-amber-400/30 hover:bg-amber-500/25 shadow-sm"
        }`}
        title={t?.termCardTooltip || "Click to view 8th-grade physics definition"}
      >
        <Sparkles className="w-3 h-3 text-amber-400 flex-shrink-0" />
        <span>{term.term}</span>
        {term.translatedTerm && term.translatedTerm.toLowerCase() !== term.term.toLowerCase() && (
          <span className="opacity-80 font-normal italic">({term.translatedTerm})</span>
        )}
      </button>

      {isOpen && (
        <div
          id={`term-popover-${term.term.replace(/\s+/g, "-").toLowerCase()}`}
          className="absolute z-50 bottom-full mb-2 left-0 w-72 p-3.5 bg-slate-950/85 backdrop-blur-2xl text-slate-100 rounded-2xl shadow-2xl border border-white/15 text-xs animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex items-start justify-between gap-2 border-b border-white/10 pb-2 mb-2.5">
            <div className="flex items-center gap-1.5 font-bold text-amber-400 text-sm">
              <BookOpen className="w-4 h-4" />
              <span>{term.term}</span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {term.translatedTerm && (
            <div className="text-slate-300 mb-2 font-medium">
              <span className="text-slate-400 font-mono text-[11px] uppercase">
                {targetLanguageName || t?.translationLabel || "Translation"}:{" "}
              </span>
              <span className="text-emerald-300">{term.translatedTerm}</span>
            </div>
          )}

          <div className="text-slate-200 leading-relaxed bg-white/5 backdrop-blur-md p-2.5 rounded-xl border border-white/10">
            <span className="text-slate-400 block text-[10px] uppercase font-mono font-bold tracking-wider mb-1">
              {t?.physicsDefinitionLabel || "8th-Grade Physics Definition"}
            </span>
            {term.definition}
          </div>
        </div>
      )}
    </div>
  );
};
