export const formatFirestoreTimestamp = (timestamp) => {
  if (!timestamp) return 'N/A';

  let date;
  // Firestore Timestamp object has toDate()
  if (typeof timestamp.toDate === 'function') {
    try {
      date = timestamp.toDate();
    } catch (_) {
      date = null;
    }
  }
  // Legacy plain object with _seconds
  if (!date && typeof timestamp._seconds === 'number') {
    date = new Date(timestamp._seconds * 1000);
  }
  // ISO string or Date accepted directly
  if (!date && typeof timestamp === 'string') {
    const parsed = new Date(timestamp);
    date = isNaN(parsed.getTime()) ? null : parsed;
  }
  if (!date && timestamp instanceof Date) {
    date = timestamp;
  }

  if (!date || isNaN(date.getTime())) return 'N/A';

  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};
