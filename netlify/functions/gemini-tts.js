// Proxies the "motivational voice line" text-to-speech call to Gemini.
// Same reasoning as gemini-breakdown.js: keeps the API key out of the
// public page source.
//
// Requires the same environment variable:
//   GEMINI_API_KEY - from https://aistudio.google.com/apikey

exports.handler = async function (event) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const { GEMINI_API_KEY } = process.env;
    if (!GEMINI_API_KEY) {
        return { statusCode: 500, body: JSON.stringify({ error: 'GEMINI_API_KEY is not configured on the server.' }) };
    }

    let payload;
    try {
        payload = JSON.parse(event.body || '{}');
    } catch (e) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body.' }) };
    }

    const { text } = payload;
    if (!text || typeof text !== 'string') {
        return { statusCode: 400, body: JSON.stringify({ error: 'text is required.' }) };
    }

    const geminiPayload = {
        contents: [{ parts: [{ text }] }],
        generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } } }
        },
        model: "gemini-2.5-flash-preview-tts"
    };

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${GEMINI_API_KEY}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(geminiPayload)
        });

        if (!response.ok) {
            const errBody = await response.text();
            return { statusCode: response.status, body: JSON.stringify({ error: errBody }) };
        }

        const result = await response.json();
        const audioData = result?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!audioData) {
            return { statusCode: 502, body: JSON.stringify({ error: 'Invalid response structure from Gemini.' }) };
        }

        return { statusCode: 200, body: JSON.stringify({ audioData }) };
    } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ error: String(err) }) };
    }
};
