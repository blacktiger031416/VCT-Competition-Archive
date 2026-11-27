import 'dotenv/config';
import express from 'express';

const app = express();
const PORT = process.env.PORT || 5173;
const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';
const MIN_INTERVAL_MS = 4000;

app.use(express.json({ limit: '6mb' }));
app.use(express.static('public'));

const SYSTEM_INSTRUCTION = `너는 발로란트 대회를 같이 보는 친구야. 사용자가 캡처해서 보내주는 방송 화면 스크린샷을 보고, 지금 상황에 대해 짧고 자연스럽게 반응해.

규칙:
- 반말로, 1~2문장 이내로 캐주얼하게 말해.
- 화면에서 실제로 보이는 것(킬, 스코어, 라운드, 스킬 사용, 클러치 상황 등) 위주로 반응해. 안 보이는 내용은 추측해서 단정하지 마.
- 직전에 했던 말과 표현을 반복하지 마.
- 이모지는 최대 1개까지만, 없어도 괜찮아.
- 화면이 로딩 화면, 로비, 광고처럼 경기 내용이 없으면 그냥 짧게 그 상태를 언급하고 넘어가.`;

let lastRequestAt = 0;

app.post('/api/react', async (req, res) => {
  if (!API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY가 서버에 설정되어 있지 않습니다. .env 파일을 확인하세요.' });
  }

  const now = Date.now();
  if (now - lastRequestAt < MIN_INTERVAL_MS) {
    return res.status(429).json({ error: '너무 빠른 요청이에요. 잠시 후 다시 시도하세요.' });
  }

  const { image, history } = req.body || {};
  if (!image || typeof image !== 'string') {
    return res.status(400).json({ error: 'image(base64)가 필요합니다.' });
  }

  const base64Data = image.includes(',') ? image.split(',')[1] : image;
  const recentHistory = Array.isArray(history) ? history.slice(-6) : [];
  const contextText = recentHistory.length
    ? `직전에 네가 한 말들(참고만 하고 반복하지 마): ${recentHistory.join(' / ')}\n\n`
    : '';

  try {
    lastRequestAt = now;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
          contents: [
            {
              role: 'user',
              parts: [
                { text: `${contextText}방금 캡처한 화면이야. 지금 보이는 상황에 짧게 반응해줘.` },
                { inlineData: { mimeType: 'image/jpeg', data: base64Data } },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.9,
            maxOutputTokens: 1024,
          },
        }),
      }
    );

    if (!response.ok) {
      const errBody = await response.text();
      console.error('Gemini API error:', response.status, errBody);
      return res.status(response.status).json({ error: `Gemini API 오류 (${response.status})` });
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('').trim();

    if (!text) {
      const blockReason = data?.promptFeedback?.blockReason;
      return res.status(200).json({ text: blockReason ? '(이 장면은 반응하기 애매해서 넘어갈게)' : '(...)' });
    }

    res.json({ text });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '서버에서 Gemini 호출 중 오류가 발생했습니다.' });
  }
});

app.listen(PORT, () => {
  console.log(`valorant-watch-buddy running at http://localhost:${PORT}`);
});
