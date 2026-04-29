/**
 * Google Sheets 회원 DB 동기화 스크립트
 *
 * [사용 방법]
 * 1. Google Sheets 열기 → 확장 프로그램 → Apps Script
 * 2. 이 코드 전체 붙여넣기 → 저장 (Ctrl+S)
 * 3. 배포 → 새 배포 → 웹앱
 *    - 다음 사용자로 실행: 나
 *    - 엑세스 권한: 모든 사용자
 *    → 배포 → URL 복사
 * 4. Vercel 환경변수에 추가:
 *    SHEETS_WEBHOOK_URL = 복사한 URL
 */

const SHEET_NAME = "회원 DB";

const HEADERS = [
  "ID", "이메일", "이름", "역할", "가입일", "최근 로그인", "프로필 이미지"
];

function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function findRowByEmail(sheet, email) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === email) return i + 1; // 1-indexed
  }
  return -1;
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const sheet = getOrCreateSheet();

    const row = [
      payload.id          || "",
      payload.email       || "",
      payload.displayName || "",
      payload.role        || "user",
      payload.createdAt   ? new Date(payload.createdAt).toLocaleString("ko-KR") : "",
      payload.lastLoginAt ? new Date(payload.lastLoginAt).toLocaleString("ko-KR") : "",
      payload.picture     || "",
    ];

    const existingRow = findRowByEmail(sheet, payload.email);

    if (existingRow > 0) {
      // 기존 회원: 역할·최근 로그인만 업데이트
      sheet.getRange(existingRow, 4).setValue(payload.role        || "user");
      sheet.getRange(existingRow, 6).setValue(
        payload.lastLoginAt ? new Date(payload.lastLoginAt).toLocaleString("ko-KR") : ""
      );
    } else {
      // 신규 회원: 행 추가
      sheet.appendRow(row);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// 테스트용 — Apps Script 에디터에서 직접 실행 가능
function testInsert() {
  doPost({
    postData: {
      contents: JSON.stringify({
        action: "insert",
        id: "google_test123",
        email: "test@example.com",
        displayName: "테스트 유저",
        role: "user",
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        picture: "",
      })
    }
  });
}
