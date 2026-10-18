import React, { useState } from 'react';
import { HistoryItem } from '../types.js';
import { History as HistoryIcon, Search, Trash2, ArrowRight, Sparkles, Copy, Check, FileText } from 'lucide-react';

interface HistoryWorkspaceProps {
  items: HistoryItem[];
  onOpenHistoryItem: (item: HistoryItem) => void;
  onDeleteHistoryItem: (id: string) => void;
}

export const HistoryWorkspace: React.FC<HistoryWorkspaceProps> = ({
  items,
  onOpenHistoryItem,
  onDeleteHistoryItem,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'level1' | 'level2' | 'prompt'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.topic.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || item.type === filterType;
    return matchesSearch && matchesType;
  });

  const handleCopyPrompt = (e: React.MouseEvent, promptText: string, id: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(promptText);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-5">
      {/* Search & Filter Header */}
      <div className="bg-white rounded-2xl border border-[#F1DDE2] p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#FFE8EE] text-[#FE4C6F] rounded-xl font-bold">
              <HistoryIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-[#1F1720]">
                Riwayat Arsitektur & Prompt
              </h3>
              <p className="text-xs text-[#6F6670]">
                Riwayat tersimpan di browser ini. Rekam jejak penelitian Level 1, Level 2, dan AI Prompt yang telah dihasilkan.
              </p>
            </div>
          </div>

          <span className="text-xs font-bold text-[#FE4C6F] bg-[#FFE8EE] px-3 py-1 rounded-full">
            Total: {items.length} Item
          </span>
        </div>

        {/* Search Bar & Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-[#6F6670]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari berdasarkan topik atau judul..."
              className="w-full pl-10 pr-4 py-2 bg-[#FFF9FA] border border-[#F1DDE2] rounded-xl text-xs focus:outline-hidden focus:border-[#FE4C6F] text-[#1F1720]"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto">
            {(['all', 'level1', 'level2', 'prompt'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold capitalize transition-colors flex-shrink-0 ${
                  filterType === type
                    ? 'bg-[#FE4C6F] text-white'
                    : 'bg-[#FFF9FA] text-[#6F6670] border border-[#F1DDE2] hover:bg-[#FFE8EE]'
                }`}
              >
                {type === 'all' ? 'Semua' : type}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* History Items Grid */}
      {filteredItems.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#F1DDE2] p-12 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 bg-[#FFF9FA] border border-[#F1DDE2] text-[#6F6670] rounded-2xl flex items-center justify-center mx-auto">
            <FileText className="w-6 h-6" />
          </div>
          <h4 className="font-bold text-sm text-[#1F1720]">Belum Ada Riwayat</h4>
          <p className="text-xs text-[#6F6670]">
            Hasil generate arsitektur dan prompt yang Anda simpan akan otomatis muncul di sini.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => {
            const formattedDate = new Date(item.createdAt).toLocaleDateString('id-ID', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={item.id}
                onClick={() => onOpenHistoryItem(item)}
                className="bg-white rounded-2xl border border-[#F1DDE2] hover:border-[#FE4C6F] p-4 shadow-xs transition-all flex flex-col justify-between cursor-pointer group"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        item.type === 'level1'
                          ? 'bg-blue-100 text-blue-800'
                          : item.type === 'level2'
                          ? 'bg-indigo-100 text-indigo-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {item.type}
                    </span>
                    <span className="text-[11px] text-[#6F6670]">{formattedDate}</span>
                  </div>

                  <h4 className="font-bold text-sm text-[#1F1720] group-hover:text-[#FE4C6F] transition-colors line-clamp-2">
                    {item.title}
                  </h4>

                  <p className="text-xs text-[#6F6670]">Topik: {item.topic}</p>

                  {item.level1Data && (
                    <div className="text-[11px] text-[#6F6670] pt-2 border-t border-[#F1DDE2]/60">
                      {item.level1Data.siloPages.length} Halaman SILO • {item.level1Data.clusters.length} Clusters
                    </div>
                  )}

                  {item.level2Data && (
                    <div className="text-[11px] text-[#6F6670] pt-2 border-t border-[#F1DDE2]/60">
                      {item.level2Data.sections.length} Seksi Artikel • Role: {item.level2Data.selectedPageRole}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-[#F1DDE2]/60 mt-3 flex items-center justify-between gap-2">
                  {item.promptResult ? (
                    <button
                      onClick={(e) => handleCopyPrompt(e, item.promptResult!.promptText, item.id)}
                      className="px-2.5 py-1 bg-[#FFE8EE] text-[#E83E60] hover:bg-pink-200 text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors"
                    >
                      {copiedId === item.id ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Tersalin</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Salin Prompt</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <span className="text-[11px] text-[#6F6670] flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-[#FE4C6F]" /> Buka Snapshot
                    </span>
                  )}

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteHistoryItem(item.id);
                    }}
                    className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Hapus Riwayat"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
