import { collection, query, where, getDocs, orderBy, limit, Timestamp, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase.js';

/**
 * Check if user has reached their weekly project creation limit
 * @param {string} userId - User ID
 * @param {string} accessLevel - User access level ('free' or 'premium')
 * @returns {Promise<{canCreate: boolean, currentCount: number, limit: number, resetDate: Date}>}
 */
export async function checkWeeklyProjectLimit(userId, accessLevel) {
    if (!db || !userId) {
        return { canCreate: false, currentCount: 0, limit: 0, resetDate: new Date() };
    }

    // limit based on access level
    const limits = {
        free: 2,
        premium: Infinity
    };
    
    const userLimit = limits[accessLevel] || limits.free;
    
    // If premium, no limit
    if (userLimit === Infinity) {
        return { canCreate: true, currentCount: 0, limit: Infinity, resetDate: new Date() };
    }

    // Calculate the start of the current week (Monday)
    const now = new Date();
    const startOfWeek = new Date(now);
    const dayOfWeek = now.getDay();
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Handle Sunday as day 0
    startOfWeek.setDate(now.getDate() + daysToMonday);
    startOfWeek.setHours(0, 0, 0, 0);
    
    // Calculate the end of the current week (Sunday)
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    try {
        // Convert JavaScript dates to Firestore Timestamps
        const startOfWeekTimestamp = Timestamp.fromDate(startOfWeek);
        const endOfWeekTimestamp = Timestamp.fromDate(endOfWeek);
        
        console.log('Weekly limit check:', {
            userId,
            accessLevel,
            userLimit,
            isPremium: userLimit === Infinity,
            startOfWeek: startOfWeek.toISOString(),
            endOfWeek: endOfWeek.toISOString(),
            startOfWeekTimestamp: startOfWeekTimestamp.toDate().toISOString(),
            endOfWeekTimestamp: endOfWeekTimestamp.toDate().toISOString()
        });
        
        // Query project creation events this week (separate from actual projects)
        const creationEventsRef = collection(db, `users/${userId}/projectCreationEvents`);
        const q = query(
            creationEventsRef,
            where('createdAt', '>=', startOfWeekTimestamp),
            where('createdAt', '<=', endOfWeekTimestamp),
            orderBy('createdAt', 'desc')
        );
        
        const querySnapshot = await getDocs(q);
        const currentCount = querySnapshot.size;
        
        console.log('Query results (creation events):', {
            currentCount,
            canCreate: currentCount < userLimit,
            events: querySnapshot.docs.map(doc => ({
                id: doc.id,
                createdAt: doc.data().createdAt?.toDate?.()?.toISOString(),
                projectId: doc.data().projectId,
                projectName: doc.data().projectName
            }))
        });
        
        // Calculate next reset date (next Monday)
        const nextResetDate = new Date(startOfWeek);
        nextResetDate.setDate(startOfWeek.getDate() + 7);
        
        return {
            canCreate: currentCount < userLimit,
            currentCount,
            limit: userLimit,
            resetDate: nextResetDate
        };
    } catch (error) {
        console.error('Error checking weekly project limit:', error);
        // On error, allow creation to avoid blocking users
        return { canCreate: true, currentCount: 0, limit: userLimit, resetDate: new Date() };
    }
}

/**
 * Format the reset date for display
 * @param {Date} resetDate - The date when the limit resets
 * @returns {string} Formatted date string
 */
export function formatResetDate(resetDate) {
    return resetDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

/**
 * Debug function to test weekly limit calculation
 * @param {string} userId - User ID
 * @param {string} accessLevel - User access level
 */
export async function debugWeeklyLimit(userId, accessLevel) {
    console.log('=== DEBUG WEEKLY LIMIT ===');
    const result = await checkWeeklyProjectLimit(userId, accessLevel);
    console.log('Debug result:', result);
    console.log('=== END DEBUG ===');
    return result;
}

/**
 * Record a project creation event for tracking weekly limits
 * @param {string} userId - User ID
 * @param {string} projectId - Project ID
 * @param {string} projectName - Project name
 * @returns {Promise<void>}
 */
export async function recordProjectCreationEvent(userId, projectId, projectName) {
    if (!db || !userId) {
        console.warn('Cannot record project creation event: missing db or userId');
        return;
    }

    try {
        const creationEventRef = collection(db, `users/${userId}/projectCreationEvents`);
        await addDoc(creationEventRef, {
            projectId,
            projectName,
            createdAt: serverTimestamp()
        });
        console.log('Project creation event recorded:', { userId, projectId, projectName });
    } catch (error) {
        console.error('Error recording project creation event:', error);
        // Don't throw error to avoid blocking project creation
    }
}

/**
 * Test function to verify week calculation
 */
export function testWeekCalculation() {
    console.log('=== TEST WEEK CALCULATION ===');
    const now = new Date();
    console.log('Current date:', now.toISOString());
    console.log('Current day of week:', now.getDay(), '(0=Sunday, 1=Monday, etc.)');
    
    const startOfWeek = new Date(now);
    const dayOfWeek = now.getDay();
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    startOfWeek.setDate(now.getDate() + daysToMonday);
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    
    console.log('Start of week (Monday):', startOfWeek.toISOString());
    console.log('End of week (Sunday):', endOfWeek.toISOString());
    console.log('=== END TEST ===');
}
