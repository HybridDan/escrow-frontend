"use client";

import { useState } from "react";
import ButtonSpinner from "@/app/components/ButtonSpinner";
import TxStatusBanner from "@/app/components/TxStatusBanner";
import { ActionState } from "@/app/hooks/useActionStates";
import { getPhaseLabel } from "@/app/lib/transactions";

interface Milestone {
  index: number;
  amount: string;
  status: string;
  releasedAmount?: string;
}

interface Props {
  milestone: Milestone;
  isClient: boolean;
  isFreelancer: boolean;
  partialReleaseState: ActionState;
  claimAutoReleaseState: ActionState;
  isPartialReleasePending: boolean;
  isClaimAutoReleasePending: boolean;
  onPartialRelease?: (index: number, amount: string) => void;
  onClaimAutoRelease?: (index: number) => void;
  onMarkDelivered?: (i: number) => void;
  onApprove?: (i: number) => void;
  onDispute?: (i: number) => void;
}

const statusColor: Record<string, string> = {
  Pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  Delivered: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  PartiallyReleased: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  Released: "bg-green-500/10 text-green-400 border-green-500/20",
  Disputed: "bg-red-500/10 text-red-400 border-red-500/20",
  Refunded: "bg-gray-500/10 text-gray-400 border-gray-500/20",
};

export default function MilestoneCard({
  milestone,
  isClient,
  isFreelancer,
  partialReleaseState,
  claimAutoReleaseState,
  isPartialReleasePending,
  isClaimAutoReleasePending,
  onPartialRelease,
  onClaimAutoRelease,
  onMarkDelivered,
  onApprove,
  onDispute,
}: Props) {
  const [partialAmount, setPartialAmount] = useState("");

  const canPartialRelease =
    isClient &&
    ["Delivered", "PartiallyReleased"].includes(milestone.status);

  const canClaimAutoRelease =
    isFreelancer && milestone.status === "Delivered";

  const released = milestone.releasedAmount ?? "0";
  const remaining = BigInt(milestone.amount) - BigInt(released);

  return (
    <div
      data-testid="milestone-card"
      className="
        border border-gray-800 rounded-lg p-4 bg-gray-900
        flex flex-col gap-3
        sm:flex-row sm:items-center sm:justify-between sm:gap-4
      "
    >
      {/* Milestone info */}
      <div className="min-w-0">
        <p className="text-sm text-gray-400">Milestone {milestone.index + 1}</p>
        <p className="font-mono text-white text-sm mt-1 truncate">
          {milestone.amount} stroops
        </p>
      </div>

      {/* Status badge + action buttons */}
      <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:gap-3">
        <span
          className={`text-xs px-2 py-1 rounded-full border whitespace-nowrap ${
            statusColor[milestone.status] ?? "bg-gray-800 text-gray-400"
          }`}
        >
          {milestone.status}
        </span>

        {isFreelancer && milestone.status === "Pending" && (
          <button
            onClick={() => onMarkDelivered?.(milestone.index)}
            className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg transition whitespace-nowrap"
          >
            Mark Delivered
          </button>
        )}

        {isClient && milestone.status === "Delivered" && (
          <button
            onClick={() => onApprove?.(milestone.index)}
            className="text-xs bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded-lg transition whitespace-nowrap"
          >
            Approve
          </button>
        )}

        {(isClient || isFreelancer) &&
          ["Pending", "Delivered"].includes(milestone.status) && (
            <button
              onClick={() => onDispute?.(milestone.index)}
              className="text-xs bg-red-800 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg transition whitespace-nowrap"
            >
              Dispute
            </button>
          )}
      </div>
    </div>
  );
}
