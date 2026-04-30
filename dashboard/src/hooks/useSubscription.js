import { useState, useEffect, useCallback } from "react";
import { getSession } from "../utils/authSession";
import { PLANS, INTERNAL_USERS, isFeatureAllowed } from "../config/plans";
import { USERS } from "../config/users";

const BASE = import.meta.env.VITE_API_BASE || "";

function getInternalRole(username) {
  const user = USERS.find((u) => u.username === username);
  return user?.role || "member";
}

export function useSubscription() {
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);

  const session = getSession();
  const userId = session?.username;

  const fetchSubscription = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    if (INTERNAL_USERS.includes(userId)) {
      const role = getInternalRole(userId);
      setSubscription({
        planId: "premium",
        status: "active",
        usageCount: 0,
        monthlyLimit: 9999,
        role,
      });
      setLoading(false);
      return;
    }
    try {
      const resp = await fetch(`${BASE}/api/subscription/status?userId=${encodeURIComponent(userId)}`);
      if (resp.ok) {
        const data = await resp.json();
        const plan = PLANS[data.planId];
        setSubscription({ ...data, monthlyLimit: plan?.monthlyLimit || 20 });
      } else {
        setSubscription(null);
      }
    } catch {
      setSubscription(null);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    queueMicrotask(() => {
      fetchSubscription();
    });
  }, [fetchSubscription]);

  const role = subscription?.role || "customer";
  const isAdmin = role === "admin";
  const isMember = role === "member";

  function canUseFeature(featureKey) {
    if (!subscription) return false;
    if (subscription.status !== "active") return false;
    // 관리자: 모든 기능
    if (isAdmin) return true;
    // 멤버: growthdb 제외 전체
    if (isMember) return featureKey !== "growthdb";
    // 일반 고객: 플랜 기준
    return isFeatureAllowed(subscription.planId, featureKey);
  }

  const planId = subscription?.planId || null;
  const plan = planId ? PLANS[planId] : null;
  const usageCount = subscription?.usageCount || 0;
  const monthlyLimit = subscription?.monthlyLimit || 0;
  const remaining = Math.max(0, monthlyLimit - usageCount);
  const limitReached = monthlyLimit > 0 && usageCount >= monthlyLimit && !isAdmin && !isMember;

  return {
    subscription,
    loading,
    plan,
    planId,
    role,
    isAdmin,
    isMember,
    usageCount,
    monthlyLimit,
    remaining,
    limitReached,
    canUseFeature,
    refetch: fetchSubscription,
  };
}
