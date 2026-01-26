const FANAR_API_URL = import.meta.env.VITE_FANAR_FB_URL;

function safeJsonParse(text) {
    if (!text) throw new Error("Empty AI response");

    const cleaned = String(text)
        .trim()
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```$/i, "")
        .trim();

    return JSON.parse(cleaned);
}

export async function callFanarAPI(prompt, model = "Fanar-C-2-27B") {
    const response = await fetch(FANAR_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, model }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Could not parse error response." }));
        throw new Error(errorData.error || `API error: ${response.statusText}`);
    }

    const data = await response.json(); // { text, raw }
    return safeJsonParse(data.text);
}
