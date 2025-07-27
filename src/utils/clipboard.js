import toast from 'react-hot-toast';

const copyToClipboardFallback = (text) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '-9999px';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            toast.success('Query copied to clipboard!');
        } else {
            toast.error('Failed to copy query.');
        }
    } catch (err) {
        toast.error('Failed to copy query.');
        console.error('Fallback copy failed:', err);
    }
    document.body.removeChild(textArea);
};

export const copyToClipboard = (text) => {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text)
            .then(() => toast.success('Query copied to clipboard!'))
            .catch(err => {
                console.warn('Clipboard API failed, trying fallback. Error:', err);
                copyToClipboardFallback(text);
            });
    } else {
        copyToClipboardFallback(text);
    }
};