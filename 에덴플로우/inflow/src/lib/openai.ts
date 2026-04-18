export async function callOpenAI(prompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return '[MOCK] OpenAI API 키가 설정되지 않았습니다.'
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type':'application/json', Authorization:`Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{ role:'user', content: prompt }],
      temperature: 0.8,
    }),
  })
  const data = await res.json()
  return data.choices?.[0]?.message?.content || '결과를 생성하지 못했습니다.'
}
