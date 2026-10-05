"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { decryptSecret } from "@/lib/crypto";
import {
  ShieldAlert,
  Flame,
  Check,
  Copy,
  Download,
  ArrowRight,
  Unlock,
  KeyRound,
  AlertTriangle,
  User, Tag,
  FileText,
  FileCode2,
  ChevronDown
} from "lucide-react";
import { PasscodeInput } from "@/components/PasscodeInput";
import { toast } from "@/components/Toast";

import Link from "next/link";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

interface DecryptedFile {
  name: string;
  size: number;
  mimeType: string;
  data: string;
}

export default function RevealPage() {
  const { id } = useParams<{ id: string }>();
  const [metaLoading, setMetaLoading] = useState(true);
  const [exists, setExists] = useState(false);
  const [isBurning, setIsBurning] = useState(false);
  const [secretContent, setSecretContent] = useState<string | null>(null);
  const [decryptedFile, setDecryptedFile] = useState<DecryptedFile | null>(null);
  const [filePreviewText, setFilePreviewText] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [burnOnRead, setBurnOnRead] = useState(true);

  const [hasPasscode, setHasPasscode] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [passcodeError, setPasscodeError] = useState<string | null>(null);
  const [remainingStrikes, setRemainingStrikes] = useState<number | null>(null);
  const [shake, setShake] = useState(false);

  const [creator, setCreator] = useState<{ name?: string; email?: string; subject?: string } | null>(null);

  useEffect(() => {
    async function checkMetadata() {
      try {
        const res = await fetch(`/api/secrets/${id}/meta`, { method: "GET" });
        if (res.ok) {
          const data = await res.json();
          setExists(true);
          setCreator(data.creator || null);
          setBurnOnRead(data.burnOnRead ?? true);
          setHasPasscode(Boolean(data.hasPasscode));
          if (data.remainingStrikes !== undefined) {
            setRemainingStrikes(data.remainingStrikes);
          }
        }
        else {
          setExists(false);
        }
      } catch {
        setError("Network error contacting security service.");
      } finally {
        setMetaLoading(false);
      }
    }

    checkMetadata();
  }, [id]);

  async function handleReveal(e?: React.SubmitEvent) {
    if (e) e.preventDefault();
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const key = hash.startsWith("#k=") ? hash.replace("#k=", "") : null;

    if (!key) {
      setError("Decryption key missing from URL fragment.");
      return;
    }

    if (hasPasscode && passcode.length !== 6) {
      setPasscodeError("Enter the full 6-digit PIN.");
      return;
    }

    setIsBurning(true);
    setPasscodeError(null);

    try {
      const res = await fetch(`/api/secrets/${id}/burn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode: hasPasscode ? passcode : null })
      });

      const data = await res.json();

      if (res.status === 401) {
        const remaining = data.remainingStrikes ?? (remainingStrikes ? remainingStrikes - 1 : 2);
        setRemainingStrikes(remaining);
        setPasscodeError(
          `Incorrect passcode. ${remaining} ${remaining === 1 ? "attempt" : "attempts"} remaining before self-destruction.`
        );
        setPasscode("");
        setShake(true);
        setTimeout(() => setShake(false), 500);
        return;
      }

      if (!res.ok) {
        throw new Error(
          data.error || "Secret has expired or was already read.",
        );
      }

      const plainText = await decryptSecret(data.ciphertext, data.iv, key);

      // Check if decrypted payload is an attached file envelope
      let parsedFile: DecryptedFile | null = null;
      try {
        const parsed = JSON.parse(plainText);
        if (parsed && parsed.type === "file" && parsed.data) {
          parsedFile = parsed;
        }
      } catch {
        // Plain text legacy payload
      }

      if (parsedFile) {
        setDecryptedFile(parsedFile);
        const isTextLike =
          parsedFile.mimeType.startsWith("text/") ||
          parsedFile.mimeType.includes("json") ||
          /\.(env|txt|json|yaml|yml|md|js|ts|jsx|tsx|py|sh|sql|pem|key|crt|csv)$/i.test(parsedFile.name);

        if (isTextLike) {
          try {
            setFilePreviewText(atob(parsedFile.data));
          } catch {
            // Binary fallback
          }
        }
      } else {
        setSecretContent(plainText);
      }
      window.history.replaceState(null, "", window.location.pathname);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to decrypt. Note may be corrupted.",
      );
    } finally {
      setIsBurning(false);
    }
  }

  function handleDownloadFile() {
    if (!decryptedFile) return;
    try {
      const binaryString = atob(decryptedFile.data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: decryptedFile.mimeType || "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = decryptedFile.name;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${decryptedFile.name}`);
    } catch {
      toast.error("Failed to decode and download file.");
    }
  }

  function handleCopy() {
    if (!secretContent) return;
    navigator.clipboard.writeText(secretContent);
    setCopied(true);
    toast.success("Secret copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownload() {
    if (!secretContent) return;
    const blob = new Blob([secretContent], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `secret-${id.slice(0, 8)}.txt`;
    link.click();
    toast.success(`Downloaded secret-${id.slice(0, 8)}.txt`);
    URL.revokeObjectURL(url);
  }

  if (metaLoading) {
    return (
      <div className="min-h-dvh w-full flex flex-col items-center justify-center font-mono text-xs gap-3 p-4">
        <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <span>Verifying cryptographic state...</span>
      </div>
    );
  }

  return (
    <div className="w-full flex-1 flex flex-col items-center justify-start pt-8 sm:pt-12 md:pt-16 pb-14 px-3.5 sm:px-6 md:px-8 font-mono">
      <div className="w-full max-w-4xl flex flex-col bg-neutral-900/50 border border-neutral-700 rounded-2xl p-4 sm:p-6 md:p-8 shadow-2xl backdrop-blur-sm">
        {!exists || error ? (
          <div className="text-center space-y-5 py-8 sm:py-12">
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-red-950/60 border border-red-800/80 rounded-2xl flex items-center justify-center mx-auto text-red-400 shadow-inner">
              <Flame className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-base sm:text-lg font-bold text-neutral-200">
                Secret Expired or Destroyed
              </h2>
              <p className="text-xs sm:text-sm text-neutral-400 max-w-md mx-auto leading-relaxed px-2">
                {error ||
                  "This note was already accessed and burned, exceeded its lifetime window, or never existed."}
              </p>
            </div>
            <div className="pt-2">
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl text-xs font-semibold transition"
              >
                Create a New Secret <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        ) : (!secretContent && !decryptedFile) ? (
          <div className="flex-1 flex flex-col justify-center space-y-6 py-4">
            {/* Optional Sender Attribution Card */}
            {creator && (creator.subject || creator.name || creator.email) && (
              <div className="p-3.5 sm:p-4 bg-neutral-950/70 border border-neutral-800/80 rounded-xl space-y-2 mb-4">
                {creator.subject && (
                  <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-neutral-100">
                    <Tag className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="truncate">{creator.subject}</span>
                  </div>
                )}
                {(creator.name || creator.email) && (
                  <div className="flex items-center gap-2 text-[11px] sm:text-xs text-neutral-400">
                    <User className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                    <span>
                      Sent by{" "}
                      {creator.name && <strong className="text-neutral-200 font-semibold">{creator.name}</strong>}
                      {creator.name && creator.email && " "}
                      {creator.email && <span className="text-neutral-500 font-mono">({creator.email})</span>}
                    </span>
                  </div>
                )}
              </div>
            )}

            {hasPasscode ? (
              <form onSubmit={handleReveal} className="space-y-6 py-2">
                {/* Passcode Security Banner */}
                <div className="p-4 sm:p-5 bg-neutral-950/90 border border-neutral-800 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-semibold text-neutral-200">
                      <KeyRound className="w-4 h-4 text-emerald-400" />
                      Passcode Protected Secret
                    </div>
                    {remainingStrikes !== null && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-950/50 border border-amber-800/60 rounded-lg text-[11px] font-semibold text-amber-300">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        {remainingStrikes} of 3 attempts left
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    The sender protected this note with a 6-digit PIN.{" "}
                    <span className="text-amber-400/90 font-medium">
                      Entering 3 incorrect attempts triggers instant self-destruction.
                    </span>
                  </p>
                </div>

                {/* 6-Digit OTP Box Input */}
                <div className="space-y-3">
                  <PasscodeInput
                    value={passcode}
                    onChange={(val) => {
                      setPasscode(val);
                      if (passcodeError) setPasscodeError(null);
                    }}
                    disabled={isBurning}
                    hasError={Boolean(passcodeError)}
                    autoFocus
                    shake={shake}
                  />

                  {passcodeError && (
                    <p className="text-xs text-red-400 text-center font-medium animate-fadeIn">
                      {passcodeError}
                    </p>
                  )}
                </div>

                {/* Unlock Button */}
                <button
                  type="submit"
                  disabled={isBurning || passcode.length !== 6}
                  className="w-full h-12 sm:h-14 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-neutral-950 font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2.5 transition shadow-lg shadow-emerald-950/40 cursor-pointer active:scale-[0.99]"
                >
                  {isBurning ? (
                    <>
                      <div className="w-4 h-4 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin" />
                      Verifying & Decrypting...
                    </>
                  ) : (
                    <>
                      <Unlock className="w-4 h-4 text-neutral-950" />
                      Unlock & Decrypt Secret
                    </>
                  )}
                </button>
              </form>
            ) : (

              <>
                <div className="p-4 sm:p-5 bg-emerald-950/30 border border-emerald-800/40 rounded-xl text-emerald-300 text-xs sm:text-sm flex gap-3.5 items-start">
                  <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-emerald-400" />
                  <div className="space-y-1">
                    <p className="font-semibold text-emerald-200">
                      {burnOnRead ? "Self-Destruction Warning" : "Reusable Link"}
                    </p>
                    <p className="text-xs text-emerald-300/80 leading-relaxed">
                      {burnOnRead
                        ? "Revealing this note triggers an atomic deletion request on our storage layer. Once decrypted, it will be wiped from memory and cannot be recovered."
                        : "This secret link will remain available until its expiration window closes."}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => handleReveal()}
                  disabled={isBurning}
                  className="w-full h-12 sm:h-14 bg-emerald-700/90 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2.5 transition shadow-lg shadow-emerald-950/50 cursor-pointer active:scale-[0.99]"
                >
                  {isBurning ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      {burnOnRead ? "Destroying on Server & Decrypting..." : "Decrypting Payload..."}
                    </>
                  ) : burnOnRead ? (
                    <>
                      <Flame className="w-4 h-4 sm:w-5 sm:h-5" />
                      Reveal & Permanently Destroy
                    </>
                  ) : (
                    <>
                      <Unlock className="w-4 h-4 sm:w-5 sm:h-5" />
                      Decrypt Secret
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        ) : decryptedFile ? (
          /* ─── DECRYPTED FILE VIEW ─── */
          <div className="space-y-5">
            <div className="w-full border border-neutral-800 rounded-xl overflow-hidden bg-neutral-950/90 shadow-2xl">
              <div className="bg-neutral-900/90 px-3.5 py-2.5 sm:px-4 sm:py-3 border-b border-neutral-800 flex items-center justify-between text-xs select-none">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-emerald-400 font-semibold tracking-wide text-[11px] sm:text-xs">
                    DECRYPTED ATTACHMENT ({formatBytes(decryptedFile.size)})
                  </span>
                </div>
              </div>

              {/* File Info Banner */}
              <div className="p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 bg-neutral-950/60">
                <div className="flex items-center gap-3.5 overflow-hidden w-full sm:w-auto">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-950/50 border border-emerald-800/60 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-950/20">
                    <FileText className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div className="overflow-hidden">
                    <h3 className="text-sm sm:text-base font-bold text-neutral-100 truncate" title={decryptedFile.name}>
                      {decryptedFile.name}
                    </h3>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      {formatBytes(decryptedFile.size)} • {decryptedFile.mimeType || "application/octet-stream"}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadFile}
                  className="w-full sm:w-auto px-5 py-3 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-950/40 cursor-pointer active:scale-95 shrink-0"
                >
                  <Download className="w-4 h-4" />
                  Download File
                </button>
              </div>

              {/* Optional Inline Preview for Configs/Code */}
              {filePreviewText !== null && (
                <div className="border-t border-neutral-800/80">
                  <button
                    type="button"
                    onClick={() => setShowPreview((p) => !p)}
                    className="w-full px-4 py-2.5 bg-neutral-900/60 hover:bg-neutral-900 text-neutral-300 text-xs font-semibold flex items-center justify-between transition cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <FileCode2 className="w-3.5 h-3.5 text-emerald-400" />
                      Preview File Contents
                    </span>
                    <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform ${showPreview ? "rotate-180" : ""}`} />
                  </button>

                  {showPreview && (
                    <div className="max-h-72 overflow-auto font-mono text-xs p-4 bg-neutral-950 text-neutral-200 whitespace-pre leading-5 border-t border-neutral-800/60">
                      {filePreviewText}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between text-[11px] sm:text-xs text-neutral-500 pt-1 gap-2.5 text-center sm:text-left">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-neutral-600" />
                {burnOnRead ? "Ciphertext destroyed on server" : "Secret link valid until expiry"}
              </span>
              <Link
                href="/"
                className="text-white bg-emerald-700/60 rounded-full p-1.5 px-2 hover:text-emerald-300 transition"
              >
                <span className="flex items-center gap-1 font-medium">
                  Send your own secret <ArrowRight className="w-3 h-3" />
                </span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Decrypted Payload Terminal */}
            <div className="w-full border border-neutral-800 rounded-xl overflow-hidden bg-neutral-950/90 shadow-inner">
              <div className="bg-neutral-900/90 px-3.5 py-2.5 sm:px-4 sm:py-3 border-b border-neutral-800 flex flex-wrap items-center justify-between gap-2.5 text-xs select-none">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-emerald-400 font-semibold tracking-wide text-[11px] sm:text-xs">
                    DECRYPTED PAYLOAD (
                    {formatBytes(new Blob([secretContent || ""]).size)})
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-1.5 text-[11px] text-neutral-400 hover:text-neutral-200 bg-neutral-950 border border-neutral-800 hover:border-neutral-700 px-2.5 py-1.5 sm:px-3 rounded-lg transition cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </button>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 text-[11px] text-neutral-950 font-bold bg-neutral-100 hover:bg-white px-2.5 py-1.5 sm:px-3 rounded-lg transition cursor-pointer active:scale-95"
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copied ? "Copied" : "Copy Raw"}</span>
                  </button>
                </div>
              </div>

              <div className="h-[46dvh] min-h-85 sm:h-auto sm:min-h-65 sm:max-h-115 overflow-auto font-mono text-xs sm:text-sm leading-6 scheme-dark max-w-full">
                <div className="flex min-w-full w-max min-h-full sm:min-h-65">
                  <div className="sticky left-0 z-10 w-9 sm:w-12 py-3 sm:py-3.5 bg-neutral-950 border-r border-neutral-800 text-neutral-600 select-none text-right pr-2 sm:pr-3.5 font-medium shrink-0">
                    {(secretContent || "").split("\n").map((_, i) => (
                      <div key={i}>{i + 1}</div>
                    ))}
                  </div>

                  <pre className="flex-1 p-3 sm:p-3.5 text-neutral-200 whitespace-pre selection:bg-emerald-950 selection:text-emerald-300 font-mono">
                    {secretContent}
                  </pre>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between text-[11px] sm:text-xs text-neutral-500 pt-1 gap-2.5 text-center sm:text-left">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-neutral-600" />
                {burnOnRead ? "Ciphertext destroyed on server" : "Secret link valid until expiry"}
              </span>
              <Link
                href="/"
                className="text-white bg-emerald-700/60 rounded-full p-1.5 px-2 hover:text-emerald-300 transition"
              >
                <span className="flex items-center gap-1 font-medium">
                  Send your own secret <ArrowRight className="w-3 h-3" />
                </span>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
