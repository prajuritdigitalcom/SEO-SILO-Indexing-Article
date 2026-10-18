import React, { useState } from 'react';
import { GeneratedPromptResult, Level2Result } from '../types.js';
import { Copy, Download, Check, Sparkles, FileText, AlertCircle, X, ShieldCheck } from 'lucide-react';

interface PromptModalProps {
  level2Data: Level2Result;
  promptResult: GeneratedPromptResult;
  isOpen: boolean;
  onClose: () => void;
  isOutdated?: boolean;
  onRegenerate?: () => void;
}

export const PromptModal: React.FC<PromptModalProps> = ({
  level2Data,
  promptResult,
  isOpen,
  onClose,
  isOutdated = false,
  onRegenerate,
}) => {
  const [copiedType, setCopiedType] = useState<'prompt' | 'markdown' | null>(null);

  if (!isOpen) return null;

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(promptResult.promptText);
    setCopiedType('prompt');
    setTimeout(() => setCopiedType(null), 2500);
  };

  const handleCopyMarkdown = () => {
    const md = `\`\`\`markdown\n${promptResult.promptText}\n\`\`\``;
    navigator.clipboard.writeText(md);
    setCopiedType('markdown');
    setTimeout(() => setCopiedType(null), 2500);
  };

  const handleDownloadTxt = () => {
    const slug = level2Data.selectedPageTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const filename = `prompt-${slug}.txt`;
    const blob = new Blob([promptResult.promptText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl border border-[#F1DDE2] shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="p-5 border-b border-[#F1DDE2] bg-[#FFF9FA] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#FE4C6F] text-white rounded-xl">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg text-[#1F1720]">
                  Provider-Neutral AI Prompt Ready
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Google People-First Compliant
                </span>
              </div>
              <p className="text-xs text-[#6F6670] mt-0.5">
                Siap diganti/disalin ke Gemini, ChatGPT, Claude, DeepSeek, atau sistem AI lainnya.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-[#6F6670] hover:text-[#FE4C6F] hover:bg-[#FFE8EE] rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Outdated Notice Banner */}
        {isOutdated && (
          <div className="bg-amber-50 border-b border-amber-200 px-5 py-3 flex items-center justify-between text-xs text-amber-800">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>
                Pilihan komponen berubah. Prompt ini perlu diperbarui dengan menekan tombol regenerasi.
              </span>
            </div>
            {onRegenerate && (
              <button
                onClick={onRegenerate}
                className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg text-xs transition-colors"
              >
                Proses Ulang Prompt
              </button>
            )}
          </div>
        )}

        {/* Modal Body: Two Columns */}
        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 lg:grid-cols-3 gap-5 bg-[#FFF9FA]">
          {/* Left Column: Summary & Integrity Stats */}
          <div className="space-y-4">
            {/* Prompt Integrity Badge */}
            {(() => {
              const totalPossible = promptResult.includedCount + promptResult.missingCount;
              const completenessPct =
                totalPossible > 0
                  ? Math.round((promptResult.includedCount / totalPossible) * 100)
                  : 100;
              const hasMissing = promptResult.missingCount > 0;

              return (
                <div className="p-4 bg-white rounded-xl border border-[#F1DDE2] shadow-xs">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#6F6670] mb-3">
                    Prompt Integrity Check
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between py-1 border-b border-[#F1DDE2]/60">
                      <span className="text-[#6F6670]">Komponen Dipilih:</span>
                      <span className="font-bold text-[#1F1720]">
                        {promptResult.selectedComponentIdsCount} item
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-[#F1DDE2]/60">
                      <span className="text-[#6F6670]">Termasuk dalam Prompt:</span>
                      <span className="font-bold text-emerald-600">
                        {completenessPct}% ({promptResult.includedCount} bagian)
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-[#6F6670]">Komponen Dilewati:</span>
                      <span
                        className={`font-bold ${
                          hasMissing ? 'text-amber-600' : 'text-emerald-600'
                        }`}
                      >
                        {promptResult.missingCount}{' '}
                        {hasMissing ? 'bagian (opsional dimatikan)' : '(Lengkap & Presisi)'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Target Article Details */}
            <div className="p-4 bg-white rounded-xl border border-[#F1DDE2] shadow-xs space-y-2 text-xs">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#6F6670]">
                Target Artikel
              </h4>
              <div>
                <span className="text-[#6F6670]">Judul:</span>
                <p className="font-semibold text-[#1F1720] mt-0.5">{level2Data.selectedPageTitle}</p>
              </div>
              <div>
                <span className="text-[#6F6670]">Topik Macro:</span>
                <p className="font-medium text-[#1F1720] mt-0.5">{level2Data.topic}</p>
              </div>
              <div>
                <span className="text-[#6F6670]">Page Role:</span>
                <span className="ml-2 inline-block px-2 py-0.5 bg-[#FFE8EE] text-[#E83E60] font-semibold rounded-md text-[11px]">
                  {level2Data.selectedPageRole}
                </span>
              </div>
            </div>

            {/* Instructions */}
            <div className="p-4 bg-white rounded-xl border border-[#F1DDE2] text-xs text-[#6F6670] space-y-2">
              <h4 className="font-bold text-[#1F1720]">Cara Penggunaan:</h4>
              <ol className="list-decimal list-inside space-y-1 leading-relaxed">
                <li>Klik tombol <strong>Salin Prompt Utama</strong> di bawah.</li>
                <li>Tempelkan (Paste) langsung ke AI pilihan Anda (Gemini, ChatGPT, Claude, DeepSeek, dll).</li>
                <li>AI akan menghasilkan draf artikel berpenulisan natural dalam <strong>Semantic HTML</strong>.</li>
                <li>Salin keluaran HTML artikel tersebut lalu tempelkan langsung ke <strong>Blogger</strong> atau <strong>WordPress</strong>.</li>
              </ol>
            </div>
          </div>

          {/* Right Column: Prompt Code / Text Box */}
          <div className="lg:col-span-2 flex flex-col h-full bg-white rounded-xl border border-[#F1DDE2] overflow-hidden shadow-xs">
            <div className="p-3 bg-[#FFF9FA] border-b border-[#F1DDE2] flex items-center justify-between text-xs">
              <span className="font-mono text-[#6F6670] font-medium flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-[#FE4C6F]" />
                prompt-{level2Data.selectedPageTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.txt
              </span>
              <span className="text-[11px] text-[#6F6670]">
                {promptResult.promptText.length} Karakter
              </span>
            </div>

            <div className="flex-1 p-4 overflow-y-auto bg-slate-900 text-slate-100 font-mono text-xs leading-relaxed whitespace-pre-wrap select-all">
              {promptResult.promptText}
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 border-t border-[#F1DDE2] bg-white flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-[#6F6670]">
            Format: Provider-Neutral Plain Text / Markdown
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleDownloadTxt}
              className="px-3.5 py-2 rounded-xl border border-[#F1DDE2] hover:bg-[#FFF9FA] text-[#1F1720] text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-4 h-4 text-[#FE4C6F]" />
              <span>Unduh TXT</span>
            </button>

            <button
              onClick={handleCopyMarkdown}
              className="px-3.5 py-2 rounded-xl border border-[#F1DDE2] hover:bg-[#FFF9FA] text-[#1F1720] text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              {copiedType === 'markdown' ? (
                <Check className="w-4 h-4 text-emerald-600" />
              ) : (
                <Copy className="w-4 h-4 text-[#FE4C6F]" />
              )}
              <span>{copiedType === 'markdown' ? 'Tersalin (MD)!' : 'Salin Markdown'}</span>
            </button>

            <button
              onClick={handleCopyPrompt}
              className="px-4 py-2 bg-[#FE4C6F] hover:bg-[#E83E60] text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-2 transition-colors"
            >
              {copiedType === 'prompt' ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  <span>Prompt Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-white" />
                  <span>Salin Prompt Utama</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
