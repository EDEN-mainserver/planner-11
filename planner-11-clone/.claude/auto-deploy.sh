#!/bin/bash
# planner-11 Claude Stop 훅 — 변경사항 커밋만 담당
# push는 글로벌 post-commit 훅(~/.git-hooks/post-commit)이 자동 처리함

cd /c/Users/gram/Desktop/planforge_complete

# 변경사항 없으면 스킵
if [[ -z $(git status --porcelain) ]]; then
  echo '{"systemMessage": "변경사항 없음 — 스킵"}'
  exit 0
fi

# 스테이징 & 커밋 (push는 post-commit 훅이 처리)
git add -A
TIMESTAMP=$(date '+%Y-%m-%d %H:%M')
COMMIT_RESULT=$(git commit -m "auto: Claude 작업 완료 ($TIMESTAMP)" 2>&1)
COMMIT_EXIT=$?

if [ $COMMIT_EXIT -eq 0 ]; then
  echo '{"systemMessage": "✅ 커밋 & 푸시 완료 → Vercel 자동 배포 시작됨"}'
else
  echo "{\"systemMessage\": \"⚠️ 커밋 실패: $COMMIT_RESULT\"}"
fi
