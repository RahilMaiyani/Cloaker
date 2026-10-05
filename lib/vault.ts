"use client";

import { useState, useEffect } from 'react';

export interface SentSecretEntry {
    id: string;
    createdAt: number;
    expiresAt: number;
    ttl: number;
    burnOnRead: boolean;
    hasPasscode: boolean;
    mode: 'text' | 'file';
    title: string;
    fileSize?: number;
    linkCount: number;
    linkIds: string[];
    urls: string[];
    revocationToken: string;
    status?: 'active' | 'burned' | 'expired' | 'revoked';
    lastCheckedAt?: number;
}

const VAULT_STORAGE_KEY = "cloaker_sent_vault";
const VAULT_EVENT = 'cloaker_vault_updated';
const MAX_VAULT_ENTRIES = 50;

export function getVaultEntries(): SentSecretEntry[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(VAULT_STORAGE_KEY);
        if (!raw) return [];
        const parsed: SentSecretEntry[] = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.sort((a, b) => b.createdAt - a.createdAt);
    }
    catch {
        return [];
    }
}

function saveVaultEntries(entries: SentSecretEntry[]): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_VAULT_ENTRIES)));
        window.dispatchEvent(new Event(VAULT_EVENT));
    }
    catch (err) {
        console.error("Failed to save to sent vault: ", err);
    }
}

export function addVaultEntry(data: Omit<SentSecretEntry, 'id' | 'createdAt' | 'status'>): SentSecretEntry {
    const current = getVaultEntries();
    const newEntry: SentSecretEntry = {
        ...data,
        id: `vault_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        createdAt: Date.now(),
        status: 'active',
    };

    saveVaultEntries([newEntry, ...current]);
    return newEntry;
}

export function updateVaultEntry(id: string, updates: Partial<SentSecretEntry>): void {
    const current = getVaultEntries();
    const updated = current.map((entry) =>
        entry.id === id ? { ...entry, ...updates } : entry
    );
    saveVaultEntries(updated);
}

export function removeVaultEntry(id: string) {
    const current = getVaultEntries();
    saveVaultEntries(current.filter((entry) => entry.id !== id));
}

export function clearVault(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(VAULT_STORAGE_KEY);
    window.dispatchEvent(new Event(VAULT_EVENT));
}

export async function syncEntryStatus(
    entry: SentSecretEntry
): Promise<SentSecretEntry['status']> {
    if (entry.status === 'revoked') return 'revoked';

    if (Date.now() >= entry.expiresAt) {
        updateVaultEntry(entry.id, { status: "expired", lastCheckedAt: Date.now() });
        return 'expired';
    }

    const primarylinkId = entry.linkIds[0];
    if (!primarylinkId) return entry.status || 'active';

    try {
        const res = await fetch(`/api/secrets/${primarylinkId}/meta`, { method: "GET" });
        let newStatus: SentSecretEntry['status'] = 'active';

        if (res.status === 200) {
            newStatus = 'active';
        }
        else if (res.status === 404) {
            newStatus = Date.now() >= entry.expiresAt ? 'expired' : 'burned';
        }

        updateVaultEntry(entry.id, { status: newStatus, lastCheckedAt: Date.now() });
        return newStatus;
    }
    catch {
        return entry.status || 'active';
    }
}

export function useSentVault() {
    const [entries, setEntries] = useState<SentSecretEntry[]>([]);

    useEffect(() => {
        setEntries(getVaultEntries());

        const handleUpdate = () => {
            setEntries(getVaultEntries());
        }

        window.addEventListener(VAULT_EVENT, handleUpdate);
        window.addEventListener("storage", handleUpdate);

        return () => {
            window.removeEventListener(VAULT_EVENT, handleUpdate);
            window.removeEventListener('storage', handleUpdate);
        }
    }, []);

    const activeCount = entries.filter((e) => {
        if (e.status === 'revoked' || e.status === 'burned') return false;
        return Date.now() < e.expiresAt;
    }).length;

    return {
        entries,
        activeCount,
        removeEntry: removeVaultEntry,
        clearAll: clearVault,
        updateEntry: updateVaultEntry,
    };
}