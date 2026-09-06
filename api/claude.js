
// Vercel Serverless Function
// 브라우저는 이 주소(/api/claude)로만 요청을 보내고,
// 실제 Gemini API 키는 여기(서버 환경변수)에만 존재합니다.
// -> 사이트 코드를 아무리 들여다봐도 키가 노출되지 않습니다.
//
// 정확도를 높이기 위해 Gemini를 두 번 호출합니다:
// 1차) 원래 요청대로 답변 생성
// 2차) 그 답변이 맞는지, 형식은 잘 지켰는지 스스로 다시 검토해서 필요하면 고친 최종본 반환

async function callGemini(apiKey, model, promptText) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error('Gemini API 오류: ' + errText);
  }

  const data = await response.json();
  return (data.candidates?.[0]?.content?.parts || [])
    .map(p => p.text || '')
    .join('\n')
    .trim();
}

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

  const model = 'gemini-3.1-flash-lite'; // 무료 티어 한도가 넉넉한 모델

  try {
    // 1차: 원래 요청대로 답변 생성
    const firstDraft = await callGemini(apiKey, model, prompt);

    // 2차: 스스로 검토해서 틀린 부분/형식 어긋난 부분만 고친 최종본 생성
    const reviewPrompt = `당신은 한국 공인노무사 시험 자료를 검수하는 꼼꼼한 검토자입니다. 아래는 어떤 요청과, 그 요청에 대해 AI가 작성한 첫 번째 답변입니다.

다음을 확인하고 필요하면 고쳐서, 최종 답변만 출력하세요:
- 법률 용어·판단기준이 정확한지
- 요청에서 지정한 형식(예: "제목:", "키워드:" 같은 표기, 줄바꿈 방식, 글자 수 제한 등)을 그대로 지켰는지
- 불필요하게 장황하거나 반대로 핵심이 빠진 부분은 없는지

문제가 없으면 첫 번째 답변을 그대로 다시 출력하세요. 검토 과정이나 "수정했습니다" 같은 설명은 절대 출력하지 말고, 최종 답변 내용만 출력하세요. 출력 형식(항목 구성, 줄바꿈)은 첫 번째 답변과 동일하게 유지하세요.

[원래 요청]
${prompt}

[첫 번째 답변]
${firstDraft}`;

    let finalText;
    try {
      finalText = await callGemini(apiKey, model, reviewPrompt);
      if (!finalText) finalText = firstDraft; // 2차 응답이 비어있으면 1차 답변 사용
    } catch (reviewErr) {
      // 검토 단계가 실패해도 1차 답변은 살려서 반환 (완전 실패보다 낫다)
      finalText = firstDraft;
    }

    res.status(200).json({ text: finalText });
  } catch (e) {
    res.status(500).json({ error: e.message || '요청 처리 중 오류가 발생했습니다.' });
  }
}
