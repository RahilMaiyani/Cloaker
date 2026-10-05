'use client';

import React, { useState, useEffect } from 'react';
import {
    X,
    History,
    Copy,
    Check,
    Flame,
    Clock,
    KeyRound,
    RefreshCw,
    Trash2,
    ExternalLink,
    ShieldCheck,
    FileText,
    FileCode2,
    QrCode,
    AlertCircle,
} from "lucide-react";

import { useSentVault, syncEntryStatus, SentSecretEntry } from '@/lib/vault';
import { toast } from './Toast';

interface SentVaultModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectCardUrl?: (url: string) => void;
}

function formatCountdown(seconds: number): string {
    if (seconds <= 0) return 'Expired';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (days > 0) {
        return `${days}d ${hours.toString().padStart(2, "0")}h ${minutes.toString().padStart(2, "0")}m ${secs.toString().padStart(2, "0")}s`;
    }
    if (hours > 0) {
        return `${hours.toString().padStart(2, "0")}h ${minutes.toString().padStart(2, "0")}m ${secs.toString().padStart(2, "0")}s`;
    }
    return `${minutes.toString().padStart(2, "0")}m ${secs.toString().padStart(2, "0")}s`;
}

function formatBytes(bytes?: number): string {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
}

function formatRelativeTime(timestamp: number): string {
    const diffSec = Math.floor((Date.now() - timestamp) / 1000);
    if (diffSec < 60) return "Just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return `${Math.floor(diffHr / 24)}d ago`;
}

