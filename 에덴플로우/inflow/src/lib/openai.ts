import OpenAI from "openai";

// OpenAI 클라이언트 싱글턴 (서버 사이드 전용)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default openai;
