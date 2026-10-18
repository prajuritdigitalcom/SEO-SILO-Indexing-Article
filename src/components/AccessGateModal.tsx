import React, { useState, useEffect } from 'react';
import { Lock, Unlock, ShieldAlert, KeyRound, AlertTriangle, Clock, Eye, EyeOff, CheckCircle2 } from 'lucide-react';

interface AccessGateModalProps {
  isOpen: boolean;
  onSuccess: (token: string) => void;
}

const STORAGE_AUTH_TOKEN = 'prajurit_gate_auth_token';
const STORAGE_LOCKED_UNTIL = 'prajurit_gate_locked_until';
const STORAGE_ATTEMPTS = 'prajurit_gate_failed_attempts';
const MAX_ATTEMPTS = 3;

export const AccessGateModal: React.FC<AccessGateModalProps> = ({ isOpen, onSuccess }) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number>(MAX_ATTEMPTS);
  const [isLocked, setIsLocked] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [countdownText, setCountdownText] = useState<string>('');

  // Check initial local lockout state
  useEffect(() => {
    const storedLock = localStorage.getItem(STORAGE_LOCKED_UNTIL);
    if (storedLock) {
      const lockTimestamp = parseInt(storedLock, 10);
      if (!isNaN(lockTimestamp) && lockTimestamp > Date.now()) {
        setIsLocked(true);
        setLockedUntil(lockTimestamp);
        setRemainingAttempts(0);
      } else {
        localStorage.removeItem(STORAGE_LOCKED_UNTIL);
        localStorage.removeItem(STORAGE_ATTEMPTS);
        setIsLocked(false);
        setLockedUntil(null);
        setRemainingAttempts(MAX_ATTEMPTS);
      }
    } else {
      const attempts = parseInt(localStorage.getItem(STORAGE_ATTEMPTS) || '0', 10);
      if (!isNaN(attempts)) {
        setRemainingAttempts(Math.max(0, MAX_ATTEMPTS - attempts));
      }
    }
  }, []);

  // Countdown timer when locked
  useEffect(() => {
    if (!isLocked || !lockedUntil) return;

    const updateTimer = () => {
      const diff = lockedUntil - Date.now();
      if (diff <= 0) {
        setIsLocked(false);
        setLockedUntil(null);
        setRemainingAttempts(MAX_ATTEMPTS);
        setErrorMsg(null);
        localStorage.removeItem(STORAGE_LOCKED_UNTIL);
        localStorage.removeItem(STORAGE_ATTEMPTS);
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setCountdownText(
          `${hours.toString().padStart(2, '0')} Jam : ${minutes.toString().padStart(2, '0')} Menit : ${seconds.toString().padStart(2, '0')} Detik`
        );
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [isLocked, lockedUntil]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim() || loading || isLocked) return;

    setLoading(true);
    setErrorMsg(null);

    try {
      const visitorId = localStorage.getItem('prajurit_seo_visitor_id') || 'visitor';
      const response = await fetch('/api/auth/verify-gate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: password.trim(),
          visitorId,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Successful verification!
        localStorage.setItem(STORAGE_AUTH_TOKEN, data.token || 'authenticated');
        localStorage.removeItem(STORAGE_LOCKED_UNTIL);
        localStorage.removeItem(STORAGE_ATTEMPTS);
        onSuccess(data.token || 'authenticated');
      } else {
        // Failed attempt
        if (data.isLocked && data.lockedUntil) {
          setIsLocked(true);
          setLockedUntil(data.lockedUntil);
          setRemainingAttempts(0);
          localStorage.setItem(STORAGE_LOCKED_UNTIL, data.lockedUntil.toString());
          setErrorMsg(data.error || 'Aplikasi terkunci selama 12 jam karena salah memasukkan password 3 kali.');
        } else {
          const currentAttempts = typeof data.remainingAttempts === 'number' ? data.remainingAttempts : Math.max(0, remainingAttempts - 1);
          setRemainingAttempts(currentAttempts);
          localStorage.setItem(STORAGE_ATTEMPTS, (MAX_ATTEMPTS - currentAttempts).toString());

          if (currentAttempts <= 0) {
            const twelveHoursLock = Date.now() + 12 * 60 * 60 * 1000;
            setIsLocked(true);
            setLockedUntil(twelveHoursLock);
            localStorage.setItem(STORAGE_LOCKED_UNTIL, twelveHoursLock.toString());
            setErrorMsg('Password salah 3 kali! Aplikasi dikunci selama 12 jam.');
          } else {
            setErrorMsg(data.error || `Password salah! Sisa percobaan: ${currentAttempts} dari ${MAX_ATTEMPTS}.`);
          }
        }
      }
    } catch (err: any) {
      // Local fallback in case network fails
      const attempts = parseInt(localStorage.getItem(STORAGE_ATTEMPTS) || '0', 10) + 1;
      localStorage.setItem(STORAGE_ATTEMPTS, attempts.toString());
      const left = Math.max(0, MAX_ATTEMPTS - attempts);
      setRemainingAttempts(left);

      if (left <= 0) {
        const lockTime = Date.now() + 12 * 60 * 60 * 1000;
        setIsLocked(true);
        setLockedUntil(lockTime);
        localStorage.setItem(STORAGE_LOCKED_UNTIL, lockTime.toString());
        setErrorMsg('Gagal memverifikasi. Percobaan melebihi batas, aplikasi dikunci 12 jam.');
      } else {
        setErrorMsg(`Gagal memverifikasi password. Sisa percobaan: ${left} dari ${MAX_ATTEMPTS}.`);
      }
    } finally {
      setLoading(false);
      setPassword('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <div className="bg-white rounded-3xl border border-[#F1DDE2] shadow-2xl w-full max-w-md overflow-hidden relative animate-in fade-in zoom-in-95 duration-200">
        {/* Header Ribbon / Banner */}
        <div className="bg-gradient-to-r from-[#FE4C6F] to-[#E83E60] p-6 text-white text-center relative">
          <div className="w-16 h-16 bg-white/20 rounded-2xl p-1 backdrop-blur-xs mx-auto shadow-inner flex items-center justify-center mb-3">
            <img
              src="https://i.ibb.co.com/wr0x733r/prajurit-digital.jpg"
              alt="Prajurit Digital"
              className="w-full h-full object-cover rounded-xl shadow-xs"
            />
          </div>
          <h2 className="text-lg font-extrabold tracking-tight">Prajurit Digital SEO SILO</h2>
          <p className="text-xs text-white/90 font-medium mt-1">
            Knowledge Architecture & Internal Linking Engine
          </p>

          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 rounded-full text-[11px] font-semibold tracking-wide">
            {isLocked ? (
              <>
                <ShieldAlert className="w-3.5 h-3.5 text-amber-200" />
                <span>Akses Dikunci (12 Jam)</span>
              </>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5 text-white" />
                <span>Akses Terproteksi Password</span>
              </>
            )}
          </div>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-5 bg-[#FFF9FA]">
          {isLocked ? (
            /* LOCKED STATE (12 HOURS) */
            <div className="space-y-4 text-center">
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-2">
                <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                  <ShieldAlert className="w-6 h-6 animate-pulse" />
                </div>
                <h4 className="font-bold text-sm text-rose-900">
                  Input Password Terkunci Sementara
                </h4>
                <p className="text-xs text-rose-700 leading-relaxed">
                  Anda telah gagal memasukkan password sebanyak <strong>3 kali</strong>. Sesuai protokol keamanan, input dikunci selama <strong>12 jam</strong>.
                </p>
              </div>

              {/* Countdown Display */}
              <div className="p-4 bg-white border border-[#F1DDE2] rounded-2xl shadow-xs space-y-1.5">
                <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-[#6F6670]">
                  <Clock className="w-4 h-4 text-[#FE4C6F]" />
                  <span>Waktu Tersisa Menuju Buka Kunci:</span>
                </div>
                <div className="font-mono text-base font-extrabold text-[#FE4C6F] tracking-wide">
                  {countdownText || 'Menghitung waktu...'}
                </div>
              </div>

              <p className="text-[11px] text-[#6F6670] leading-relaxed">
                Silakan kembali lagi setelah waktu hitung mundur selesai, atau hubungi tim <strong>Prajurit Digital</strong> jika Anda membutuhkan bantuan.
              </p>
            </div>
          ) : (
            /* INPUT PASSWORD FORM */
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="text-center">
                <h3 className="font-bold text-base text-[#1F1720]">Buka Akses Aplikasi</h3>
              </div>

              {/* Error Box */}
              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-start gap-2 animate-shake">
                  <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                  <span className="leading-snug">{errorMsg}</span>
                </div>
              )}

              {/* Remaining Attempts Indicator */}
              <div className="flex items-center justify-between text-xs px-1">
                <span className="text-[#6F6670]">Batas Percobaan:</span>
                <span
                  className={`font-bold px-2.5 py-0.5 rounded-full text-[11px] ${
                    remainingAttempts === 3
                      ? 'bg-emerald-100 text-emerald-800'
                      : remainingAttempts === 2
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {remainingAttempts} dari {MAX_ATTEMPTS} Tersisa
                </span>
              </div>

              {/* Password Input Field */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[#1F1720]">
                  Password Akses
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#6F6670]">
                    <KeyRound className="w-4 h-4 text-[#FE4C6F]" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan password Anda..."
                    disabled={loading || isLocked}
                    autoFocus
                    required
                    className="w-full pl-10 pr-10 py-3 bg-white border border-[#F1DDE2] rounded-xl text-xs focus:outline-hidden focus:border-[#FE4C6F] text-[#1F1720] font-medium shadow-xs disabled:bg-gray-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#6F6670] hover:text-[#FE4C6F] transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || !password.trim() || isLocked}
                className="w-full py-3 bg-[#FE4C6F] hover:bg-[#E83E60] disabled:bg-gray-300 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer hover:shadow-lg disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Memverifikasi Akses...</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-4 h-4" />
                    <span>Buka Akses Aplikasi</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