export function SentVaultModal({ isOpen, onClose, onSelectCardUrl }: SentVaultModalProps) {
    const { entries, activeCount, removeEntry, clearAll, updateEntry } = useSentVault();

    const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [revokingId, setRevokingId] = useState<string | null>(null);
    const [, setTick] = useState(0);

    useEffect(() => {
        if (!isOpen) return;
        const interval = setInterval(() => setTick((t) => t + 1), 1000);
        return () => clearInterval(interval);
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen || entries.length === 0) return;

        let isMounted = true;
        async function syncAll() {
            for (const entry of entries) {
                if (!isMounted) break;
                if (entry.status !== 'revoked' && entry.status !== 'burned') {
                    await syncEntryStatus(entry);
                }
            }
        }
        syncAll();
        return () => {
            isMounted = false;
        };
    }, [isOpen]);

    if (!isOpen) return null;

    async function handleManualSync() {
        setIsSyncing(true);
        try {
            await Promise.all(
                entries.map((entry) => {
                    if (entry.status !== 'revoked') {
                        return syncEntryStatus(entry);
                    }
                    return Promise.resolve(entry.status);
                })
            );
            toast.success("vault status updated from server");
        }
        catch {
            toast.error("Failed to sync some secret statuses.");
        }
        finally {
            setIsSyncing(false);
        }
    }

    async function handleRevoke(entry: SentSecretEntry) {
        if (!entry.revocationToken || !entry.linkIds?.length) {
            toast.error("Missing revocation credentials for this secret.");
            return;
        }

        setRevokingId(entry.id);
        try {
            const res = await fetch("/api/secrets/revoke", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    linkIds: entry.linkIds,
                    revocationToken: entry.revocationToken,
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Failed to revoke secret");
            }

            updateEntry(entry.id, { status: "revoked", lastCheckedAt: Date.now() });
            toast.success("Secret permenently revoked and destroyed.");
        }
        catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Revocation Failed.")
        }
        finally {
            setRevokingId(null);
        }
    }

    function handleCopy(url: string) {
        navigator.clipboard.writeText(url);
        setCopiedUrl(url);
        toast.success("Secret link copied to clipboard");
        setTimeout(() => setCopiedUrl(null), 2000);
    }

    function handleClearVault() {
        if (confirm("Are you sure you want to clear your local sent vault history? This cannot be undone.")) {
            clearAll();
            toast.success("Sent vault history cleared");
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200 font-mono" onClick={onClose}>
            <div className="w-full max-w-2xl max-h-[88dvh] bg-neutral-950 border border-neutral-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
                {/* Header Bar */}
                <div className="p-4 sm:p-5 border-b border-neutral-800/80 bg-neutral-900/60 flex items-center justify-between gap-3 select-none">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-emerald-950/60 border border-emerald-800/70 flex items-center justify-center text-emerald-400">
                            <History className="w-4 h-4" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-sm sm:text-base font-bold text-neutral-100">Sent Vault</h2>
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-emerald-950/80 border border-emerald-700/60 text-emerald-300">
                                    {activeCount} Active
                                </span>
                            </div>
                            <p className="text-[11px] text-neutral-400 mt-0.5">
                                Client-side link history & emergency revocation
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2">
                        <button
                            type="button"
                            onClick={handleManualSync}
                            disabled={isSyncing || entries.length === 0}
                            className="p-2 sm:px-2.5 sm:py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white rounded-lg text-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40"
                            title="Refresh status from server"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isSyncing ? "animate-spin" : ""}`} />
                            <span className="hidden sm:inline">Refresh</span>
                        </button>
                        {entries.length > 0 && (
                            <button
                                type="button"
                                onClick={handleClearVault}
                                className="p-2 sm:px-2.5 sm:py-1.5 bg-neutral-900 hover:bg-red-950/60 hover:text-red-400 border border-neutral-800 text-neutral-400 rounded-lg text-xs flex items-center gap-1.5 transition cursor-pointer"
                                title="Wipe local history"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Clear</span>
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-8 h-8 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center transition cursor-pointer"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
                {/* Vault Entries List */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 divide-y divide-neutral-900">
                    {entries.length === 0 ? (
                        <div className="py-14 sm:py-16 text-center space-y-3 text-neutral-500">
                            <div className="w-12 h-12 rounded-2xl bg-neutral-900 border border-neutral-800/80 flex items-center justify-center mx-auto text-neutral-400">
                                <ShieldCheck className="w-6 h-6 text-emerald-400" />
                            </div>
                            <p className="text-sm font-semibold text-neutral-200">No secret links in your vault</p>
                            <p className="text-xs text-neutral-400 max-w-sm mx-auto leading-relaxed">
                                When you generate secrets, their access pointers and revocation tokens will appear here so you can re-share or revoke them anytime.
                            </p>
                        </div>
                    ) : (
                        entries.map((entry) => {
                            const secondsLeft = Math.max(0, Math.floor((entry.expiresAt - Date.now()) / 1000));
                            const isActuallyExpired = secondsLeft === 0 || entry.status === "expired";
                            const isRevoked = entry.status === "revoked";
                            const isBurned = entry.status === "burned";
                            const isActive = !isActuallyExpired && !isRevoked && !isBurned;
                            return (
                                <div
                                    key={entry.id}
                                    className="pt-3.5 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5"
                                >
                                    <div className="space-y-1.5 flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {/* Mode Icon */}
                                            {entry.mode === "file" ? (
                                                <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
                                            ) : (
                                                <FileCode2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                            )}
                                            {/* Title */}
                                            <span className="text-xs sm:text-sm font-bold text-neutral-100 truncate max-w-[220px] sm:max-w-xs" title={entry.title}>
                                                {entry.title || (entry.mode === "file" ? "Encrypted File" : "Secret Note")}
                                            </span>
                                            {/* Status Badge */}
                                            {isActive && (
                                                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold bg-emerald-950/80 border border-emerald-700/60 text-emerald-300">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                                    {formatCountdown(secondsLeft)}
                                                </span>
                                            )}
                                            {isBurned && (
                                                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold bg-red-950/80 border border-red-800 text-red-300">
                                                    <AlertCircle className="w-3 h-3 text-red-400" />
                                                    Burned
                                                </span>
                                            )}
                                            {isRevoked && (
                                                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold bg-red-950/80 border border-red-800/80 text-red-400">
                                                    <Flame className="w-3 h-3 text-red-400" />
                                                    Revoked
                                                </span>
                                            )}
                                            {isActuallyExpired && !isBurned && !isRevoked && (
                                                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold bg-neutral-900 border border-neutral-800 text-neutral-400">
                                                    <Clock className="w-3 h-3 text-neutral-500" />
                                                    Expired
                                                </span>
                                            )}
                                        </div>
                                        {/* Metadata tags */}
                                        <div className="flex items-center gap-2 text-[11px] text-neutral-400 flex-wrap">
                                            <span>{formatRelativeTime(entry.createdAt)}</span>
                                            <span>•</span>
                                            <span>{entry.burnOnRead ? "Burn on read" : "Reusable"}</span>
                                            {entry.hasPasscode && (
                                                <>
                                                    <span>•</span>
                                                    <span className="flex items-center gap-1 text-emerald-400/90">
                                                        <KeyRound className="w-3 h-3" /> PIN
                                                    </span>
                                                </>
                                            )}
                                            {entry.fileSize && (
                                                <>
                                                    <span>•</span>
                                                    <span>{formatBytes(entry.fileSize)}</span>
                                                </>
                                            )}
                                            {entry.linkCount > 1 && (
                                                <>
                                                    <span>•</span>
                                                    <span className="text-emerald-400 font-semibold">{entry.linkCount} Links</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    {/* Action Buttons */}
                                    <div className="flex items-center gap-1.5 self-start sm:self-center shrink-0">
                                        {/* Copy Link Button */}
                                        <button
                                            type="button"
                                            disabled={isActuallyExpired || isRevoked || isBurned}
                                            onClick={() => handleCopy(entry.urls[0] || "")}
                                            className="h-8 px-2.5 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-30 border border-neutral-800 text-neutral-200 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition cursor-pointer active:scale-95"
                                            title="Copy Secret Link"
                                        >
                                            {copiedUrl === entry.urls[0] ? (
                                                <Check className="w-3 h-3 text-emerald-400" />
                                            ) : (
                                                <Copy className="w-3 h-3 text-neutral-400" />
                                            )}
                                            <span>{copiedUrl === entry.urls[0] ? "Copied" : "Copy"}</span>
                                        </button>
                                        {/* Card & QR Trigger */}
                                        {onSelectCardUrl && entry.urls[0] && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    onSelectCardUrl(entry.urls[0]);
                                                    onClose();
                                                }}
                                                className="h-8 px-2.5 bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-800/60 text-emerald-300 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer active:scale-95"
                                                title="View & Export Share Card"
                                            >
                                                <QrCode className="w-3 h-3 text-emerald-400" />
                                                <span className="hidden xs:inline">Card</span>
                                            </button>
                                        )}
                                        {/* Revoke Button (only active for alive secrets) */}
                                        {isActive && (
                                            <button
                                                type="button"
                                                disabled={revokingId === entry.id}
                                                onClick={() => handleRevoke(entry)}
                                                className="h-8 px-2.5 bg-red-950/60 hover:bg-red-900/80 border border-red-800/80 text-red-300 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer active:scale-95 disabled:opacity-40"
                                                title="Permanently Revoke and Destroy"
                                            >
                                                {revokingId === entry.id ? (
                                                    <div className="w-3 h-3 border-2 border-red-300 border-t-transparent rounded-full animate-spin" />
                                                ) : (
                                                    <Flame className="w-3 h-3 text-red-400" />
                                                )}
                                                <span>Revoke</span>
                                            </button>
                                        )}
                                        {/* Remove from Vault */}
                                        <button
                                            type="button"
                                            onClick={() => removeEntry(entry.id)}
                                            className="h-8 w-8 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-500 hover:text-red-400 flex items-center justify-center transition cursor-pointer"
                                            title="Remove from history"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
                {/* Privacy Note Footer */}
                <div className="p-3.5 bg-neutral-900/80 border-t border-neutral-800/80 flex items-center justify-between text-[11px] text-neutral-400 select-none">
                    <span className="flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Stored strictly on this device in localStorage. No payloads retained.</span>
                    </span>
                </div>
            </div>
        </div>
    )
}