
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


export async function retryAsync(fn, { tries = 5, baseDelayMs = 800, factor = 3 } = {}) {
    let attempt = 0;
    let lastError;
    while (attempt < tries) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;
            attempt += 1;
            if (attempt >= tries) break;
            const delay = baseDelayMs * Math.pow(factor, attempt - 1);
            await sleep(delay);
        }
    }
    throw lastError;
};
