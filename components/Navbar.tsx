"use client";

import { useState } from "react";
import Link from "next/link";
import { ShieldCheck, Info, X, KeyRound, EyeOff, Zap, History } from "lucide-react";
import { useSentVault } from "@/lib/vault";
import { SentVaultModal } from "./SentVaultModal";

export default function Navbar() {
  const [showInfo, setShowInfo] = useState(false);

  const [showVault, setShowVault] = useState(false);
  const { activeCount } = useSentVault();

  return (
    <>
      <header className="sticky top-3 sm:top-5 z-50 w-full px-3.5 sm:px-6 md:px-8">
        <div className="max-w-4xl mx-auto h-14 sm:h-15 bg-neutral-950/75 border border-neutral-800/90 rounded-2xl px-3.5 sm:px-5 flex items-center justify-between shadow-[0_8px_32px_rgba(0,0,0,0.6)] backdrop-blur-xl ring-1 ring-white/[0.04]">
          {/* Brand Logo & Emblem */}
          <Link href="/" className="flex items-center gap-2.5 sm:gap-3 group">
            <div className="w-8 h-8 rounded-xl bg-neutral-900/90 border border-neutral-800 flex items-center justify-center group-hover:border-emerald-500/50 group-hover:bg-neutral-900 transition-all duration-200">
              <svg
                className="w-4 h-4 text-emerald-400 transition-transform duration-200 group-hover:scale-110"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 7A8.5 8.5 0 1 0 18 17" />
              </svg>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-sm sm:text-base tracking-tight text-neutral-100 group-hover:text-emerald-300 transition-colors">
                Cloaker
              </span>
              <span className="text-[10px] font-mono tracking-wider uppercase font-semibold text-emerald-400/90 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-full hidden sm:inline-flex items-center gap-1">
                Zero-Knowledge
              </span>
            </div>
          </Link>

          {/* Right Action & Security Badge */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Live Security Chip */}
            <div className="hidden md:flex items-center gap-2 text-[11px] font-mono text-neutral-400 bg-neutral-900/90 px-3 py-1.5 rounded-xl border border-neutral-800/80 shadow-inner">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-neutral-300 font-medium">AES-256</span>
              <span className="text-neutral-600">|</span>
              <span className="text-neutral-500">In-Memory</span>
            </div>

            {/* Sent Vault Button */}
            <button
              type="button"
              onClick={() => setShowVault(true)}
              className="flex items-center gap-1.5 text-[11px] font-mono text-neutral-300 hover:text-white bg-neutral-900/90 hover:bg-neutral-800/90 px-2.5 sm:px-3 py-1.5 rounded-xl border border-neutral-800 hover:border-neutral-700 transition cursor-pointer active:scale-95"
              title="Sent Secrets Vault & History"
            >
              <History className="w-3.5 h-3.5 text-emerald-400" />
              <span>Vault</span>
              {activeCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-emerald-500 text-neutral-950 font-bold text-[9px] flex items-center justify-center -mr-1">
                  {activeCount}
                </span>
              )}
            </button>

            {/* Security Info Trigger Button */}
            <button
              type="button"
              onClick={() => setShowInfo(true)}
              className="flex items-center gap-1.5 text-[11px] font-mono text-neutral-300 hover:text-white bg-neutral-900/90 hover:bg-neutral-800/90 px-2.5 sm:px-3 py-1.5 rounded-xl border border-neutral-800 hover:border-neutral-700 transition cursor-pointer active:scale-95"
              title="How Cloaker Security Works"
            >
              <Info className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden xs:inline">Architecture</span>
            </button>
          </div>
        </div>
      </header>

      {/* Sent Vault Drawer / Modal */}
      <SentVaultModal isOpen={showVault} onClose={() => setShowVault(false)} />

      {/* Security Architecture Modal */}
      {showInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-neutral-950 border border-neutral-800 rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4 font-mono">
            <div className="flex items-center justify-between border-b border-neutral-800/80 pb-3">
              <div className="flex items-center gap-2 text-neutral-100 font-bold text-sm">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Zero-Knowledge Cryptography
              </div>
              <button
                type="button"
                onClick={() => setShowInfo(false)}
                className="w-7 h-7 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-neutral-300 leading-relaxed">
              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-neutral-900/60 border border-neutral-800/60">
                <KeyRound className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-neutral-200">URL Fragment Key Isolation</div>
                  <div className="text-neutral-400 text-[11px] mt-0.5">
                    The AES-256 decryption key is placed strictly in the URL fragment (`#k=...`). Browsers never transmit hash fragments over HTTP, ensuring servers and proxies never see the key.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-neutral-900/60 border border-neutral-800/60">
                <Zap className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-neutral-200">In-Memory Decryption & Atomic Burn</div>
                  <div className="text-neutral-400 text-[11px] mt-0.5">
                    Decryption occurs entirely in client RAM. Single-use secrets are atomically destroyed in Redis upon first read.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-neutral-900/60 border border-neutral-800/60">
                <EyeOff className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-neutral-200">Anti-Brute Force PIN Gate</div>
                  <div className="text-neutral-400 text-[11px] mt-0.5">
                    Passcode-protected secrets enforce a 3-strike self-destruct policy, preventing automated brute-force attempts.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
