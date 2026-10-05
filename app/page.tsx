"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { encryptSecret, hashPasscode, generateSalt } from "@/lib/crypto";
import { Copy, Check, ShieldAlert, FileCode2, Clock, Sparkles, RefreshCw, Settings2, ChevronDown, Plus, Minus, Flame, Hourglass, Layers, KeyRound, User, Mail, Tag, QrCode, Paperclip, UploadCloud, FileUp, FileText, X, Link2 } from "lucide-react";
import { PasscodeInput } from "@/components/PasscodeInput";
import { ShareCardModal } from "@/components/ShareCardModal";
import { toast } from "@/components/Toast";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "Expired";
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
  return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

const MAX_TEXT_BYTES = 512 * 1024;
const MAX_FILE_BYTES = 1024 * 1024;

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function HomePage() {
  const [text, setText] = useState("");
  const [ttl, setTtl] = useState(86400);
  const [burnOnRead, setBurnOnRead] = useState(true);
  const [linkCount, setLinkCount] = useState(1);

  const [isEncrypting, setIsEncrypting] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [mode, setMode] = useState<"text" | "file">("text");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);


  const [generatedLinkIds, setGeneratedLinkIds] = useState<string[]>([]);
  const [generatedLinks, setGeneratedLinks] = useState<string[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const [revocationToken, setRevocationToken] = useState<string | null>(null);

  const [passcode, setPasscode] = useState("");

  const [creatorName, setCreatorName] = useState("");
  const [creatorEmail, setCreatorEmail] = useState("");
  const [creatorSubject, setCreatorSubject] = useState("");

  const [selectedCardUrl, setSelectedCardUrl] = useState<string | null>(null);

  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (!expiresAt) return;
    const updateCountdown = () => {
      const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setCountdown(remaining);
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  const byteSize = useMemo(() => (mode === "text" ? new Blob([text]).size : selectedFile?.size || 0), [text, mode, selectedFile]);
  const isOverLimit = mode === "text" ? byteSize > MAX_TEXT_BYTES : byteSize > MAX_FILE_BYTES;
  const usagePercent = Math.min((byteSize / (mode === "text" ? MAX_TEXT_BYTES : MAX_FILE_BYTES)) * 100, 100);


  const lineCount = useMemo(() => {
    if (!text) return 1;
    return text.split("\n").length;
  }, [text]);

  const lineNumbers = useMemo(() => {
    return Array.from({ length: Math.max(lineCount, 10) }, (_, i) => i + 1);
  }, [lineCount]);

  const handleScroll = () => {
    if (lineNumbersRef.current && textareaRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      toast.error(`"${file.name}" exceeds the 1.0 MB limit (${formatBytes(file.size)}).`);
      return;
    }
    setMode("file");
    setSelectedFile(file);
    toast.success(`Attached "${file.name}" (${formatBytes(file.size)})`);
  }

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      toast.error(`"${file.name}" exceeds the 1.0 MB limit (${formatBytes(file.size)}).`);
      return;
    }
    setMode("file");
    setSelectedFile(file);
    toast.success(`Attached "${file.name}" (${formatBytes(file.size)})`);
  }

  async function handleCreateSecret(e: React.SubmitEvent) {
    e.preventDefault();
    if (mode === "text" && (!text.trim() || isOverLimit)) return;
    if (mode === "file" && (!selectedFile || isOverLimit)) return;

    setIsEncrypting(true);
    try {
      let payloadToEncrypt: string;

      if (mode === "file" && selectedFile) {
        const base64Data = await readFileAsBase64(selectedFile);
        payloadToEncrypt = JSON.stringify({
          type: "file",
          name: selectedFile.name,
          size: selectedFile.size,
          mimeType: selectedFile.type || "application/octet-stream",
          data: base64Data,
        });
      } else {
        payloadToEncrypt = text;
      }

      const { ciphertext, iv, keyString } = await encryptSecret(payloadToEncrypt);


      if (passcode && passcode.length !== 6) {
        toast.error("Passcode must be exactly 6 digits (or leave blank).");
        return;
      }

      let passcodeHash: string | null = null;
      let passcodeSalt: string | null = null;

      if (passcode.length === 6) {
        passcodeSalt = generateSalt();
        passcodeHash = await hashPasscode(passcode, passcodeSalt);
      }

      const creator = (creatorName.trim() || creatorEmail.trim() || creatorSubject.trim())
        ? {
          name: creatorName.trim() || undefined,
          email: creatorEmail.trim() || undefined,
          subject: creatorSubject.trim() || undefined,
        }
        : null;

      const res = await fetch("/api/secrets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ciphertext,
          iv,
          ttl,
          burnOnRead,
          linkCount,
          passcodeHash,
          passcodeSalt,
          creator
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 429) {
          toast.warning(data.error || "Rate limit reached. Please try again later.");
          return;
        }
        throw new Error(data.error || "Storage failed");
      }

      const links = data.linkIds.map((id: string) => `${window.location.origin}/s/${id}#k=${keyString}`);
      setGeneratedLinkIds(data.linkIds);
      setGeneratedLinks(links);
      setRevocationToken(data.revocationToken || null);
      const activeTtl = typeof data.ttl === "number" ? data.ttl : ttl;
      setExpiresAt(Date.now() + activeTtl * 1000);
      setCountdown(activeTtl);
      setPasscode("");
      toast.success(
        data.linkIds.length > 1
          ? `${data.linkIds.length} zero-knowledge links generated!`
          : "Zero-knowledge secret link generated!"
      );
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Encryption or storage failed. Please check size bounds."
      );
    } finally {
      setIsEncrypting(false);
    }
  }

  async function handleRevokeLinks() {
    if (!generatedLinkIds.length || !revocationToken) {
      toast.warning("Generate links first before attempting revocation.");
      return;
    }
    setIsRevoking(true);
    try {
      const res = await fetch("/api/secrets/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          linkIds: generatedLinkIds,
          revocationToken,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 429) {
          toast.warning(data.error || "Too many revocation requests. Please wait.");
          return;
        }
        throw new Error(data.error || "Revocation failed");
      }
      toast.success("Secret revoked and permanently destroyed from server.");
      setGeneratedLinkIds([]);
      setGeneratedLinks([]);
      setRevocationToken(null);
      setPasscode("");
      setExpiresAt(null);
      setCountdown(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Link revocation failed.");
    } finally {
      setIsRevoking(false);
    }
  }

  function handleNewSecret() {
    setText("");
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setGeneratedLinks([]);
    setGeneratedLinkIds([]);
    setCreatorName("");
    setCreatorEmail("");
    setRevocationToken(null);
    setCreatorSubject("");
    setExpiresAt(null);
    setCountdown(null);
  }


  function handleCopy(url: string, index: number) {
    navigator.clipboard.writeText(url);
    setCopiedIndex(index);
    toast.success("Secret link copied to clipboard");
    setTimeout(() => setCopiedIndex(null), 2000);
  }

  function handleCopyAll() {
    navigator.clipboard.writeText(generatedLinks.join("\n"));
    setCopiedAll(true);
    toast.success("All secret links copied to clipboard");
    setTimeout(() => setCopiedAll(false), 2000);
  }

  return (
    <div className="w-full flex-1 flex flex-col items-center justify-start pt-8 sm:pt-12 md:pt-16 pb-14 px-3.5 sm:px-6 md:px-8 font-mono">
      <div className="w-full max-w-4xl flex flex-col bg-neutral-900/50 border border-neutral-700 rounded-2xl p-4 sm:p-6 md:p-8 shadow-2xl backdrop-blur-sm">
        {generatedLinks.length === 0 ? (
          <form
            onSubmit={handleCreateSecret}
            className="space-y-4 sm:space-y-5"
          >
            {/* Always mounted hidden input for file attachments */}
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              className="hidden"
              id="cloaker-file-upload"
            />

            {/* Mode Selector Segmented Tabs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="grid grid-cols-2 p-1 bg-neutral-950/90 border border-neutral-800/90 rounded-xl backdrop-blur-sm sm:inline-flex sm:w-auto shadow-inner">
                <button
                  type="button"
                  onClick={() => setMode("text")}
                  className={`flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer ${mode === "text"
                    ? "bg-neutral-800 text-white border border-neutral-700/80 shadow-md shadow-black/40 text-emerald-400"
                    : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50"
                    }`}
                >
                  <FileCode2 className={`w-4 h-4 transition ${mode === "text" ? "text-emerald-400 scale-105" : "text-neutral-500"}`} />
                  <span>Text / Code</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMode("file")}
                  className={`flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer ${mode === "file"
                    ? "bg-neutral-800 text-white border border-neutral-700/80 shadow-md shadow-black/40 text-emerald-400"
                    : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50"
                    }`}
                >
                  <Paperclip className={`w-4 h-4 transition ${mode === "file" ? "text-emerald-400 scale-105" : "text-neutral-500"}`} />
                  <span>File</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-medium ${mode === "file" ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800/60" : "bg-neutral-900 text-neutral-500"
                    }`}>
                    1 MB
                  </span>
                </button>
              </div>

              <div className="flex items-center gap-2 text-[11px] sm:text-xs text-neutral-400 self-end sm:self-auto pr-1">
                <ShieldAlert className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Client-Side AES-256-GCM Encrypted</span>
              </div>
            </div>

            {/* Main Terminal Window */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setIsDragging(false);
                }
              }}
              onDrop={handleFileDrop}
              className="relative w-full border border-neutral-800 rounded-xl overflow-hidden bg-neutral-950/90 shadow-inner focus-within:border-neutral-700 transition"
            >
              {/* Header Bar */}
              <div className="bg-neutral-900/90 px-3.5 py-2.5 sm:px-4 sm:py-3 border-b border-neutral-800 flex items-center justify-between text-xs text-neutral-400 select-none">
                <div className="flex items-center gap-2.5">
                  <div className="flex gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-neutral-700/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-neutral-700/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-neutral-700/80" />
                  </div>
                  <span className="text-[11px] sm:text-xs font-mono text-neutral-300 font-medium">
                    {mode === "text" ? "payload.txt" : selectedFile ? selectedFile.name : "attachment.bin"}
                  </span>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-[11px] font-mono">
                  {mode === "text" ? (
                    <>
                      <span>{lineCount} {lineCount === 1 ? "line" : "lines"}</span>
                      <span className="text-neutral-700">|</span>
                      <span className={isOverLimit ? "text-red-400 font-bold" : "text-neutral-400"}>
                        {formatBytes(byteSize)} / 512 KB
                      </span>
                    </>
                  ) : (
                    <span className={isOverLimit ? "text-red-400 font-bold" : "text-neutral-400"}>
                      {selectedFile ? `${formatBytes(selectedFile.size)} / 1.0 MB` : "Max 1.0 MB"}
                    </span>
                  )}
                </div>
              </div>

              {/* Drag Over Overlay for either mode */}
              {isDragging && (
                <div className="absolute inset-0 z-30 bg-neutral-950/95 border-2 border-dashed border-emerald-500 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-150">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-950/60 border border-emerald-500/50 flex items-center justify-center mb-3 shadow-xl shadow-emerald-950/50">
                    <UploadCloud className="w-7 h-7 text-emerald-400 animate-bounce" />
                  </div>
                  <p className="text-sm sm:text-base font-bold text-neutral-100">
                    Drop file to stage & encrypt
                  </p>
                  <p className="text-xs text-emerald-400 mt-1">
                    Supports any file up to 1.0 MB (.env, keys, configs, pdf, zip, etc.)
                  </p>
                </div>
              )}

              {/* Body: Text Editor and File Dropzone */}
              {mode === "text" ? (
                <>
                  <div className="relative flex h-[38dvh] min-h-56 sm:h-72 md:h-80 overflow-hidden font-mono text-xs sm:text-sm">
                    <div
                      ref={lineNumbersRef}
                      className="w-9 sm:w-11 py-3 sm:py-3.5 bg-neutral-950/80 border-r border-neutral-800 text-neutral-600 select-none overflow-hidden text-right pr-2 sm:pr-3 leading-6 font-medium shrink-0"
                    >
                      {lineNumbers.map((num) => (
                        <div key={num}>{num}</div>
                      ))}
                    </div>

                    <textarea
                      ref={textareaRef}
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      onScroll={handleScroll}
                      placeholder="# Paste sensitive configs, credentials, or keys..."
                      required={mode === "text"}
                      spellCheck={false}
                      className="flex-1 p-3 sm:p-3.5 bg-transparent text-neutral-200 placeholder-neutral-600 focus:outline-none resize-none leading-6 overflow-y-auto whitespace-pre font-mono selection:bg-emerald-950 selection:text-emerald-300 scheme-dark"
                    />
                  </div>
                </>
              ) : (
                <div className="relative flex flex-col items-center justify-center h-[38dvh] min-h-56 sm:h-72 md:h-80 p-4 sm:p-6 bg-neutral-950/60 font-mono">
                  {!selectedFile ? (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className={`w-full h-full border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-all duration-200 ${isDragging
                        ? "border-emerald-500 bg-emerald-950/30 scale-[0.99]"
                        : "border-neutral-800 hover:border-neutral-700 bg-neutral-900/20 hover:bg-neutral-900/40"
                        }`}
                    >
                      <div className="w-12 h-12 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center mb-3 shadow-inner">
                        <UploadCloud className="w-6 h-6 text-emerald-400" />
                      </div>
                      <p className="text-xs sm:text-sm font-semibold text-neutral-200">
                        Drop file here, or <span className="text-emerald-400 hover:underline">browse</span>
                      </p>
                      <p className="text-[11px] text-neutral-500 mt-1 max-w-sm">
                        Supports any file up to 1.0 MB (.env, keys, configs, pdf, images, archives)
                      </p>
                      <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 bg-neutral-900/80 border border-neutral-800 rounded-lg text-[10px] text-neutral-400">
                        <ShieldAlert className="w-3 h-3 text-emerald-400" />
                        Encrypted with AES-256-GCM in-browser before upload
                      </div>
                    </div>
                  ) : (
                    <div className="w-full max-w-md p-4 sm:p-5 bg-neutral-900/90 border border-neutral-800 rounded-xl space-y-3 shadow-2xl">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="w-10 h-10 rounded-xl bg-emerald-950/50 border border-emerald-800/60 flex items-center justify-center shrink-0">
                            <FileText className="w-5 h-5 text-emerald-400" />
                          </div>
                          <div className="overflow-hidden">
                            <p className="text-xs sm:text-sm font-semibold text-neutral-100 truncate" title={selectedFile.name}>
                              {selectedFile.name}
                            </p>
                            <p className="text-[11px] text-neutral-400 mt-0.5">
                              {formatBytes(selectedFile.size)} • {selectedFile.type || "binary/octet-stream"}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                          className="w-7 h-7 rounded-lg bg-neutral-800 hover:bg-red-950/60 hover:text-red-400 text-neutral-400 flex items-center justify-center transition cursor-pointer"
                          title="Remove file"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="pt-2.5 border-t border-neutral-800/80 flex items-center justify-between text-[11px] text-neutral-400">
                        <span className="flex items-center gap-1 text-emerald-400">
                          <Check className="w-3.5 h-3.5" /> Ready for encryption
                        </span>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="text-neutral-400 hover:text-neutral-200 underline cursor-pointer"
                        >
                          Change file
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Progress Bar */}
              <div className="h-1 w-full bg-neutral-900 overflow-hidden">
                <div
                  className={`h-full transition-all duration-200 ${isOverLimit ? "bg-red-500" : usagePercent > 80 ? "bg-amber-500" : "bg-emerald-500"
                    }`}
                  style={{ width: `${usagePercent}%` }}
                />
              </div>
            </div>

            {/* Controls */}
            <div>
              {/* Standard Controls */}
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-end">
                <div className="w-full sm:w-2/5">
                  <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 mb-1.5 sm:mb-2">
                    <Clock className="w-3.5 h-3.5 text-neutral-500" />
                    Destruction Window
                  </label>
                  <select
                    value={ttl}
                    onChange={(e) => setTtl(Number(e.target.value))}
                    className="w-full h-11 sm:h-12 bg-neutral-950/80 border border-neutral-800 rounded-xl px-3.5 text-xs sm:text-sm text-neutral-200 focus:outline-none focus:border-emerald-500 transition-colors scheme-dark cursor-pointer"
                  >
                    <option value={300}>5 Minutes</option>
                    <option value={3600}>1 Hour</option>
                    <option value={86400}>24 Hours</option>
                    <option value={604800}>7 Days</option>
                  </select>
                </div>

                {/* Advanced Settings Toggle Button */}
                <div className="w-full sm:w-3/5">
                  <button
                    type="button"
                    onClick={() => setAdvancedOpen((prev) => !prev)}
                    className="w-full h-11 sm:h-12 px-4 bg-neutral-950/80 border border-neutral-800 hover:border-neutral-700 text-neutral-300 rounded-xl text-xs sm:text-sm font-semibold transition flex items-center justify-between cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <Settings2 className="w-4 h-4 text-emerald-400" />
                      Advanced Options
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-neutral-400 transition-transform duration-200 ${advancedOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                </div>
              </div>

              {/* Advanced Settings Accordion Body */}
              <div
                className={`transition-all duration-300 ease-in-out overflow-hidden ${advancedOpen
                  ? "max-h-[900px] opacity-100 mt-4"
                  : "max-h-0 opacity-0 mt-0 pointer-events-none"
                  }`}
              >
                <div className="space-y-4">
                  {/* Card 1: Destruction Policy */}
                  <div className="p-4 sm:p-5 bg-neutral-950/80 border border-neutral-800 rounded-xl space-y-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                      Destruction Policy
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setBurnOnRead(true)}
                        className={`p-3.5 rounded-xl border text-left flex items-start gap-3 transition cursor-pointer ${burnOnRead
                          ? "bg-emerald-950/40 border-emerald-500/70 text-neutral-100 shadow-[0_0_14px_rgba(16,185,129,0.12)]"
                          : "bg-neutral-900/40 border-neutral-800/80 text-neutral-400 hover:border-neutral-700"
                          }`}
                      >
                        <Flame className={`w-4 h-4 mt-0.5 shrink-0 ${burnOnRead ? "text-emerald-400" : "text-neutral-500"}`} />
                        <div>
                          <div className="text-xs font-semibold">Delete after reading</div>
                          <div className="text-[11px] text-neutral-500 mt-0.5">Link destroys instantly once opened</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setBurnOnRead(false)}
                        className={`p-3.5 rounded-xl border text-left flex items-start gap-3 transition cursor-pointer ${!burnOnRead
                          ? "bg-emerald-950/40 border-emerald-500/70 text-neutral-100 shadow-[0_0_14px_rgba(16,185,129,0.12)]"
                          : "bg-neutral-900/40 border-neutral-800/80 text-neutral-400 hover:border-neutral-700"
                          }`}
                      >
                        <Hourglass className={`w-4 h-4 mt-0.5 shrink-0 ${!burnOnRead ? "text-emerald-400" : "text-neutral-500"}`} />
                        <div>
                          <div className="text-xs font-semibold">Destroy on expire only</div>
                          <div className="text-[11px] text-neutral-500 mt-0.5">Reusable until time window elapses</div>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Card: Optional Creator Info & Subject */}
                  <div className="p-4 sm:p-5 bg-neutral-950/80 border border-neutral-800 rounded-xl space-y-3.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-emerald-400" />
                          Sender Attribution & Subject (Optional)
                        </div>
                        <div className="text-[11px] text-neutral-500 mt-0.5">
                          Displayed to the recipient on the reveal page for context & verification
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 pt-1">
                      {/* Name and Email Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="relative">
                          <User className="w-3.5 h-3.5 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            type="text"
                            maxLength={60}
                            value={creatorName}
                            onChange={(e) => setCreatorName(e.target.value)}
                            placeholder="Your Name"
                            className="w-full h-10 bg-neutral-900/60 border border-neutral-800 focus:border-emerald-500 rounded-xl pl-9 pr-3.5 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none transition"
                          />
                        </div>

                        <div className="relative">
                          <Mail className="w-3.5 h-3.5 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            type="email"
                            maxLength={100}
                            value={creatorEmail}
                            onChange={(e) => setCreatorEmail(e.target.value)}
                            readOnly
                            onFocus={(e) => e.target.removeAttribute("readonly")}
                            placeholder="Your Email"
                            className="w-full h-10 bg-neutral-900/60 border border-neutral-800 focus:border-emerald-500 rounded-xl pl-9 pr-3.5 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none transition"
                          />
                        </div>
                      </div>

                      {/* Subject / Title */}
                      <div className="relative">
                        <Tag className="w-3.5 h-3.5 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          maxLength={120}
                          value={creatorSubject}
                          onChange={(e) => setCreatorSubject(e.target.value)}
                          placeholder="Note Subject"
                          className="w-full h-10 bg-neutral-900/60 border border-neutral-800 focus:border-emerald-500 rounded-xl pl-9 pr-3.5 text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none transition"
                        />
                      </div>


                    </div>
                  </div>


                  {/* Card 2: Generated Links (Pointer References) */}
                  <div className="p-4 sm:p-5 bg-neutral-950/80 border border-neutral-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-emerald-400" />
                        Multi-Link Generation
                      </div>
                      <div className="text-[11px] text-neutral-500 mt-0.5">
                        Create 1-3 independent links sharing 1 encrypted master payload
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto bg-neutral-900/90 border border-neutral-800 rounded-lg p-1">
                      <button
                        type="button"
                        disabled={linkCount <= 1}
                        onClick={() => setLinkCount((c) => Math.max(1, c - 1))}
                        className="w-8 h-8 flex items-center justify-center rounded-md bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 text-neutral-300 transition cursor-pointer"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-8 text-center text-xs font-bold text-neutral-200">
                        {linkCount}
                      </span>
                      <button
                        type="button"
                        disabled={linkCount >= 3}
                        onClick={() => setLinkCount((c) => Math.min(3, c + 1))}
                        className="w-8 h-8 flex items-center justify-center rounded-md bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 text-neutral-300 transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Card 3: 6-Digit Passcode Gate */}
                  <div className="p-4 sm:p-5 bg-neutral-950/80 border border-neutral-800 rounded-xl space-y-3.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
                          <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
                          6-Digit Passcode Gate (Optional)
                        </div>
                        <div className="text-[11px] text-neutral-500 mt-0.5">
                          Self-destructs if recipient fails 3 passcode attempts
                        </div>
                      </div>

                      {passcode.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setPasscode("")}
                          className="text-[11px] text-neutral-400 hover:text-red-400 transition cursor-pointer"
                        >
                          Clear PIN
                        </button>
                      )}
                    </div>

                    <div className="pt-1">
                      <PasscodeInput
                        value={passcode}
                        onChange={setPasscode}
                      />
                    </div>
                  </div>
                </div>
              </div>


              {/* Submit Button */}
              <button
                type="submit"
                disabled={
                  isEncrypting ||
                  (mode === "text" ? !text.trim() || isOverLimit : !selectedFile || isOverLimit)
                }
                className="w-full mt-4 h-11 sm:h-12 px-6 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-neutral-950 font-bold rounded-xl text-xs sm:text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 cursor-pointer active:scale-[0.99]"
              >
                {isEncrypting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin" />
                    Encrypting In-Memory...
                  </>
                ) : mode === "file" && selectedFile ? (
                  <>
                    <FileUp className="w-4 h-4" />
                    Encrypt & Send &quot;{selectedFile.name}&quot;
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    {linkCount > 1
                      ? `Create ${linkCount} Encrypted Links`
                      : "Create Encrypted Link"}
                  </>
                )}
              </button>

              {/* Live Settings Status Line */}
              <div className="flex items-center justify-center gap-2 text-[11px] text-neutral-500 select-none mt-2 flex-wrap">
                {mode === "file" && selectedFile && (
                  <>
                    <span className="text-emerald-400/90 font-medium truncate max-w-[150px]">
                      {selectedFile.name} ({formatBytes(selectedFile.size)})
                    </span>
                    <span>•</span>
                  </>
                )}
                <span>
                  {ttl === 300
                    ? "5 Minutes"
                    : ttl === 3600
                      ? "1 Hour"
                      : ttl === 86400
                        ? "24 Hours"
                        : "7 Days"}
                </span>
                <span>•</span>
                <span>{burnOnRead ? "Delete after read" : "Reusable until expiry"}</span>
                <span>•</span>
                <span>
                  {linkCount === 1
                    ? burnOnRead
                      ? "1 Single-use link"
                      : "1 Reusable link"
                    : `${linkCount} Independent links`}
                </span>
                {passcode.length === 6 && (
                  <>
                    <span>•</span>
                    <span className="text-emerald-400/90 font-medium">PIN Protected (3 Strikes)</span>
                  </>
                )}

              </div>
            </div>

          </form>
        ) : (
          <div className="space-y-5 py-2">
            <div className="p-4 sm:p-5 bg-emerald-950/30 border border-emerald-800/50 rounded-xl text-emerald-300 text-xs sm:text-sm flex gap-3.5 items-start">
              <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-emerald-400" />
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-emerald-200">
                    {generatedLinks.length > 1
                      ? `${generatedLinks.length} Zero-Knowledge Links Ready`
                      : "Zero-Knowledge Link Generated"}
                  </p>
                  {countdown !== null && (
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-mono text-[11px] font-semibold tracking-wider shrink-0 ${countdown === 0
                      ? "bg-red-950/80 border-red-700 text-red-300 animate-pulse"
                      : countdown <= 60
                        ? "bg-red-950/60 border-red-800/80 text-red-300 animate-pulse"
                        : countdown <= 300
                          ? "bg-amber-950/60 border-amber-800/80 text-amber-300"
                          : "bg-emerald-950/80 border-emerald-700/60 text-emerald-300"
                      }`}>
                      <Clock className={`w-3.5 h-3.5 ${countdown <= 60 ? "text-red-400" : "text-emerald-400"} animate-pulse`} />
                      <span>{countdown === 0 ? "EXPIRED" : `Expires in ${formatCountdown(countdown)}`}</span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-emerald-400/90 leading-relaxed">
                  The key resides only in the URL fragment (<span className="font-mono">#k=...</span>)
                  and was never sent over HTTP.{" "}
                  {burnOnRead
                    ? "Each link will destroy its access pointer once viewed."
                    : "Links remain accessible until the time window expires."}
                </p>
              </div>
            </div>

            {/* Links List */}
            <div className="space-y-3">
              {generatedLinks.map((url, index) => (
                <div
                  key={url}
                  className="p-3 sm:p-4 bg-neutral-950/90 border border-neutral-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  {/* Dedicated full line for Link on mobile */}
                  <div className="w-full sm:flex-1 min-w-0">
                    <div className="flex items-center gap-2 bg-neutral-900/60 sm:bg-transparent border border-neutral-800/80 sm:border-0 rounded-lg px-2.5 py-2 sm:p-0 text-emerald-400 font-mono text-xs select-all">
                      <Link2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span className="truncate block" title={url}>
                        {url}
                      </span>
                    </div>
                  </div>

                  {/* Buttons in line below on mobile, aligned inline on desktop */}
                  <div className="flex items-center justify-end gap-2 w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t border-neutral-900/80 sm:border-0">
                    {/* Card & QR Trigger Button */}
                    <button
                      type="button"
                      onClick={() => setSelectedCardUrl(url)}
                      className="flex-1 sm:flex-initial h-8 px-3 bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-800/60 text-emerald-300 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95"
                      title="View & Export Share Card"
                    >
                      <QrCode className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Card & QR</span>
                    </button>

                    {/* Copy Link Button */}
                    <button
                      type="button"
                      onClick={() => handleCopy(url, index)}
                      className="flex-1 sm:flex-initial sm:w-28 h-8 px-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95"
                    >
                      {copiedIndex === index ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 shrink-0" />
                      )}
                      <span>{copiedIndex === index ? "Copied" : `Copy Link ${generatedLinks.length > 1 ? `#${index + 1}` : ""}`}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Bulk Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              {generatedLinks.length > 1 && (
                <button
                  onClick={handleCopyAll}
                  className="w-full sm:flex-1 h-11 sm:h-12 bg-neutral-100 text-neutral-950 hover:bg-white rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer active:scale-[0.99]"
                >
                  {copiedAll ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  {copiedAll ? "All Links Copied" : "Copy All Links"}
                </button>
              )}
              {generatedLinks.length > 0 && (
                <button
                  onClick={handleRevokeLinks}
                  disabled={isRevoking}
                  className="w-full sm:flex-1 h-11 sm:h-12 px-5 bg-red-950/60 hover:bg-red-900/80 border border-red-800/80 disabled:opacity-50 text-red-300 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer active:scale-[0.99]"
                >
                  {isRevoking ? (
                    <>
                      <div className="w-4 h-4 border-2 border-red-300 border-t-transparent rounded-full animate-spin" />
                      Revoking...
                    </>
                  ) : (
                    <>
                      <Flame className="w-4 h-4 text-red-400" />
                      Revoke {generatedLinks.length > 1 ? "All Links" : "Link"}
                    </>
                  )}
                </button>
              )}
              <button
                onClick={handleNewSecret}
                className="w-full sm:flex-1 h-11 sm:h-12 px-5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-xs sm:text-sm font-semibold transition flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
              >
                <RefreshCw className="w-4 h-4" />
                New Secret
              </button>
            </div>
          </div>

        )}
      </div>
      <ShareCardModal
        isOpen={Boolean(selectedCardUrl)}
        onClose={() => setSelectedCardUrl(null)}
        url={selectedCardUrl || ""}
        creator={{
          name: creatorName || undefined,
          email: creatorEmail || undefined,
          subject: creatorSubject || undefined,
        }}
        burnOnRead={burnOnRead}
        ttl={ttl}
        hasPasscode={passcode.length === 6}
      />

    </div >
  );
}
