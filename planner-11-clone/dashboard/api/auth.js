// 사용자 인증 API
// 환경변수 USERS_JSON 에 계정 정보 저장
// 예: [{"username":"eden","password":"pass1","displayName":"정대표"}]

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  let users;
  try {
    const raw = process.env.USERS_JSON;
    if (!raw) throw new Error("USERS_JSON 환경변수가 설정되지 않았습니다");
    users = JSON.parse(raw);
  } catch (e) {
    return res.status(503).json({ error: "서버 설정 오류: " + e.message });
  }

  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "아이디와 비밀번호를 입력하세요" });
  }

  const user = users.find(
    (u) => u.username === username && u.password === password
  );

  if (!user) {
    return res.status(401).json({ error: "아이디 또는 비밀번호가 올바르지 않습니다" });
  }

  return res.status(200).json({
    ok: true,
    username: user.username,
    displayName: user.displayName || user.username,
  });
}
