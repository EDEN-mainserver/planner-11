#!/bin/bash
# Claude 작업 완료 후 자동 git push 스크립트
# Vercel은 GitHub push 이벤트로 자동 배포됨

cd /Users/eden/Desktop/planner-11

# 변경사항 확인
if [[ -z $(git status --porcelain) ]]; then
  echo '{"systemMessage": "변경사항 없음 — 푸시 스킵"}'
  exit 0
fi

# 스테이징 & 커밋
git add -A
TIMESTAMP=$(date '+%Y-%m-%d %H:%M')
git commit -m "auto: Claude 작업 완료 ($TIMESTAMP)" --no-verify 2>&1

# 원격 변경사항 pull 후 push
git pull --rebase origin master 2>&1

PUSH_RESULT=$(git push origin master 2>&1)
PUSH_EXIT=$?

if [ $PUSH_EXIT -eq 0 ]; then
  echo '{"systemMessage": "✅ GitHub 푸시 완료 → Vercel 자동 배포 시작됨"}'
else
  echo "{\"systemMessage\": \"⚠️ 푸시 실패: $PUSH_RESULT\"}"
fi
