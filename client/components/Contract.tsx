"use client";

import { useState, useCallback, useEffect } from "react";
import {
  createWallet,
  getWallet,
  getWallets,
  proposeTransfer,
  getTransaction,
  getTransactionCount,
  signTransaction,
  deposit,
  CONTRACT_ADDRESS,
} from "@/hooks/contract";
import { AnimatedCard } from "@/components/ui/animated-card";
import { Spotlight } from "@/components/ui/spotlight";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ── Icons ────────────────────────────────────────────────────

function SpinnerIcon() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function CoinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v12" />
      <path d="M8 10h8" />
      <path d="M8 14h8" />
    </svg>
  );
}

// ── Types ─────────────────────────────────────────────────────

interface WalletInfo {
  signers: string[];
  threshold: number;
  balance: string;
  token: string;
}

interface TxInfo {
  target: string;
  amount: string;
  signed_count: number;
  executed: boolean;
}

// ── Styled Input ─────────────────────────────────────────────

function Input({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-2">
      <label className="block text-[11px] font-medium uppercase tracking-wider text-white/30">
        {label}
      </label>
      <div className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-px transition-all focus-within:border-[#7c6cf0]/30 focus-within:shadow-[0_0_20px_rgba(124,108,240,0.08)]">
        <input
          {...props}
          className="w-full rounded-[11px] bg-transparent px-4 py-3 font-mono text-sm text-white/90 placeholder:text-white/15 outline-none"
        />
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────

type Tab = "wallets" | "propose" | "transactions";

interface ContractUIProps {
  walletAddress: string | null;
  onConnect: () => void;
  isConnecting: boolean;
}

export default function ContractUI({ walletAddress, onConnect, isConnecting }: ContractUIProps) {
  const [activeTab, setActiveTab] = useState<Tab>("wallets");
  const [error, setError] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<string | null>(null);

  // Wallet creation
  const [newWalletId, setNewWalletId] = useState("");
  const [newSigners, setNewSigners] = useState("");
  const [newThreshold, setNewThreshold] = useState("2");
  const [newToken, setNewToken] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Deposit
  const [depositAmount, setDepositAmount] = useState("");
  const [isDepositing, setIsDepositing] = useState(false);

  // Wallets list
  const [wallets, setWallets] = useState<string[]>([]);
  const [isLoadingWallets, setIsLoadingWallets] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  const [selectedWalletInfo, setSelectedWalletInfo] = useState<WalletInfo | null>(null);

  // Propose
  const [proposeTarget, setProposeTarget] = useState("");
  const [proposeAmount, setProposeAmount] = useState("");
  const [isProposing, setIsProposing] = useState(false);

  // Transactions
  const [txs, setTxs] = useState<{ index: number; info: TxInfo }[]>([]);
  const [isLoadingTxs, setIsLoadingTxs] = useState(false);
  const [isSigning, setIsSigning] = useState<number | null>(null);

  const truncate = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  // ── Load wallets ──────────────────────────────────────────

  const loadWallets = useCallback(async () => {
    setIsLoadingWallets(true);
    try {
      const result = await getWallets(walletAddress || undefined);
      if (result) setWallets(result as string[]);
    } catch { /* ignore */ }
    setIsLoadingWallets(false);
  }, [walletAddress]);

  useEffect(() => { loadWallets(); }, [loadWallets]);

  // ── Load selected wallet ──────────────────────────────────

  const loadSelectedWallet = useCallback(async (walletId: string) => {
    try {
      const result = await getWallet(walletId, walletAddress || undefined);
      if (result) {
        const r = result as { 
          signers: { toString(): string }[]; 
          threshold: number;
          balance: string;
          token: { toString(): string };
        };
        setSelectedWalletInfo({ 
          signers: r.signers.map(s => s.toString()), 
          threshold: r.threshold,
          balance: r.balance,
          token: r.token.toString(),
        });
      }
    } catch { /* ignore */ }
  }, [walletAddress]);

  useEffect(() => {
    if (selectedWallet) loadSelectedWallet(selectedWallet);
  }, [selectedWallet, loadSelectedWallet]);

  // ── Load transactions ─────────────────────────────────────

  const loadTransactions = useCallback(async (walletId: string) => {
    setIsLoadingTxs(true);
    try {
      const count = await getTransactionCount(walletId, walletAddress || undefined) as number;
      const loaded: { index: number; info: TxInfo }[] = [];
      for (let i = 0; i < count; i++) {
        const tx = await getTransaction(walletId, i, walletAddress || undefined) as {
          target: { toString(): string };
          amount: string;
          signed_count: number;
          executed: boolean;
        } | null;
        if (tx) {
          loaded.push({
            index: i,
            info: {
              target: tx.target.toString(),
              amount: tx.amount,
              signed_count: tx.signed_count,
              executed: tx.executed,
            },
          });
        }
      }
      setTxs(loaded);
    } catch { /* ignore */ }
    setIsLoadingTxs(false);
  }, [walletAddress]);

  useEffect(() => {
    if (selectedWallet && activeTab === "transactions") {
      loadTransactions(selectedWallet);
    }
  }, [selectedWallet, activeTab, loadTransactions]);

  // ── Create Wallet ─────────────────────────────────────────

  const handleCreateWallet = useCallback(async () => {
    if (!walletAddress) return setError("Connect wallet first");
    if (!newWalletId.trim()) return setError("Enter a wallet ID");
    const signerList = newSigners.split(",").map(s => s.trim()).filter(Boolean);
    if (signerList.length < 2) return setError("Enter at least 2 signers (comma-separated)");
    const threshold = parseInt(newThreshold, 10);
    if (isNaN(threshold) || threshold < 1 || threshold > signerList.length) {
      return setError(`Threshold must be between 1 and ${signerList.length}`);
    }
    if (!newToken.trim()) return setError("Enter a token address");
    setError(null);
    setIsCreating(true);
    setTxStatus("Awaiting signature...");
    try {
      await createWallet(walletAddress, newWalletId.trim(), signerList, threshold, newToken.trim());
      setTxStatus("Wallet created on-chain!");
      setNewWalletId("");
      setNewSigners("");
      setNewThreshold("2");
      setNewToken("");
      await loadWallets();
      setSelectedWallet(newWalletId.trim());
      setTimeout(() => setTxStatus(null), 5000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Transaction failed");
      setTxStatus(null);
    } finally {
      setIsCreating(false);
    }
  }, [walletAddress, newWalletId, newSigners, newThreshold, newToken, loadWallets]);

  // ── Deposit ───────────────────────────────────────────────

  const handleDeposit = useCallback(async () => {
    if (!walletAddress || !selectedWallet) return setError("Select a wallet first");
    if (!depositAmount.trim() || isNaN(parseFloat(depositAmount))) return setError("Enter a valid amount");
    const amount = BigInt(Math.floor(parseFloat(depositAmount) * 1e7));
    if (amount <= 0n) return setError("Amount must be positive");
    setError(null);
    setIsDepositing(true);
    setTxStatus("Awaiting signature...");
    try {
      await deposit(walletAddress, selectedWallet, walletAddress, amount);
      setTxStatus("Deposit successful!");
      setDepositAmount("");
      await loadSelectedWallet(selectedWallet);
      setTimeout(() => setTxStatus(null), 5000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Transaction failed");
      setTxStatus(null);
    } finally {
      setIsDepositing(false);
    }
  }, [walletAddress, selectedWallet, depositAmount, loadSelectedWallet]);

  // ── Propose Transfer ─────────────────────────────────────

  const handlePropose = useCallback(async () => {
    if (!walletAddress || !selectedWallet) return setError("Select a wallet first");
    if (!proposeTarget.trim()) return setError("Enter a target address");
    if (!proposeAmount.trim() || isNaN(parseFloat(proposeAmount))) return setError("Enter a valid amount");
    const amount = BigInt(Math.floor(parseFloat(proposeAmount) * 1e7));
    if (amount <= 0n) return setError("Amount must be positive");
    setError(null);
    setIsProposing(true);
    setTxStatus("Awaiting signature...");
    try {
      await proposeTransfer(walletAddress, selectedWallet, proposeTarget.trim(), amount);
      setTxStatus("Transfer proposed!");
      setProposeTarget("");
      setProposeAmount("");
      await loadTransactions(selectedWallet);
      setTimeout(() => setTxStatus(null), 5000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Transaction failed");
      setTxStatus(null);
    } finally {
      setIsProposing(false);
    }
  }, [walletAddress, selectedWallet, proposeTarget, proposeAmount, loadTransactions]);

  // ── Sign Transaction ─────────────────────────────────────

  const handleSign = useCallback(async (txIndex: number) => {
    if (!walletAddress || !selectedWallet) return;
    setIsSigning(txIndex);
    try {
      await signTransaction(walletAddress, selectedWallet, txIndex, walletAddress);
      await loadTransactions(selectedWallet);
      await loadSelectedWallet(selectedWallet);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sign failed");
    }
    setIsSigning(null);
  }, [walletAddress, selectedWallet, loadTransactions, loadSelectedWallet]);

  const isSigner = selectedWalletInfo?.signers.includes(walletAddress || "") ?? false;

  const tabs: { key: Tab; label: string; icon: React.ReactNode; color: string }[] = [
    { key: "wallets", label: "Wallets", icon: <WalletIcon />, color: "#7c6cf0" },
    { key: "propose", label: "Propose", icon: <SendIcon />, color: "#4fc3f7" },
    { key: "transactions", label: "Transactions", icon: <ListIcon />, color: "#fbbf24" },
  ];

  return (
    <div className="w-full max-w-2xl animate-fade-in-up-delayed">
      {/* Toasts */}
      {error && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-[#f87171]/15 bg-[#f87171]/[0.05] px-4 py-3 backdrop-blur-sm animate-slide-down">
          <span className="mt-0.5 text-[#f87171]"><AlertIcon /></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[#f87171]/90">Error</p>
            <p className="text-xs text-[#f87171]/50 mt-0.5 break-all">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="shrink-0 text-[#f87171]/30 hover:text-[#f87171]/70 text-lg leading-none">&times;</button>
        </div>
      )}

      {txStatus && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-[#34d399]/15 bg-[#34d399]/[0.05] px-4 py-3 backdrop-blur-sm shadow-[0_0_30px_rgba(52,211,153,0.05)] animate-slide-down">
          <span className="text-[#34d399]">
            {txStatus.includes("on-chain") || txStatus.includes("proposed") || txStatus.includes("successful") || txStatus.includes("created") ? <CheckIcon /> : <SpinnerIcon />}
          </span>
          <span className="text-sm text-[#34d399]/90">{txStatus}</span>
        </div>
      )}

      {/* Main Card */}
      <Spotlight className="rounded-2xl">
        <AnimatedCard className="p-0" containerClassName="rounded-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#7c6cf0]/20 to-[#4fc3f7]/20 border border-white/[0.06]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#7c6cf0]">
                  <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
                  <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
                  <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white/90">Multi-Sig Wallet</h3>
                <p className="text-[10px] text-white/25 font-mono mt-0.5">{truncate(CONTRACT_ADDRESS)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {selectedWallet && (
                <Badge variant="warning">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#fbbf24] animate-pulse" />
                  Active: {truncate(selectedWallet)}
                </Badge>
              )}
              <Badge variant="info">Soroban</Badge>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-white/[0.06] px-2">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => { setActiveTab(t.key); setError(null); }}
                className={cn(
                  "relative flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-all",
                  activeTab === t.key ? "text-white/90" : "text-white/35 hover:text-white/55"
                )}
              >
                <span style={activeTab === t.key ? { color: t.color } : undefined}>{t.icon}</span>
                {t.label}
                {activeTab === t.key && (
                  <span className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full transition-all" style={{ background: `linear-gradient(to right, ${t.color}, ${t.color}66)` }} />
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {/* ── WALLETS TAB ── */}
            {activeTab === "wallets" && (
              <div className="space-y-6">
                {/* Create wallet */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-white/30">
                    <PlusIcon /> Create New Wallet
                  </div>
                  {walletAddress ? (
                    <>
                      <Input label="Wallet ID" value={newWalletId} onChange={(e) => setNewWalletId(e.target.value)} placeholder="e.g. team-treasury" />
                      <Input label="Signers (comma-separated addresses)" value={newSigners} onChange={(e) => setNewSigners(e.target.value)} placeholder="G..., G..., G..." />
                      <Input label="Token Address (e.g. XLM or custom token)" value={newToken} onChange={(e) => setNewToken(e.target.value)} placeholder="G..." />
                      <div className="space-y-2">
                        <label className="block text-[11px] font-medium uppercase tracking-wider text-white/30">Threshold</label>
                        <div className="flex items-center gap-3">
                          <input
                            type="range"
                            min="1"
                            max={Math.max(2, newSigners.split(",").filter(s => s.trim()).length)}
                            value={newThreshold}
                            onChange={(e) => setNewThreshold(e.target.value)}
                            className="flex-1 accent-[#7c6cf0]"
                          />
                          <span className="font-mono text-sm text-white/70 w-8 text-center">{newThreshold}</span>
                        </div>
                        <p className="text-[10px] text-white/20">Requires {newThreshold} of {Math.max(1, newSigners.split(",").filter(s => s.trim()).length)} signers to approve transactions</p>
                      </div>
                      <ShimmerButton onClick={handleCreateWallet} disabled={isCreating} shimmerColor="#7c6cf0" className="w-full">
                        {isCreating ? <><SpinnerIcon /> Creating...</> : <><PlusIcon /> Create Wallet</>}
                      </ShimmerButton>
                    </>
                  ) : (
                    <button onClick={onConnect} disabled={isConnecting} className="w-full rounded-xl border border-dashed border-[#7c6cf0]/20 bg-[#7c6cf0]/[0.03] py-4 text-sm text-[#7c6cf0]/60 hover:border-[#7c6cf0]/30 hover:text-[#7c6cf0]/80 active:scale-[0.99] transition-all disabled:opacity-50">
                      Connect wallet to create a multisig wallet
                    </button>
                  )}
                </div>

                {/* Divider */}
                <div className="border-t border-white/[0.06]" />

                {/* Wallets list */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-white/30">
                      <WalletIcon /> My Wallets
                    </div>
                    <button onClick={loadWallets} className="text-[10px] text-white/20 hover:text-white/40 transition-colors">
                      {isLoadingWallets ? "Loading..." : "Refresh"}
                    </button>
                  </div>

                  {isLoadingWallets ? (
                    <div className="flex items-center justify-center py-8">
                      <SpinnerIcon />
                    </div>
                  ) : wallets.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-white/[0.06] bg-white/[0.01] py-8 text-center">
                      <p className="text-sm text-white/25">No wallets yet</p>
                      <p className="text-[10px] text-white/15 mt-1">Create your first multisig wallet above</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {wallets.map((w) => (
                        <button
                          key={w}
                          onClick={() => { setSelectedWallet(w); loadSelectedWallet(w); }}
                          className={cn(
                            "w-full flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-all",
                            selectedWallet === w
                              ? "border-[#7c6cf0]/30 bg-[#7c6cf0]/[0.05]"
                              : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1] hover:bg-white/[0.04]"
                          )}
                        >
                          <div className="min-w-0">
                            <p className="font-mono text-sm text-white/80 truncate">{w}</p>
                          </div>
                          <div className="flex items-center gap-2 ml-3">
                            {selectedWallet === w && selectedWalletInfo && (
                              <Badge variant="info" className="text-[10px]">
                                <UsersIcon /> {selectedWalletInfo.signers.length} signers
                              </Badge>
                            )}
                            <span className={cn("h-2 w-2 rounded-full", selectedWallet === w ? "bg-[#7c6cf0]" : "bg-white/20")} />
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Selected wallet details */}
                {selectedWallet && selectedWalletInfo && (
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-4 animate-fade-in-up">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-white/25">Selected Wallet</span>
                      <Badge variant="warning">{selectedWalletInfo.threshold}/{selectedWalletInfo.signers.length} threshold</Badge>
                    </div>

                    {/* Balance */}
                    <div className="flex items-center justify-between rounded-lg border border-[#fbbf24]/10 bg-[#fbbf24]/[0.03] px-4 py-3">
                      <div className="flex items-center gap-2">
                        <CoinIcon />
                        <span className="text-xs text-white/50">Balance</span>
                      </div>
                      <span className="font-mono text-lg text-[#fbbf24]">
                        {(parseFloat(selectedWalletInfo.balance) / 1e7).toFixed(7)} XLM
                      </span>
                    </div>

                    {/* Deposit */}
                    {walletAddress && (
                      <div className="space-y-3">
                        <Input 
                          label="Deposit Amount (XLM)" 
                          value={depositAmount} 
                          onChange={(e) => setDepositAmount(e.target.value)} 
                          placeholder="e.g. 100"
                          type="number"
                        />
                        <ShimmerButton onClick={handleDeposit} disabled={isDepositing} shimmerColor="#fbbf24" className="w-full">
                          {isDepositing ? <><SpinnerIcon /> Depositing...</> : <><CoinIcon /> Deposit</>}
                        </ShimmerButton>
                      </div>
                    )}

                    {/* Signers */}
                    <div className="space-y-2">
                      <p className="font-mono text-xs text-white/40">Signers</p>
                      {selectedWalletInfo.signers.map((s, i) => (
                        <div key={i} className="flex items-center gap-2 font-mono text-xs">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#4fc3f7]" />
                          <span className={cn("text-white/70", walletAddress === s && "text-[#7c6cf0]")}>
                            {truncate(s)}{walletAddress === s ? " (you)" : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── PROPOSE TAB ── */}
            {activeTab === "propose" && (
              <div className="space-y-5">
                {!selectedWallet ? (
                  <div className="rounded-xl border border-dashed border-white/[0.06] bg-white/[0.01] py-12 text-center space-y-3">
                    <div className="text-3xl opacity-20">📋</div>
                    <div>
                      <p className="text-sm text-white/40">No wallet selected</p>
                      <p className="text-[10px] text-white/20 mt-1">Go to Wallets tab and select one</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="rounded-xl border border-[#4fc3f7]/10 bg-[#4fc3f7]/[0.03] px-4 py-3 flex items-center gap-2">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-[#4fc3f7]/60">Active Wallet</span>
                      <span className="font-mono text-xs text-white/70">{selectedWallet}</span>
                      <Badge variant="info" className="ml-auto text-[10px]">
                        {selectedWalletInfo?.threshold}/{selectedWalletInfo?.signers.length}
                      </Badge>
                    </div>

                    {/* Balance display */}
                    {selectedWalletInfo && (
                      <div className="flex items-center justify-between rounded-lg border border-[#fbbf24]/10 bg-[#fbbf24]/[0.03] px-4 py-3">
                        <span className="text-xs text-white/50">Available Balance</span>
                        <span className="font-mono text-sm text-[#fbbf24]">
                          {(parseFloat(selectedWalletInfo.balance) / 1e7).toFixed(7)} XLM
                        </span>
                      </div>
                    )}

                    <div className="space-y-4">
                      <Input label="Target Address" value={proposeTarget} onChange={(e) => setProposeTarget(e.target.value)} placeholder="G..." />
                      <Input label="Amount (XLM)" value={proposeAmount} onChange={(e) => setProposeAmount(e.target.value)} placeholder="e.g. 10" type="number" />

                      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-2">
                        <p className="text-[10px] font-medium uppercase tracking-wider text-white/25">Transaction Preview</p>
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between font-mono text-xs">
                            <span className="text-white/40">From</span>
                            <span className="text-white/70 truncate ml-4">{selectedWallet}</span>
                          </div>
                          <div className="flex items-center justify-between font-mono text-xs">
                            <span className="text-white/40">To</span>
                            <span className="text-white/70 truncate ml-4">{proposeTarget ? truncate(proposeTarget) : "—"}</span>
                          </div>
                          <div className="flex items-center justify-between font-mono text-xs">
                            <span className="text-white/40">Amount</span>
                            <span className="text-white/70">{proposeAmount || "0"} XLM</span>
                          </div>
                          <div className="flex items-center justify-between font-mono text-xs">
                            <span className="text-white/40">Approvals needed</span>
                            <span className="text-[#fbbf24]">{selectedWalletInfo?.threshold || "?"} / {selectedWalletInfo?.signers.length || "?"}</span>
                          </div>
                        </div>
                      </div>

                      {walletAddress ? (
                        <ShimmerButton onClick={handlePropose} disabled={isProposing} shimmerColor="#4fc3f7" className="w-full">
                          {isProposing ? <><SpinnerIcon /> Proposing...</> : <><SendIcon /> Propose Transfer</>}
                        </ShimmerButton>
                      ) : (
                        <button onClick={onConnect} disabled={isConnecting} className="w-full rounded-xl border border-dashed border-[#4fc3f7]/20 bg-[#4fc3f7]/[0.03] py-4 text-sm text-[#4fc3f7]/60 hover:border-[#4fc3f7]/30 hover:text-[#4fc3f7]/80 active:scale-[0.99] transition-all disabled:opacity-50">
                          Connect wallet to propose a transfer
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── TRANSACTIONS TAB ── */}
            {activeTab === "transactions" && (
              <div className="space-y-5">
                {!selectedWallet ? (
                  <div className="rounded-xl border border-dashed border-white/[0.06] bg-white/[0.01] py-12 text-center space-y-3">
                    <div className="text-3xl opacity-20">📋</div>
                    <div>
                      <p className="text-sm text-white/40">No wallet selected</p>
                      <p className="text-[10px] text-white/20 mt-1">Go to Wallets tab and select one</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-medium uppercase tracking-wider text-white/30">
                        <ListIcon /> Pending Transactions
                      </div>
                      <button onClick={() => loadTransactions(selectedWallet)} className="text-[10px] text-white/20 hover:text-white/40 transition-colors">
                        {isLoadingTxs ? "Loading..." : "Refresh"}
                      </button>
                    </div>

                    {isLoadingTxs ? (
                      <div className="flex items-center justify-center py-8"><SpinnerIcon /></div>
                    ) : txs.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-white/[0.06] bg-white/[0.01] py-8 text-center">
                        <p className="text-sm text-white/25">No transactions yet</p>
                        <p className="text-[10px] text-white/15 mt-1">Propose a transfer in the Propose tab</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {txs.map(({ index, info }) => {
                          return (
                            <div key={index} className={cn(
                              "rounded-xl border p-4 space-y-3 transition-all",
                              info.executed
                                ? "border-[#34d399]/20 bg-[#34d399]/[0.03]"
                                : "border-white/[0.06] bg-white/[0.02]"
                            )}>
                              {/* Tx header */}
                              <div className="flex items-center justify-between">
                                <span className="font-mono text-xs text-white/50">TX #{index}</span>
                                {info.executed ? (
                                  <Badge variant="success"><CheckIcon /> Executed</Badge>
                                ) : (
                                  <Badge variant="warning"><span className="h-1.5 w-1.5 rounded-full bg-[#fbbf24] animate-pulse" /> Pending</Badge>
                                )}
                              </div>

                              {/* Tx details */}
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between font-mono text-xs">
                                  <span className="text-white/40">To</span>
                                  <span className="text-white/70">{truncate(info.target)}</span>
                                </div>
                                <div className="flex items-center justify-between font-mono text-xs">
                                  <span className="text-white/40">Amount</span>
                                  <span className="text-white/70">{(parseFloat(info.amount) / 1e7).toFixed(7)} XLM</span>
                                </div>
                                <div className="flex items-center justify-between font-mono text-xs">
                                  <span className="text-white/40">Signatures</span>
                                  <span className="text-[#fbbf24]">{info.signed_count} / {selectedWalletInfo?.threshold}</span>
                                </div>
                              </div>

                              {/* Signature progress */}
                              {!info.executed && (
                                <div className="space-y-2">
                                  <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                                    <div
                                      className="h-full rounded-full bg-gradient-to-r from-[#fbbf24] to-[#7c6cf0] transition-all"
                                      style={{ width: `${Math.min(100, (info.signed_count / (selectedWalletInfo?.threshold || 1)) * 100)}%` }}
                                    />
                                  </div>
                                  <div className="flex items-center justify-between text-[10px] text-white/20">
                                    <span>Progress: {info.signed_count}/{selectedWalletInfo?.threshold} signatures</span>
                                    {isSigner && <span className="text-[#7c6cf0]">You are a signer</span>}
                                  </div>
                                </div>
                              )}

                              {/* Sign button */}
                              {!info.executed && isSigner && walletAddress && (
                                <ShimmerButton onClick={() => handleSign(index)} disabled={isSigning === index} shimmerColor="#fbbf24" className="w-full mt-1" shimmerDuration="2s">
                                  {isSigning === index ? <><SpinnerIcon /> Signing...</> : <><CheckIcon /> Sign Transaction</>}
                                </ShimmerButton>
                              )}
                              {!info.executed && !isSigner && walletAddress && (
                                <div className="rounded-lg border border-[#f87171]/10 bg-[#f87171]/[0.03] px-3 py-2 text-center">
                                  <span className="text-[10px] text-[#f87171]/60">You are not a signer of this wallet</span>
                                </div>
                              )}
                              {!walletAddress && (
                                <button onClick={onConnect} className="w-full rounded-lg border border-dashed border-white/[0.06] py-2 text-xs text-white/30 hover:text-white/50 transition-colors">
                                  Connect wallet to sign
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-white/[0.04] px-6 py-3 flex items-center justify-between">
            <p className="text-[10px] text-white/15">Multi-Sig Wallet &middot; Soroban &middot; Permissionless</p>
            <div className="flex items-center gap-2">
              {["Propose", "Sign", "Execute"].map((s, i) => (
                <span key={s} className="flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-white/20" />
                  <span className="font-mono text-[9px] text-white/15">{s}</span>
                  {i < 2 && <span className="text-white/10 text-[8px]">&rarr;</span>}
                </span>
              ))}
            </div>
          </div>
        </AnimatedCard>
      </Spotlight>
    </div>
  );
}
