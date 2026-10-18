import React, { useState } from 'react';
import { ApiKeyItem, BulkVerificationSummary, KeyPoolStats, VerifyKeyResult } from '../types.ts';
import {
  Key,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Zap,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  XCircle,
  AlertTriangle,
  Layers,
} from 'lucide-react';

interface SettingsWorkspaceProps {
  visitorKeys: ApiKeyItem[];
  keyStats: KeyPoolStats | null;
  onAddKey: (
    key: string,
    onProgress?: (current: number, total: number, currentMasked: string) => void
  ) => Promise<BulkVerificationSummary>;
  onDeleteKey: (id: string) => Promise<void>;
  onTestKey: (keyId: string) => Promise<VerifyKeyResult>;
  onRefreshStats: () => void;
}

export const SettingsWorkspace: React.FC<SettingsWorkspaceProps> = ({
  visitorKeys,
  keyStats,
  onAddKey,
  onDeleteKey,
  onTestKey,
  onRefreshStats,
}) => {
  const [inputKey, setInputKey] = useState('');
  const [showRaw, setShowRaw] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
    currentMasked: string;
  } | null>(null);

  const [bulkResult, setBulkResult] = useState<BulkVerificationSummary | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; message: string; valid: boolean } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const parsedKeyLines = inputKey
    .split(/\r?\n/)
    .map((k) => k.trim())
    .filter((k) => k.length > 0);

  const parsedKeyCount = parsedKeyLines.length;

  const handleVerifyAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputKey.trim() || verifying) return;

    setVerifying(true);
    setProgress(null);
    setErrorMessage(null);
    setBulkResult(null);

    try {
      const summary = await onAddKey(inputKey.trim(), (current, total, currentMasked) => {
        setProgress({ current, total, currentMasked });
      });

      setBulkResult(summary);

      // Jika ada key yang berhasil disimpan dan tidak ada key invalid, bersihkan input
      if (summary.validCount > 0 || summary.rateLimitCount > 0) {
        if (summary.invalidCount === 0) {
          setInputKey('');
        }
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Gagal memverifikasi API Key.');
    } finally {
      setVerifying(false);
      setProgress(null);
    }
  };

  const handleTestKey = async (keyItem: ApiKeyItem) => {
    setTestingId(keyItem.id);
    setTestResult(null);
    try {
      const res = await onTestKey(keyItem.id);
      setTestResult({
        id: keyItem.id,
        valid: res.valid,
        message: res.message,
      });
      onRefreshStats();
    } catch (err: any) {
      setTestResult({
        id: keyItem.id,
        valid: false,
        message: err?.message || 'Gagal menguji key.',
      });
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title Card */}
      <div className="bg-white rounded-2xl border border-[#F1DDE2] p-5 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#FFE8EE] text-[#FE4C6F] rounded-xl font-bold">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-[#1F1720]">
              Gemini API Key Pool & Konfigurasi (Local Browser)
            </h3>
            <p className="text-xs text-[#6F6670]">
              Kelola API Keys secara lokal di browser dengan Client-Side Round Robin, Adaptive Cooldown, dan Automatic Failover.
            </p>
          </div>
        </div>

        <button
          onClick={onRefreshStats}
          className="p-2 text-[#6F6670] hover:text-[#FE4C6F] hover:bg-[#FFE8EE] rounded-xl transition-colors cursor-pointer"
          title="Refresh Status & Cooldowns"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Key Pool Stats Dashboard */}
      {keyStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white p-4 rounded-xl border border-[#F1DDE2] shadow-xs text-center">
            <span className="text-[11px] font-bold text-[#6F6670] block">Total Key Terverifikasi</span>
            <span className="text-2xl font-extrabold text-[#1F1720] mt-1 block">
              {keyStats.totalKeys}
            </span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-[#F1DDE2] shadow-xs text-center">
            <span className="text-[11px] font-bold text-emerald-600 block">Key Siap (Ready)</span>
            <span className="text-2xl font-extrabold text-emerald-600 mt-1 block">
              {keyStats.readyKeys}
            </span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-[#F1DDE2] shadow-xs text-center">
            <span className="text-[11px] font-bold text-amber-600 block">Cooldown Backoff</span>
            <span className="text-2xl font-extrabold text-amber-600 mt-1 block">
              {keyStats.cooldownKeys}
            </span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-[#F1DDE2] shadow-xs text-center">
            <span className="text-[11px] font-bold text-blue-600 block">System Fallback</span>
            <span className="text-xs font-bold text-blue-700 mt-2 block">
              {keyStats.hasSystemFallback ? 'Tersedia (Server)' : 'Tidak Ada'}
            </span>
          </div>
        </div>
      )}

      {/* Two Column Grid for Add Key & Verified Key List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Left Column: Add New Key Form with Live Verification */}
        <div className="bg-white rounded-2xl border border-[#F1DDE2] p-5 shadow-xs space-y-4 flex flex-col justify-between h-full">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm text-[#1F1720] flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#FE4C6F]" /> Tambah & Verifikasi Gemini API Key
              </h4>
              {parsedKeyCount > 0 && (
                <span className="px-2.5 py-0.5 bg-[#FFE8EE] text-[#E83E60] font-bold text-xs rounded-full">
                  {parsedKeyCount} Key Terdeteksi
                </span>
              )}
            </div>

            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Live Verification Progress Box */}
            {verifying && progress && (
              <div className="p-4 bg-[#FFF9FA] border border-[#FE4C6F]/30 rounded-xl space-y-2.5 animate-pulse">
                <div className="flex items-center justify-between text-xs font-bold text-[#1F1720]">
                  <span className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 border-2 border-[#FE4C6F] border-t-transparent rounded-full animate-spin" />
                    Memverifikasi API Key {progress.current} dari {progress.total}...
                  </span>
                  <span className="font-mono text-[#FE4C6F] text-[11px]">
                    {progress.currentMasked}
                  </span>
                </div>
                <div className="w-full bg-[#F1DDE2] h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-[#FE4C6F] h-full transition-all duration-300 rounded-full"
                    style={{
                      width: `${Math.round((progress.current / progress.total) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Verification Result Summary Card */}
            {bulkResult && (
              <div className="p-4 bg-[#FFF9FA] border border-[#F1DDE2] rounded-xl space-y-3">
                <div className="flex items-center justify-between border-b border-[#F1DDE2] pb-2.5">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span className="font-bold text-xs text-[#1F1720]">
                      Hasil Verifikasi ({bulkResult.totalProcessed} Key Diproses)
                    </span>
                  </div>
                  <button
                    onClick={() => setBulkResult(null)}
                    className="text-[11px] text-[#6F6670] hover:text-[#1F1720] underline cursor-pointer"
                  >
                    Tutup Ringkasan
                  </button>
                </div>

                {/* Quick Badges */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                  <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <span className="text-[10px] font-bold text-emerald-700 block">✓ Valid</span>
                    <span className="text-base font-extrabold text-emerald-800">{bulkResult.validCount}</span>
                  </div>
                  <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg">
                    <span className="text-[10px] font-bold text-amber-700 block">⏳ Kuota (429)</span>
                    <span className="text-base font-extrabold text-amber-800">{bulkResult.rateLimitCount}</span>
                  </div>
                  <div className="p-2 bg-sky-50 border border-sky-200 rounded-lg">
                    <span className="text-[10px] font-bold text-sky-700 block">↻ Update / Ada</span>
                    <span className="text-base font-extrabold text-sky-800">{bulkResult.alreadyExistingCount}</span>
                  </div>
                  <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg">
                    <span className="text-[10px] font-bold text-rose-700 block">✕ Ditolak</span>
                    <span className="text-base font-extrabold text-rose-800">{bulkResult.invalidCount}</span>
                  </div>
                </div>

                <div className="p-2.5 bg-white rounded-lg border border-[#F1DDE2] text-[11px] text-[#1F1720] leading-relaxed space-y-1">
                  <div>
                    <strong>Kesimpulan:</strong> {bulkResult.validCount} API Key valid berhasil disimpan ke pool lokal.
                  </div>
                  {bulkResult.rateLimitCount > 0 && (
                    <div className="text-amber-700">
                      • {bulkResult.rateLimitCount} Key benar tetapi kuota habis. Disimpan dengan status cooldown.
                    </div>
                  )}
                  {bulkResult.unavailableCount > 0 && (
                    <div className="text-[#6F6670]">
                      • {bulkResult.unavailableCount} Key sementara tidak terhubung ke server/jaringan.
                    </div>
                  )}
                  {bulkResult.invalidCount > 0 && (
                    <div className="text-rose-700 font-medium">
                      • {bulkResult.invalidCount} Key salah/dicabut. Tidak disimpan.
                    </div>
                  )}
                </div>

                {/* Detailed Per-Key List */}
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {bulkResult.results.map((r, idx) => {
                    const isValidUnverified = r.status === 'valid_unverified';
                    const isQuota = r.status === 'quota_limited';
                    const isInvalid = r.status === 'invalid';
                    const isValidFull = r.valid && !isValidUnverified;

                    const displayMessage =
                      isValidFull
                        ? 'Key valid dan disimpan.'
                        : isValidUnverified
                        ? 'Key diterima Google tetapi model sedang sibuk. Key tetap disimpan.'
                        : isQuota
                        ? 'Key benar tetapi kuota habis. Disimpan dengan status cooldown.'
                        : isInvalid
                        ? 'Key salah/dicabut. Tidak disimpan.'
                        : r.message || 'Sementara tidak terverifikasi.';

                    return (
                      <div
                        key={idx}
                        className={`p-2 rounded-lg text-xs flex items-center justify-between gap-2 border ${
                          isValidFull
                            ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                            : isValidUnverified
                            ? 'bg-sky-50/70 border-sky-200 text-sky-950'
                            : isQuota
                            ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                            : isInvalid
                            ? 'bg-rose-50/70 border-rose-200 text-rose-950'
                            : 'bg-neutral-50/70 border-neutral-200 text-neutral-800'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {r.valid ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                          ) : isQuota ? (
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                          ) : isInvalid ? (
                            <XCircle className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />
                          ) : (
                            <AlertTriangle className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
                          )}
                          <span className="font-mono font-bold text-[11px] truncate">{r.maskedKey}</span>
                          <span className="text-[10px] text-[#6F6670] truncate">— {displayMessage}</span>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-bold flex-shrink-0 ${
                            isValidFull
                              ? 'bg-emerald-200 text-emerald-900'
                              : isValidUnverified
                              ? 'bg-sky-200 text-sky-900'
                              : isQuota
                              ? 'bg-amber-200 text-amber-900'
                              : isInvalid
                              ? 'bg-rose-200 text-rose-900'
                              : 'bg-neutral-200 text-neutral-800'
                          }`}
                        >
                          {r.valid
                            ? r.isExisting
                              ? 'UPDATE'
                              : 'SIMPAN'
                            : isQuota
                            ? 'COOLDOWN'
                            : isInvalid
                            ? 'DITOLAK'
                            : 'PENDING'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleVerifyAndSave} className="space-y-3 pt-2">
            <div className="relative">
              <textarea
                rows={5}
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                placeholder="Tempelkan satu atau beberapa Gemini API Key Anda (pisahkan dengan baris baru / Enter):&#10;AQ.Ab8...&#10;AIzaSyB... (format lama, masih didukung)"
                style={{
                  WebkitTextSecurity: showRaw ? 'none' : ('disc' as any),
                }}
                className="w-full pl-3.5 pr-10 py-3 bg-[#FFF9FA] border border-[#F1DDE2] rounded-xl text-xs focus:outline-hidden focus:border-[#FE4C6F] text-[#1F1720] font-mono leading-relaxed"
              />
              <button
                type="button"
                onClick={() => setShowRaw(!showRaw)}
                className="absolute right-3 top-3 text-[#6F6670] hover:text-[#FE4C6F] p-1 bg-white/80 rounded-lg backdrop-blur-xs transition-colors cursor-pointer"
                title={showRaw ? 'Sembunyikan Key' : 'Tampilkan Key'}
              >
                {showRaw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-[11px] text-[#6F6670] flex items-center gap-1">
                <Lock className="w-3 h-3 text-[#FE4C6F]" />
                Hanya API Key valid yang disimpan di browser.
              </p>

              <button
                type="submit"
                disabled={verifying || !inputKey.trim()}
                className="w-full sm:w-auto px-5 py-2.5 bg-[#FE4C6F] hover:bg-[#E83E60] disabled:bg-gray-300 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer flex-shrink-0 shadow-xs"
              >
                {verifying ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <ShieldCheck className="w-4 h-4" />
                )}
                <span>
                  {verifying
                    ? 'Memverifikasi...'
                    : parsedKeyCount > 1
                    ? `Verifikasi & Simpan ${parsedKeyCount} Key`
                    : 'Verifikasi & Simpan Key'}
                </span>
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Visitor Key List */}
        <div className="bg-white rounded-2xl border border-[#F1DDE2] p-5 shadow-xs space-y-4 flex flex-col h-full">
          <div className="flex items-center justify-between flex-shrink-0">
            <h4 className="font-bold text-sm text-[#1F1720] flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#FE4C6F]" />
              Daftar API Key Terverifikasi ({visitorKeys.length})
            </h4>
            <span className="text-[11px] text-[#6F6670]">
              Pool Aktif Round Robin
            </span>
          </div>

          {visitorKeys.length === 0 ? (
            <div className="p-6 bg-[#FFF9FA] border border-[#F1DDE2] rounded-xl text-center text-xs text-[#6F6670] space-y-2 flex-1 flex flex-col justify-center items-center">
              <p className="font-semibold text-[#1F1720]">Belum ada API Key lokal yang terverifikasi.</p>
              <p className="max-w-xs leading-relaxed text-[11px]">
                Sistem dapat memanfaatkan <strong>System Fallback API Key</strong> di server jika tersedia. Anda dapat menambahkan API Key sendiri pada kolom sebelah kiri untuk rotasi kuota mandiri.
              </p>
            </div>
          ) : (
            <div className="space-y-3 flex-1 overflow-y-auto max-h-[460px] pr-1">
              {visitorKeys.map((k) => (
                <div
                  key={k.id}
                  className="p-3.5 bg-[#FFF9FA] border border-[#F1DDE2] rounded-xl flex flex-wrap items-center justify-between gap-2.5 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="font-mono font-bold text-[#1F1720] text-[11px] truncate">{k.maskedKey}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                        k.status === 'READY'
                          ? 'bg-emerald-100 text-emerald-800'
                          : k.status === 'COOLDOWN'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {k.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[#6F6670] hidden sm:inline">
                      {k.successCount} ok / {k.failureCount} err
                    </span>

                    <button
                      onClick={() => handleTestKey(k)}
                      disabled={testingId === k.id}
                      className="px-2.5 py-1 bg-white border border-[#F1DDE2] hover:bg-[#FFE8EE] text-[#1F1720] hover:text-[#FE4C6F] font-semibold rounded-lg text-xs transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      {testingId === k.id ? (
                        <div className="w-3 h-3 border-2 border-[#FE4C6F] border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Zap className="w-3.5 h-3.5 text-[#FE4C6F]" />
                      )}
                      <span>Tes</span>
                    </button>

                    <button
                      onClick={() => onDeleteKey(k.id)}
                      className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Hapus Key"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Test Result Feedback */}
                  {testResult && testResult.id === k.id && (
                    <div
                      className={`w-full p-2 rounded-lg text-[11px] font-medium mt-1 flex items-center gap-2 ${
                        testResult.valid
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-rose-50 text-rose-800 border border-rose-200'
                      }`}
                    >
                      {testResult.valid ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />
                      )}
                      <span>{testResult.message}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
