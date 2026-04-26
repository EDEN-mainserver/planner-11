#!/bin/bash
# 작업 완료 후 자동 git push + Vercel 배포 스크립트
# Claude Code Stop 훅에서 호출됨

set -e
cd "C:/Users/gram/Desktop/planforge_complete"

# ── 1. Git push ──────────────────────────────────────────────
if git status --porcelain | grep -q .; then
  DATE=$(date "+%Y-%m-%d %H:%M")
  git add -A
  git commit -m "auto: Claude 작업 완료 ($DATE)"
  echo "[auto-push] 커밋: $DATE"
fi

git push origin master
echo "[auto-push] GitHub push 완료 → https://github.com/EDEN-mainserver/planner-11.git"

# ── 2. Vercel 프로덕션 배포 ──────────────────────────────────
VERCEL_PROJECT_ID=prj_wJKsfhWUCCNCgQM1ieGNX3R09HoL \
VERCEL_ORG_ID=team_c4y0QG3ZT2bioeEND7XIqtbJ \
vercel deploy --prod --yes 2>&1 | tail -5
echo "[auto-push] Vercel 배포 완료 → https://planforge-ui.vercel.app/"
