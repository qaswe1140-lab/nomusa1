// Vercel Serverless Function
// 브라우저는 이 주소(/api/claude)로만 요청을 보내고,
// 실제 Gemini API 키는 여기(서버 환경변수)에만 존재합니다.
// -> 사이트 코드를 아무리 들여다봐도 키가 노출되지 않습니다.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST 요청만 허용됩니다.' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'GEMINI_API_KEY 환경변수가 설정되어 있지 않습니다.' });
    return;
  }

  const { prompt } = req.body || {};
  if (!prompt || typeof prompt !== 'string') {
    res.status(400).json({ error: 'prompt가 필요합니다.' });
    return;
  }

  try {
    const model = 'gemini-3.1-flash-lite'; // 무료 티어 한도가 넉넉한 모델
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      res.status(response.status).json({ error: 'Gemini API 오류: ' + errText });
      return;
    }

    const data = await response.json();
    const text = (data.candidates?.[0]?.content?.parts || [])
      .map(p => p.text || '')
      .join('\n')
      .trim();
    res.status(200).json({ text });
  } catch (e) {
    res.status(500).json({ error: '요청 처리 중 오류: ' + e.message });
  }
}
