const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;

export async function callGeminiAPI(prompt) {
    if (!GEMINI_API_KEY) {
        throw new Error("Gemini API key not found. Please check your .env file.");
    }

    const payload = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
    };

    const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ message: 'Could not parse error response.' }));
        throw new Error(`API error: ${response.statusText} - ${errorBody.error?.message || 'Unknown API error'}`);
    }

    const result = await response.json();
    try {
        return JSON.parse(result.candidates[0].content.parts[0].text);
    } catch (parseError) {
        console.error("Failed to parse Gemini API response:", result.candidates[0].content.parts[0].text);
        throw new Error("The AI returned an invalid response format.");
    }
}