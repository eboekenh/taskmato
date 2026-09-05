// Proxies the "break this task into sub-tasks" call to Gemini. The Gemini
// API key used to be hardcoded directly in index.html, visible to anyone who
// viewed the page source - this function keeps it server-side instead.
//
// Requires one environment variable set in the Netlify dashboard
// (Site configuration -> Environment variables):
//   GEMINI_API_KEY - from https://aistudio.google.com/apikey
//
// IMPORTANT: the old key (AIzaSyCiJWFYprsUl0JgkS3FlecZz48bXiyeEcQ) was public
// for a while in the site's source - treat it as compromised and delete/
// regenerate it in Google AI Studio, then put the NEW key here.

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

    const { taskText, workMinutes } = payload;
    if (!taskText || typeof taskText !== 'string') {
        return { statusCode: 400, body: JSON.stringify({ error: 'taskText is required.' }) };
    }
    const sessionMinutes = Number.isFinite(workMinutes) ? workMinutes : 25;

    const systemPrompt = `You are a productivity assistant. Break down the user's task into a JSON array of objects. Each object should represent a small, actionable sub-task and have two keys: "task" (a string describing the sub-task) and "minutes" (an integer estimating how many minutes it will take, it should be less than or equal to the Pomodoro session length of ${sessionMinutes} minutes). If the task is already small enough, return it as a single object in the array. The response must be a valid JSON array of objects.`;

    const geminiPayload = {
        contents: [{ parts: [{ text: taskText }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
                type: "ARRAY",
                items: {
                    type: "OBJECT",
                    properties: {
                        "task": { "type": "STRING" },
                        "minutes": { "type": "NUMBER" }
                    },
                    required: ["task", "minutes"]
                }
            }
        }
    };

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${GEMINI_API_KEY}`;
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
        const jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!jsonText) {
            return { statusCode: 502, body: JSON.stringify({ error: 'Invalid response structure from Gemini.' }) };
        }

        const subtasks = JSON.parse(jsonText);
        return { statusCode: 200, body: JSON.stringify({ subtasks }) };
    } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ error: String(err) }) };
    }
};
