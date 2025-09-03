
import toast from 'react-hot-toast';

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Standardized error handling for user-facing messages
export function handleError(error, context = '', showToast = true) {
    console.error(`Error${context ? ` in ${context}` : ''}:`, error);
    
    const userMessage = 'An error occurred. Please contact the administrator if this persists.';
    
    if (showToast) {
        toast.error(userMessage);
    }
    
    return userMessage;
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
