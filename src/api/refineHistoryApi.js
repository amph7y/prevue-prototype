import { db } from '../config/firebase.js';
import { collection, doc, getDocs, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore';

const collectionRef = (userId, projectId, dbKey) => {
    if (!userId || !projectId || !dbKey) return null;
    return collection(db, 'users', String(userId), 'projects', String(projectId), 'refineHistory', dbKey, 'snapshots');
}

export async function loadHistoryFromFirestore(userId, projectId, dbKey) {
    try {
        const col = collectionRef(userId, projectId, dbKey);
        if (!col) return [];
        const q = query(col, orderBy('date', 'desc'));
        const snap = await getDocs(q);
        const arr = [];
        snap.forEach(d => { arr.push(d.data()); });
        return arr;
    } catch (e) {
        console.debug('loadHistoryFromFirestore error', e);
        return [];
    }
}

export async function saveSnapshotToFirestore(userId, projectId, dbKey, entry) {
    try {
        const col = collectionRef(userId, projectId, dbKey);
        if (!col) return false;
        const docRef = doc(col, String(entry.id));
        await setDoc(docRef, entry, { merge: true });
        return true;
    } catch (e) {
        console.debug('saveSnapshotToFirestore error', e);
        return false;
    }
}

export async function clearHistoryInFirestore(userId, projectId, dbKey) {
    try {
        const col = collectionRef(userId, projectId, dbKey);
        if (!col) return false;
        const snap = await getDocs(col);
        const deletes = snap.docs.map(d => deleteDoc(doc(col, d.id)));
        await Promise.all(deletes);
        return true;
    } catch (e) {
        console.debug('clearHistoryInFirestore error', e);
        return false;
    }
}

export default { loadHistoryFromFirestore, saveSnapshotToFirestore, clearHistoryInFirestore };
