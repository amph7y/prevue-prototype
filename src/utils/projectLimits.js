import { collection, query, where, getDocs, orderBy, limit, Timestamp, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase.js';

/**
 * Check if user has reached their lifetime project creation limit
 * @param {string} userId - User ID
 * @param {string} accessLevel - User access level ('free' or 'premium')
 * @returns {Promise<{canCreate: boolean, currentCount: number, limit: number, resetDate: Date|null}>}
 */
export async function checkLifetimeProjectLimit(userId, accessLevel) {
    if (!db || !userId) {
        return { canCreate: false, currentCount: 0, limit: 0, resetDate: null };
    }

    // limit based on access level
    const limits = {
        free: 2,
        premium: Infinity
    };
    
    const userLimit = limits[accessLevel] || limits.free;
    
    // If premium, no limit
    if (userLimit === Infinity) {
        return { canCreate: true, currentCount: 0, limit: Infinity, resetDate: null };
    }

    try {
        console.log('Lifetime limit check:', {
            userId,
            accessLevel,
            userLimit,
            isPremium: userLimit === Infinity
        });
        
        // Query ALL project creation events (lifetime)
        const creationEventsRef = collection(db, `users/${userId}/projectCreationEvents`);
        const q = query(
            creationEventsRef,
            orderBy('createdAt', 'desc')
        );
        const querySnapshot = await getDocs(q);
        const currentCount = querySnapshot.size;
        
        console.log('Query results (creation events lifetime):', {
            currentCount,
            canCreate: currentCount < userLimit,
            events: querySnapshot.docs.map(doc => ({
                id: doc.id,
                createdAt: doc.data().createdAt?.toDate?.()?.toISOString(),
                projectId: doc.data().projectId,
                projectName: doc.data().projectName
            }))
        });
        
        return {
            canCreate: currentCount < userLimit,
            currentCount,
            limit: userLimit,
            resetDate: null
        };
    } catch (error) {
        console.error('Error checking lifetime project limit:', error);
        // On error, allow creation to avoid blocking users
        return { canCreate: true, currentCount: 0, limit: userLimit, resetDate: null };
    }
}

/**
 * Format the reset date for display
 * @param {Date} resetDate - The date when the limit resets
 * @returns {string} Formatted date string
 */
export function formatResetDate(resetDate) {
    if (!resetDate) return '';
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
export async function debugLifetimeLimit(userId, accessLevel) {
    console.log('=== DEBUG LIFETIME LIMIT ===');
    const result = await checkLifetimeProjectLimit(userId, accessLevel);
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
export function testLifetimeCalculation() {
    console.log('=== TEST LIFETIME CALCULATION ===');
    console.log('No weekly window; counting total lifetime creation events.');
    console.log('=== END TEST ===');
}

// Backward compatibility: export old names pointing to new lifetime versions
export const checkWeeklyProjectLimit = checkLifetimeProjectLimit;
export const debugWeeklyLimit = debugLifetimeLimit;
export const testWeekCalculation = testLifetimeCalculation;
