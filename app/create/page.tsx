"use client";
import { useState } from "react";
import { useWallet } from "@/app/context/WalletContext";
import Navbar from "@/app/components/Navbar";
import { useRouter } from "next/navigation";

const CONTRACT_ID = process.env.NEXT_PUBLIC_CONTRACT_ID || "";
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

export default function CreateJob() {
  const { address, signTransaction } = useWallet();
  const router = useRouter();
  const [freelancer, setFreelancer] = useState("");
  const [arbiter, setArbiter] = useState("");
  const [token, setToken] = useState("");
  const [autoReleaseDays, setAutoReleaseDays] = useState("7");
  const [milestones, setMilestones] = useState([{ amount: "" }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const addMilestone = () => setMilestones([...milestones, { amount: "" }]);
  const removeMilestone = (i: number) =>
    setMilestones(milestones.filter((_, idx) => idx !== i));
  const updateMilestone = (i: number, val: string) => {
    const updated = [...milestones];
    updated[i].amount = val;
    setMilestones(updated);
  };

  const normalizedMilestones = milestones.filter(
    (m): m is { amount: string } => !!m && typeof m.amount === "string"
  );
  const hasNoMilestones = normalizedMilestones.length === 0;
  const hasPartialMilestones = normalizedMilestones.some(
    (m) => m.amount.trim().length === 0
  );

  const isSubmitDisabled = loading || !address || hasNoMilestones || hasPartialMilestones;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return;
    if (hasNoMilestones) {
      setError("Add at least one milestone amount before creating a job.");
      return;
    }
    if (hasPartialMilestones) {
      setError("Complete each milestone amount before creating a job.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const milestoneAmounts = normalizedMilestones.map((m) => BigInt(m.amount));

      // Convert days to seconds for auto-release
      const autoReleaseSeconds =
        BigInt(autoReleaseDays) * BigInt(24) * BigInt(60) * BigInt(60);

      const buildTxRes = await fetch(`${BACKEND_URL}/api/jobs/build-tx`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractId: CONTRACT_ID,
          method: "initialize",
          args: [
            { type: "address", value: address },
            { type: "address", value: address },
            { type: "address", value: freelancer },
            { type: "address", value: arbiter },
            { type: "address", value: token },
            { type: "u64", value: autoReleaseSeconds.toString() },
            {
              type: "vec",
              value: milestoneAmounts.map((a) => ({ type: "i128", value: a.toString() })),
            },
          ],
          sourceAddress: address,
        }),
      });

      if (!buildTxRes.ok) throw new Error("Failed to build transaction");
      const { xdr } = await buildTxRes.json();

      const signedXdr = await signTransaction(xdr);

      const submitRes = await fetch(`${BACKEND_URL}/api/jobs/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signedXdr }),
      });

      if (!submitRes.ok) throw new Error("Failed to submit transaction");
      const { hash } = await submitRes.json();
      setTxHash(hash);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  // ── Success screen ──────────────────────────────────────────────────────────
  if (txHash) {
    return (
      <div className="min-h-screen bg-surface-page text-text-primary flex flex-col">
        <Navbar />
        <main className="flex-1 overflow-y-auto flex items-center justify-center">
          <div className="text-center px-4 py-12 animate-fade-in">
            <div className="text-success-soft text-5xl mb-4" aria-hidden="true">
              ✓
            </div>
            <h2 className="text-xl font-bold mb-2">Job Created!</h2>
            <p className="text-text-muted text-sm mb-6">
              Your escrow job is live on Stellar testnet.
            </p>
            <a
              href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-soft hover:text-accent-soft-hover underline text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page rounded-sm"
            >
              View transaction on Stellar Expert →
            </a>
            <div className="mt-6">
              <button
                onClick={() => router.push("/dashboard")}
                className="bg-accent hover:bg-accent-hover active:scale-95 text-text-primary text-sm font-medium px-6 py-2 rounded-lg transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ── Create-job form ─────────────────────────────────────────────────────────
  return (
    /*
     * Issue #46 – Mobile viewport: the outer wrapper uses flex-col + overflow
     * so the sticky submit bar always stays visible without needing the user
     * to scroll past the keyboard on small screens.
     */
    <div
      className="min-h-screen bg-surface-page text-text-primary flex flex-col"
      data-testid="create-job-form-page"
    >
      <Navbar />

      {/*
       * flex-1 + overflow-y-auto keeps the form scrollable independently of
       * the sticky footer on mobile (Issue #46).
       */}
      <main className="flex-1 overflow-y-auto flex flex-col" id="main-content">
        <div className="max-w-xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-12 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold mb-6 sm:mb-8 text-text-primary">
            Create New Job
          </h1>

          {/*
           * Issue #40 – aria-live="polite" announces error messages to screen
           * readers without interrupting the current read flow.
           */}
          <div aria-live="polite" aria-atomic="true">
            {error && (
              <div
                id="form-error"
                className="mb-5 rounded-lg bg-danger/40 border border-danger px-4 py-3 text-sm text-danger-soft animate-shake"
                role="alert"
              >
                {error}
              </div>
            )}
          </div>

          <form
            onSubmit={handleSubmit}
            className="space-y-5 sm:space-y-6"
            data-testid="create-job-form"
            aria-label="Create new escrow job"
            aria-describedby={error ? "form-error" : undefined}
            /*
             * Issue #40 – aria-busy tells assistive tech the form is
             * processing during the async submit.
             */
            aria-busy={loading}
            noValidate
          >
            {/* Freelancer Address */}
            <div>
              <label
                htmlFor="freelancer-address"
                className="block text-sm text-text-muted mb-1"
              >
                Freelancer Address
              </label>
              <input
                id="freelancer-address"
                type="text"
                autoComplete="off"
                spellCheck={false}
                /*
                 * Issue #40 – aria-required conveys requirement semantics to
                 * assistive tech independently of HTML5 `required`.
                 */
                aria-required="true"
                /*
                 * Issue #45 – transition-colors gives a subtle color shift on
                 * hover/focus without jarring layout shifts.
                 * Issue #47 – uses design tokens (bg-surface-field,
                 * focus-visible:ring-accent-soft) instead of raw colours.
                 */
                className="w-full bg-surface-field border border-border-subtle rounded-lg px-4 py-2 text-sm text-text-primary placeholder:text-text-disabled transition-colors duration-200 hover:border-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page"
                value={freelancer}
                onChange={(e) => setFreelancer(e.target.value)}
                placeholder="G..."
                required
              />
            </div>

            {/* Arbiter Address */}
            <div>
              <label
                htmlFor="arbiter-address"
                className="block text-sm text-text-muted mb-1"
              >
                Arbiter Address
              </label>
              <input
                id="arbiter-address"
                type="text"
                autoComplete="off"
                spellCheck={false}
                aria-required="true"
                className="w-full bg-surface-field border border-border-subtle rounded-lg px-4 py-2 text-sm text-text-primary placeholder:text-text-disabled transition-colors duration-200 hover:border-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page"
                value={arbiter}
                onChange={(e) => setArbiter(e.target.value)}
                placeholder="G..."
                required
              />
            </div>

            {/* Token Contract Address */}
            <div>
              <label
                htmlFor="token-address"
                className="block text-sm text-text-muted mb-1"
              >
                Token Contract Address
              </label>
              <input
                id="token-address"
                type="text"
                autoComplete="off"
                spellCheck={false}
                aria-required="true"
                className="w-full bg-surface-field border border-border-subtle rounded-lg px-4 py-2 text-sm text-text-primary placeholder:text-text-disabled transition-colors duration-200 hover:border-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="C..."
                required
              />
            </div>

            {/* Response Deadline */}
            <div>
              <label
                htmlFor="response-deadline"
                className="block text-sm text-text-muted mb-1"
              >
                Response Deadline (days)
              </label>
              <input
                id="response-deadline"
                type="number"
                min="1"
                aria-required="true"
                aria-describedby="deadline-hint"
                className="w-full bg-surface-field border border-border-subtle rounded-lg px-4 py-2 text-sm text-text-primary placeholder:text-text-disabled transition-colors duration-200 hover:border-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page"
                value={autoReleaseDays}
                onChange={(e) => setAutoReleaseDays(e.target.value)}
                required
              />
              {/* Issue #40 – visible hint linked via aria-describedby */}
              <p id="deadline-hint" className="mt-1 text-xs text-text-disabled">
                Funds auto-release after this many days if no dispute is raised.
              </p>
            </div>

            {/* Milestones */}
            <fieldset>
              {/*
               * Issue #40 – <fieldset>/<legend> groups related milestone
               * inputs for screen readers.
               */}
              <legend className="block text-sm text-text-muted mb-2">Milestones</legend>

              {hasNoMilestones ? (
                <div
                  className="rounded-lg border border-border-subtle bg-surface-card px-4 py-4"
                  data-testid="milestone-empty-state"
                >
                  <p className="text-sm text-text-secondary">No milestones available.</p>
                  <p className="mt-1 text-xs text-text-muted">
                    Add your first milestone to define how funds should be released.
                  </p>
                  <button
                    type="button"
                    onClick={addMilestone}
                    /*
                     * Issue #40 – explicit role/description for icon-only
                     * context buttons.
                     */
                    aria-label="Add first milestone"
                    className="mt-3 text-sm text-accent-soft hover:text-accent-soft-hover active:scale-95 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page rounded-sm"
                  >
                    Add first milestone
                  </button>
                </div>
              ) : (
                /*
                 * Issue #45 – role="list" + animate-* classes allow CSS
                 * transitions when milestone rows are added/removed.
                 */
                <ul
                  className="space-y-2"
                  data-testid="milestone-list"
                  role="list"
                  aria-label="Milestone amounts"
                >
                  {normalizedMilestones.map((m, i) => (
                    <li
                      key={i}
                      className="flex gap-2 items-center animate-slide-in"
                    >
                      <input
                        className="flex-1 min-w-0 bg-surface-field border border-border-subtle rounded-lg px-4 py-2 text-sm text-text-primary placeholder:text-text-disabled transition-colors duration-200 hover:border-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page"
                        value={m.amount}
                        onChange={(e) => updateMilestone(i, e.target.value)}
                        placeholder={`Milestone ${i + 1} amount (stroops)`}
                        aria-label={`Milestone ${i + 1} amount`}
                        aria-required="true"
                        inputMode="numeric"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => removeMilestone(i)}
                        aria-label={`Remove milestone ${i + 1}`}
                        /*
                         * Issue #45 – active:scale-95 micro-animation on
                         * destructive action button.
                         */
                        className="text-danger-soft hover:text-danger-soft-hover active:scale-95 text-sm px-2 shrink-0 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-soft focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page rounded-sm"
                      >
                        {/* Issue #40 – screen-reader-only text alongside decorative × */}
                        <span aria-hidden="true">✕</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {hasPartialMilestones && !hasNoMilestones && (
                <p
                  className="mt-2 text-xs text-warning-soft"
                  role="alert"
                  aria-live="assertive"
                >
                  Complete each milestone amount to continue.
                </p>
              )}

              <button
                type="button"
                onClick={addMilestone}
                className="mt-2 text-sm text-accent-soft hover:text-accent-soft-hover active:scale-95 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page rounded-sm"
              >
                + Add Milestone
              </button>
            </fieldset>

            {!address && (
              <p
                className="text-center text-sm text-text-disabled"
                role="status"
              >
                Connect your wallet to create a job
              </p>
            )}

            {/*
             * Issue #46 – On mobile the button uses a sticky wrapper via CSS
             * so it stays pinned to the bottom of the viewport without
             * duplicating DOM nodes (single button = single accessible target).
             *
             * Issue #45 – active:scale-[0.98] tactile press feedback.
             * Issue #47 – bg-accent / bg-accent-hover / text-text-primary
             *             are all semantic design-token classes.
             * Issue #40 – aria-disabled mirrors the disabled state for AT.
             */}
            <div
              className="
                sm:static sm:bg-transparent sm:border-0 sm:p-0 sm:shadow-none
                fixed bottom-0 left-0 right-0 z-20
                bg-surface-page border-t border-border-strong
                px-4 py-3
                sm:px-0 sm:py-0 sm:relative
              "
              style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
            >
              <button
                type="submit"
                disabled={isSubmitDisabled}
                aria-disabled={isSubmitDisabled}
                aria-label={loading ? "Creating job, please wait…" : "Create Job"}
                className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] text-text-primary font-medium py-3 rounded-lg transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page"
              >
                {loading ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <span
                      className="h-4 w-4 rounded-full border-2 border-text-primary border-t-transparent animate-spin"
                      aria-hidden="true"
                    />
                    Creating…
                  </span>
                ) : (
                  "Create Job"
                )}
              </button>
            </div>
          </form>
        </div>

        {/*
         * Issue #46 – Bottom padding spacer so form content is never hidden
         * behind the sticky button bar on mobile.  On sm+ the bar is
         * position:relative so no spacer is needed.
         */}
        <div className="sm:hidden h-20" aria-hidden="true" />
      </main>
    </div>
  );
}
