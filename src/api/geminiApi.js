const GEMINI_API_URL = import.meta.env.VITE_GEMINI_FB_URL ;

export async function callGeminiAPI(prompt) {
    const response = await fetch(`${GEMINI_API_URL}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Could not parse error response.' }));
        throw new Error(errorData.error || `API error: ${response.statusText}`);
    }

    return await response.json();
}