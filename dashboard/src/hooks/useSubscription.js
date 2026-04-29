import { useState, useEffect, useCallback } from "react";
import { getSession } from "../eattack/LoginModal";
import { PLANS, INTERNAL_USERS, isFeatureAllowed, isLimitReached } from "../config/plans";

const BASE = import.meta.env.VITE_API_BASE || "";

export function useSubscription() {
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);

  const session = getSession();
  const userId = session?.username;

  const fetchSubscription = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    if (INTERNAL_USERS.includes(userId)) {
      setSubscription({ planId: "premium", status: "active", usageCount: 0, monthlyLimit: 9999 });
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

  useEffect(() => { fetchSubscription(); }, [fetchSubscription]);

  function canUseFeature(featureKey) {
    if (!subscription) return false;
    if (subscription.status !== "active") return false;
    return isFeatureAllowed(subscription.planId, featureKey);
  }

  const planId = subscription?.planId || null;
  const plan = planId ? PLANS[planId] : null;
  const usageCount = subscription?.usageCount || 0;
  const monthlyLimit = subscription?.monthlyLimit || 0;
  const remaining = Math.max(0, monthlyLimit - usageCount);
  const limitReached = monthlyLimit > 0 && usageCount >= monthlyLimit;

  return {
    subscription,
    loading,
    plan,
    planId,
    usageCount,
    monthlyLimit,
    remaining,
    limitReached,
    canUseFeature,
    refetch: fetchSubscription,
  };
}
