import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { retryAsync } from '../utils/utils.js';
import { searchPubmed } from '../api/pubmedApi.js';
import { searchElsevier } from '../api/elsevierApi.js';
import { searchCore } from '../api/coreApi.js';
import { searchSemanticScholar } from '../api/semanticScholarApi.js';
import { EXPORT_CAPS } from '../config/exportConfig.js';

// IndexedDB utils for persistent file storage
const DB_NAME = 'prevue-downloads';
const DB_VERSION = 1;
const STORE_NAME = 'file-blobs';

const openDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
    });
};

const saveFileBlob = async (downloadId, fileBlob) => {
    try {
        const db = await openDB();
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        return new Promise((resolve, reject) => {
            const request = store.put({ id: downloadId, blob: fileBlob, timestamp: Date.now() });
            request.onsuccess = () => {
                console.log(`Saved file blob for download ${downloadId}`);
                resolve();
            };
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('Failed to save file blob:', error);
    }
};

const getFileBlob = async (downloadId) => {
    try {
        const db = await openDB();
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        
        return new Promise((resolve, reject) => {
            const request = store.get(downloadId);
            request.onsuccess = () => {
                const result = request.result;
                console.log(`Retrieved file blob for download ${downloadId}:`, result ? 'Found' : 'Not found');
                resolve(result?.blob || null);
            };
            request.onerror = () => {
                console.error(`Failed to get file blob for ${downloadId}:`, request.error);
                reject(request.error);
            };
        });
    } catch (error) {
        console.error('Failed to get file blob:', error);
        return null;
    }
};

const deleteFileBlob = async (downloadId) => {
    try {
        const db = await openDB();
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        return new Promise((resolve, reject) => {
            const request = store.delete(downloadId);
            request.onsuccess = () => {
                console.log(`Deleted file blob for download ${downloadId}`);
                resolve();
            };
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('Failed to delete file blob:', error);
    }
};

const GlobalDownloadContext = createContext();

export const useGlobalDownload = () => {
    const context = useContext(GlobalDownloadContext);
    if (!context) {
        throw new Error('useGlobalDownload must be used within a GlobalDownloadProvider');
    }
    return context;
};

export const GlobalDownloadProvider = ({ children, currentProjectId = null }) => {
    const [downloads, setDownloads] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const cancelledDownloadsRef = useRef(new Set());

    // Load downloads from localStorage on mount and when currentProjectId changes
    useEffect(() => {
        const loadDownloads = async () => {
            if (!currentProjectId) {
                setDownloads([]);
                return;
            }

            const savedDownloads = [];
            const projectKey = `downloadCenter_${currentProjectId}`;
            
            try {
                const data = JSON.parse(localStorage.getItem(projectKey) || '{}');
                if (data && data.downloads) {
                    // Load file blobs from IndexedDB for completed downloads
                    const downloadsWithBlobs = await Promise.all(
                        data.downloads.map(async (download) => {
                            let fileBlob = null;
                            if (download.status === 'completed' || download.status === 'partial') {
                                console.log(`Loading file blob for ${download.id} (status: ${download.status})`);
                                fileBlob = await getFileBlob(download.id);
                                console.log(`Loaded file blob for ${download.id}:`, fileBlob ? 'Success' : 'Failed');
                            }
                            return {
                                ...download,
                                projectId: currentProjectId,
                                fileBlob
                            };
                        })
                    );
                    savedDownloads.push(...downloadsWithBlobs);
                }
            } catch (error) {
                console.error(`Failed to load downloads from ${projectKey}:`, error);
            }

            // Filter and sort downloads
            const now = Date.now();
            const validDownloads = savedDownloads.filter(download => {
                if (download.status === 'completed') {
                    const age = now - (download.completedTime || download.startTime);
                    return age < 7 * 24 * 60 * 60 * 1000; // 7 days
                }
                return true; // Keep processing downloads
            });

            // Sort by start time and limit to 5 total for this project (newest first)
            validDownloads.sort((a, b) => (b.startTime || 0) - (a.startTime || 0));
            const limitedDownloads = validDownloads.slice(0, 5);

            setDownloads(limitedDownloads);

            // Resume any processing downloads
            limitedDownloads
                .filter(download => download.status === 'processing')
                .forEach(download => {
                    console.log(`Resuming background download: ${download.name}`);
                    resumeBackgroundDownload(download);
                });
        };

        loadDownloads();
    }, [currentProjectId]);

    // Save downloads to localStorage whenever they change
    useEffect(() => {
        const saveDownloads = async () => {
            if (!currentProjectId || downloads.length === 0) return;

            const projectKey = `downloadCenter_${currentProjectId}`;
            
            // Save file blobs to IndexedDB and prepare data for localStorage
            const downloadsToSave = [];
            
            for (const download of downloads) {
                if (download.fileBlob && (download.status === 'completed' || download.status === 'partial')) {
                    // Save file blob to IndexedDB
                    console.log(`Saving file blob for ${download.id} (status: ${download.status})`);
                    await saveFileBlob(download.id, download.fileBlob);
                    console.log(`Saved file blob for ${download.id}`);
                }
                
                // Remove projectId and fileBlob before saving to localStorage
                const { projectId: _, fileBlob, ...downloadData } = download;
                downloadsToSave.push(downloadData);
            }

            try {
                const dataToSave = {
                    isOpen: false,
                    downloads: downloadsToSave
                };
                localStorage.setItem(projectKey, JSON.stringify(dataToSave));
            } catch (error) {
                console.error(`Failed to save downloads for project ${currentProjectId}:`, error);
            }
        };

        saveDownloads();
    }, [downloads, currentProjectId]);

    const addDownload = useCallback((download) => {
        if (!currentProjectId) {
            console.warn('Cannot add download: no current project');
            return null;
        }
        
        const downloadWithProject = {
            ...download,
            projectId: currentProjectId,
            id: download.id || `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            startTime: Date.now(),
            status: 'processing'
        };

        setDownloads(prev => {
            // Add new download at the beginning (latest first)
            const newDownloads = [downloadWithProject, ...prev];
            
            // Enforce 5 file limit - keep only the 5 most recent downloads
            if (newDownloads.length > 5) {
                const keptDownloads = newDownloads.slice(0, 5);
                const removedDownloads = newDownloads.slice(5);
                
                // Delete file blobs for removed downloads
                removedDownloads.forEach(async (download) => {
                    if (download.status === 'completed' || download.status === 'partial') {
                        await deleteFileBlob(download.id);
                        console.log(`Auto-deleted old download: ${download.name}`);
                    }
                });
                
                return keptDownloads;
            }
            
            return newDownloads;
        });

        // Start background processing
        processBackgroundDownload(downloadWithProject);
        
        return downloadWithProject.id;
    }, [currentProjectId]);

    const updateDownload = useCallback((downloadId, updates) => {
        setDownloads(prev => prev.map(download => 
            download.id === downloadId 
                ? { ...download, ...updates }
                : download
        ));
    }, []);

    const removeDownload = useCallback(async (downloadId) => {
        // Mark download as cancelled to stop background processing
        cancelledDownloadsRef.current.add(downloadId);
        
        // Remove file blob from IndexedDB
        await deleteFileBlob(downloadId);
        
        setDownloads(prev => prev.filter(d => d.id !== downloadId));
    }, []);

    const retryDownload = useCallback((downloadId) => {
        const download = downloads.find(d => d.id === downloadId);
        if (!download || (download.status !== 'failed' && download.status !== 'partial')) {
            console.warn('Cannot retry: download not found or not in failed or partial state');
            return;
        }
        
        console.log(`Retrying download: ${download.name}`);
        
        // Reset the download state
        updateDownload(downloadId, {
            status: 'processing',
            progress: 0,
            error: null,
            failedAt: null,
            processedRecords: 0
        });
        
        // Restart the background processing
        processBackgroundDownload(download);
        
        toast.success('Retrying download...');
    }, [downloads, updateDownload]);

    const processBackgroundDownload = async (download) => {
        try {
            // Check if download was cancelled before starting
            if (cancelledDownloadsRef.current.has(download.id)) {
                console.log(`Download ${download.id} was cancelled, stopping processing`);
                return;
            }
            
            const { projectId, format, options, queries, searchTotals } = download;
            
            updateDownload(download.id, { status: 'processing', progress: 5 });

            const databasesToExport = options.selectedDBs && options.selectedDBs.length > 0 
                ? options.selectedDBs 
                : Object.keys(queries).filter(dbKey => queries[dbKey]);
                        
            let totalRecords = 0;
            let cappedTotalRecords = 0;
            for (const dbKey of databasesToExport) {
                const dbTotal = Number(searchTotals?.[dbKey] || 0);
                totalRecords += dbTotal;
                cappedTotalRecords += Math.min(dbTotal, EXPORT_CAPS[dbKey] || dbTotal);
            }
            
            const quotaPercent = typeof download.options?.exportQuotaPercent === 'number' ? download.options.exportQuotaPercent : 0.5; // Default to 50% for free users
            const globalTarget = Math.floor(totalRecords * quotaPercent);
            
            let expectedRecords;
            if (download.options?.exportFullDataset) {
                // Full dataset mode: ignore database caps, just apply quota
                expectedRecords = globalTarget;
            } else {
                // Capped mode: apply both quota and database caps
                expectedRecords = Math.min(globalTarget, cappedTotalRecords);
            }
            updateDownload(download.id, { 
                totalRecords: expectedRecords, 
                originalTotalRecords: totalRecords,
                progress: 10 
            });

            // Check if download was cancelled before fetching articles
            if (cancelledDownloadsRef.current.has(download.id)) {
                console.log(`Download ${download.id} was cancelled before fetching articles`);
                return;
            }

            const allArticles = await fetchAllArticles(download, totalRecords);
            
            // Check if download was cancelled after fetching articles
            if (cancelledDownloadsRef.current.has(download.id)) {
                console.log(`Download ${download.id} was cancelled after fetching articles`);
                return;
            }
            
            // Check if download was cancelled before generating file
            if (cancelledDownloadsRef.current.has(download.id)) {
                console.log(`Download ${download.id} was cancelled before generating file`);
                return;
            }
            
            const fileBlob = await generateExportFile(format, allArticles, options);
            
            // Check if download was cancelled after generating file
            if (cancelledDownloadsRef.current.has(download.id)) {
                console.log(`Download ${download.id} was cancelled after generating file`);
                return;
            }
            
            const expectedTotal = download.totalRecords || (() => {
                const quotaPercent = typeof download.options?.exportQuotaPercent === 'number' ? download.options.exportQuotaPercent : 0.5;
                const globalTarget = Math.floor(totalRecords * quotaPercent);
                
                if (download.options?.exportFullDataset) {
                    // Full dataset mode: ignore database caps, just apply quota
                    return globalTarget;
                } else {
                    // Capped mode: apply both quota and database caps
                    return Math.min(globalTarget, cappedTotalRecords);
                }
            })();
            const actualTotal = allArticles.length;
            const isComplete = actualTotal >= expectedTotal;
            
            console.log('Completing download with file blob:', fileBlob);
            console.log(`Downloaded ${actualTotal} of ${expectedTotal} expected records (capped)`);
            
            updateDownload(download.id, { 
                status: isComplete ? 'completed' : 'partial', 
                progress: 100, 
                fileBlob,
                completedTime: Date.now(),
                articleCount: allArticles.length,
                expectedCount: expectedTotal,
                originalExpectedCount: download.originalTotalRecords,
                isComplete: isComplete
            });
            
            if (isComplete) {
                const originalTotal = download.originalTotalRecords || expectedTotal;
                if (originalTotal > expectedTotal) {
                    toast.success(`Export completed! ${allArticles.length} articles downloaded (capped at ${expectedTotal} due to temporary limits). Original total: ${originalTotal} articles.`);
                } else {
                    toast.success(`Export completed! All ${allArticles.length} articles downloaded successfully.`);
                }
            } else {
                toast.success(`Export completed with ${allArticles.length} articles (${expectedTotal} expected). Some records may be unavailable.`);
            }
            
        } catch (error) {
            // Don't update status if download was cancelled
            if (cancelledDownloadsRef.current.has(download.id)) {
                console.log(`Download ${download.id} was cancelled, not showing error`);
                return;
            }
            
            console.error('Background download failed:', error);
            updateDownload(download.id, { 
                status: 'failed', 
                error: error.message 
            });
            toast.error(`Export failed: ${error.message}`);
        }
    };

    const resumeBackgroundDownload = (download) => {
        // Resume processing if it was interrupted
        if (download.status === 'processing' && download.progress < 100) {
            processBackgroundDownload(download);
        }
    };

    const fetchAllArticles = async (download, totalRecords) => {
        // Check if download was cancelled
        if (cancelledDownloadsRef.current.has(download.id)) {
            console.log(`Download ${download.id} was cancelled, returning empty articles`);
            return [];
        }
        
        const { queries, searchTotals, options } = download;
        const allArticles = [];
        const seenIds = new Set(); // Track unique IDs to prevent duplicates
        const globalQuotaPercent = typeof options?.exportQuotaPercent === 'number' ? options.exportQuotaPercent : 0.5; // Default to 50% for free users
        
        // Use the same database filtering logic as processBackgroundDownload
        const databasesToExport = options.selectedDBs && options.selectedDBs.length > 0 
            ? options.selectedDBs 
            : Object.keys(queries).filter(dbKey => queries[dbKey]);
        
        // Calculate the same capped total as in processBackgroundDownload
        let cappedTotalRecords = 0;
        let totalAvailableRecords = 0;
        for (const dbKey of databasesToExport) {
            const dbTotal = Number(searchTotals?.[dbKey] || 0);
            totalAvailableRecords += dbTotal;
            cappedTotalRecords += Math.min(dbTotal, EXPORT_CAPS[dbKey] || dbTotal);
        }
        
        // For free users: 50% of total records, with different cap handling
        // For premium users: 100% of total records, with different cap handling
        const baseTotalForQuota = totalAvailableRecords; // Always use total records for quota calculation
        const globalTarget = Math.floor(baseTotalForQuota * globalQuotaPercent);
        
        // Apply caps differently based on export mode and user type
        let finalTarget;
        if (options?.exportFullDataset) {
            // Full dataset mode: ignore database caps, just apply quota
            finalTarget = globalTarget;
        } else {
            // Capped mode: apply both quota and database caps
            finalTarget = Math.min(globalTarget, cappedTotalRecords);
        }
        
        console.log('🔍 QUOTA DEBUG:', {
            exportQuotaPercent: options?.exportQuotaPercent,
            globalQuotaPercent,
            exportFullDataset: options?.exportFullDataset,
            totalAvailableRecords,
            cappedTotalRecords,
            baseTotalForQuota,
            globalTarget,
            finalTarget,
            searchTotals,
            databasesToExport,
            isFreeUser: globalQuotaPercent < 1,
            mode: options?.exportFullDataset ? 'full_dataset' : 'capped'
        });

        // Per-database batch sizes (optimized for each API's rate limits)
        const getBatchSize = (dbKey) => {
            switch (dbKey) {
                case 'scopus':
                case 'embase':
                    return 25; // Scopus has very strict rate limits
                case 'pubmed':
                    return 50; 
                case 'semanticScholar':
                    return 100; // Semantic Scholar allows reasonable batch sizes
                case 'core':
                default:
                    return 500; // Default batch size
            }
        };
        
        // Calculate per-database targets based on final target (quota + caps)
        const dbTargets = {};
        let remainingTarget = finalTarget;
        
        // First pass: allocate targets proportionally based on total records
        databasesToExport.forEach(dbKey => {
            const totalCount = Number(searchTotals?.[dbKey] || 0);
            if (totalCount === 0) {
                dbTargets[dbKey] = 0;
                return;
            }
            
            const exportCap = EXPORT_CAPS[dbKey] || totalCount;
            const proportion = totalCount / baseTotalForQuota; // Use total records for proportion
            const allocatedTarget = Math.floor(finalTarget * proportion);
            
            // Apply database cap differently based on mode
            if (options?.exportFullDataset) {
                // Full dataset mode: no database caps applied
                dbTargets[dbKey] = allocatedTarget;
            } else {
                // Capped mode: apply database cap as ceiling
                dbTargets[dbKey] = Math.min(allocatedTarget, exportCap);
            }
        });
        
        // Second pass: distribute any remaining quota
        const totalAllocated = Object.values(dbTargets).reduce((sum, target) => sum + target, 0);
        if (totalAllocated < finalTarget) {
            const remaining = finalTarget - totalAllocated;
            databasesToExport.forEach(dbKey => {
                const totalCount = Number(searchTotals?.[dbKey] || 0);
                if (totalCount === 0) return;
                
                const exportCap = EXPORT_CAPS[dbKey] || totalCount;
                
                // Apply database cap differently based on mode
                if (options?.exportFullDataset) {
                    // Full dataset mode: no database caps applied
                    const canAdd = Math.min(remaining, totalCount - dbTargets[dbKey]);
                    dbTargets[dbKey] += canAdd;
                } else {
                    // Capped mode: apply database cap as ceiling
                    const canAdd = Math.min(remaining, exportCap - dbTargets[dbKey]);
                    dbTargets[dbKey] += canAdd;
                }
            });
        }
        
        console.log(`Final target: ${finalTarget} (quota: ${globalTarget}, mode: ${options?.exportFullDataset ? 'full_dataset' : 'capped'}), DB targets:`, dbTargets);
        
        // Create all database tasks upfront
        const databaseTasks = databasesToExport.map(async (dbKey) => {
            const query = queries[dbKey];
            if (!query) return [];
            
            const totalCount = searchTotals?.[dbKey] || 0;
            if (totalCount === 0) return [];
            
            const dbTarget = dbTargets[dbKey];
            const batchSize = getBatchSize(dbKey);
            
            console.log(`Starting fetch for ${dbKey}: target ${dbTarget} records in batches of ${batchSize}`);
            
            const dbArticles = [];
            let dbProcessedRecords = 0;
            
            // Process batches for this database
            let offset = 0;
            let shouldStop = false;
            while (dbProcessedRecords < dbTarget && !shouldStop) {
                // Check if download was cancelled
                if (cancelledDownloadsRef.current.has(download.id)) {
                    console.log(`🛑 ${dbKey}: Download ${download.id} was cancelled, stopping batch processing`);
                    break;
                }
                
                const remainingForDb = dbTarget - dbProcessedRecords;
                const currentBatchSize = Math.min(batchSize, remainingForDb);
                
                // If no more records needed, stop
                if (currentBatchSize <= 0 || dbProcessedRecords >= dbTarget) {
                    console.log(`🛑 ${dbKey}: No more records needed (processed: ${dbProcessedRecords}, target: ${dbTarget}), stopping fetch`);
                    break;
                }
                
                try {
                    const response = await retryAsync(async () => {
                        console.log(`🔍 API CALL: ${dbKey} - offset: ${offset}, size: ${currentBatchSize}, target: ${dbTarget}, processed: ${dbProcessedRecords}`);
                        
                        if (dbKey === 'pubmed') {
                            return await searchPubmed(query, currentBatchSize, offset);
                        } else if (dbKey === 'scopus' || dbKey === 'embase') {
                            return await searchElsevier(dbKey, query, currentBatchSize, offset);
                        } else if (dbKey === 'core') {
                            return await searchCore(query, currentBatchSize, offset);
                        } else if (dbKey === 'semanticScholar') {
                            const result = await searchSemanticScholar(query, currentBatchSize, offset);
                            return result.data || [];
                        }
                        throw new Error(`Unsupported database: ${dbKey}`);
                    }, { 
                        tries: 3, 
                        baseDelayMs: 1000, 
                        factor: 3
                    });
                    
                    const articles = response.data || response;
                    console.log(`📥 API RESPONSE: ${dbKey} - requested: ${currentBatchSize}, received: ${articles?.length || 0}`);
                    
                    // If we got no articles, we've likely reached the end of available results
                    // For Semantic Scholar, this can happen when offset exceeds available results
                    if (!articles || articles.length === 0) {
                        if (dbKey === 'semanticScholar') {
                            console.log(`🛑 ${dbKey}: No more results available at offset ${offset}, stopping fetch`);
                        } else {
                            console.log(`⚠️ ${dbKey}: Empty response at offset ${offset}, may have reached end of results`);
                        }
                        shouldStop = true;
                        continue; // Skip to next iteration, which will exit due to shouldStop
                    }
                    
                    if (articles && articles.length > 0) {
                        const processedArticles = articles.map(article => ({
                            ...article,
                            sourceDB: dbKey,
                            uniqueId: article.uniqueId || `${dbKey}_${article.uid || article.id || (dbKey === 'semanticScholar' ? article.paperId : null) || Math.random().toString(36).substr(2, 9)}`
                        }));
                        
                        // Only add articles that haven't been seen before
                        const newArticles = processedArticles.filter(article => {
                            const id = article.uniqueId || `${dbKey}_${article.uid || article.id || (dbKey === 'semanticScholar' ? article.paperId : null)}`;
                            if (seenIds.has(id)) {
                                return false; // Skip duplicate
                            }
                            seenIds.add(id);
                            return true;
                        });
                        
                        dbArticles.push(...newArticles);
                        dbProcessedRecords += newArticles.length;
                        
                        console.log(`✅ ${dbKey}: ${newArticles.length} new articles (${dbProcessedRecords}/${dbTarget})`);
                        
                        // Check if we've exceeded our target and trim if necessary
                        if (dbProcessedRecords > dbTarget) {
                            const excess = dbProcessedRecords - dbTarget;
                            console.log(`⚠️ ${dbKey}: Exceeded target by ${excess} articles, trimming`);
                            dbArticles.splice(-excess);
                            dbProcessedRecords = dbTarget;
                        }
                        
                        // If we've reached our target, stop fetching immediately
                        if (dbProcessedRecords >= dbTarget) {
                            console.log(`🛑 ${dbKey}: Reached target ${dbTarget} after processing batch, stopping fetch`);
                            break;
                        }
                    }
                    
                    // Check if download was cancelled before rate limiting delay
                    if (cancelledDownloadsRef.current.has(download.id)) {
                        console.log(`🛑 ${dbKey}: Download ${download.id} was cancelled, stopping batch processing`);
                        break;
                    }
                    
                    // Rate limiting delay per database
                    await new Promise(resolve => setTimeout(resolve, 2500));
                    
                    // Check again after delay
                    if (cancelledDownloadsRef.current.has(download.id)) {
                        console.log(`🛑 ${dbKey}: Download ${download.id} was cancelled after delay, stopping batch processing`);
                        break;
                    }
                    
                } catch (error) {
                    console.error(`❌ ${dbKey} failed at offset ${offset}:`, error.message);
                    break;
                }
                offset += currentBatchSize;
            }
            
            console.log(`🏁 ${dbKey} completed: ${dbArticles.length} articles`);
            return dbArticles;
        });
        
        // Check if download was cancelled before processing database tasks
        if (cancelledDownloadsRef.current.has(download.id)) {
            console.log(`Download ${download.id} was cancelled before processing database tasks`);
            return [];
        }
        
        updateDownload(download.id, { progress: 20 }); // Show we're starting
        
        const results = await Promise.allSettled(databaseTasks);
        
        // Check if download was cancelled after processing database tasks
        if (cancelledDownloadsRef.current.has(download.id)) {
            console.log(`Download ${download.id} was cancelled after processing database tasks`);
            return allArticles; // Return what we have so far
        }
        
        let totalProcessed = 0;
        const failedDatabases = [];
        
        results.forEach((result, index) => {
            const dbKey = databasesToExport[index];
            if (result.status === 'fulfilled' && result.value.length > 0) {
                allArticles.push(...result.value);
                totalProcessed += result.value.length;
                console.log(`✅ ${dbKey}: Successfully processed ${result.value.length} articles`);
            } else {
                failedDatabases.push(dbKey);
                console.log(`❌ ${dbKey}: Failed or no articles`);
            }
        });
        
        // Final check: ensure we don't exceed the final target (quota + caps)
        if (allArticles.length > finalTarget) {
            console.log(`🛑 Final target exceeded: ${allArticles.length} > ${finalTarget}, trimming to target`);
            allArticles.splice(finalTarget);
            totalProcessed = allArticles.length;
        }
        
        // Calculate progress based on final target (quota + caps)
        const progressPercent = finalTarget > 0 ? Math.min(90, Math.floor((totalProcessed / finalTarget) * 90)) : 90;
        updateDownload(download.id, { 
            processedRecords: totalProcessed, 
            progress: progressPercent 
        });
        
        if (failedDatabases.length > 0) {
            console.log(`⚠️ Some databases failed: ${failedDatabases.join(', ')}. Continuing with ${allArticles.length} articles.`);
        }
        
        console.log(`Final result: ${allArticles.length} articles (target was ${finalTarget})`);
        return allArticles;
    };

    // Deduplication utility functions
    const cleanString = (str) => {
        if (!str) return '';
        return String(str)
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
            .replace(/\s+/g, ' ')     // Normalize whitespace
            .trim();
    };

    // Calculate similarity between two strings using Levenshtein distance
    const calculateSimilarity = (str1, str2) => {
        const s1 = cleanString(str1);
        const s2 = cleanString(str2);
        if (!s1 || !s2) return 0;
        if (s1 === s2) return 1;

        const len1 = s1.length;
        const len2 = s2.length;
        if (len1 === 0 || len2 === 0) return 0;

        // Use a simpler approach: longest common subsequence ratio
        const longer = len1 > len2 ? s1 : s2;
        const shorter = len1 > len2 ? s2 : s1;
        
        // Check if shorter is a substantial substring of longer
        if (longer.includes(shorter) && shorter.length / longer.length >= 0.85) {
            return 0.9; // High similarity
        }

        // Calculate Levenshtein distance
        const matrix = [];
        for (let i = 0; i <= len2; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= len1; j++) {
            matrix[0][j] = j;
        }
        for (let i = 1; i <= len2; i++) {
            for (let j = 1; j <= len1; j++) {
                if (s2[i - 1] === s1[j - 1]) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        const distance = matrix[len2][len1];
        const maxLen = Math.max(len1, len2);
        return 1 - (distance / maxLen);
    };

    // Normalize author name for comparison
    const normalizeAuthorName = (name) => {
        if (!name) return '';
        return String(name)
            .toLowerCase()
            .replace(/[^\w\s]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    };

    // Extract author names from article
    const extractAuthorNames = (article) => {
        if (!article.authors) return [];
        return article.authors
            .map(a => {
                const name = typeof a === 'string' ? a : (a?.name || '');
                return normalizeAuthorName(name);
            })
            .filter(name => name.length > 0);
    };

    // Check if two articles have at least 2 overlapping authors
    const hasAuthorOverlap = (article1, article2) => {
        const authors1 = extractAuthorNames(article1);
        const authors2 = extractAuthorNames(article2);
        
        if (authors1.length === 0 || authors2.length === 0) return false;
        
        const overlap = authors1.filter(a1 => authors2.includes(a1));
        return overlap.length >= 2;
    };

    // Normalize DOI for comparison
    const normalizeDOI = (doi) => {
        if (!doi) return null;
        return String(doi)
            .toLowerCase()
            .replace(/^https?:\/\/(dx\.)?doi\.org\//, '')
            .replace(/^doi:/, '')
            .trim();
    };

    // Check if two articles are duplicates
    const areDuplicates = (article1, article2) => {
        // Extract source(s) from each article (handle both single and merged sources)
        const getSources = (article) => {
            const sourceStr = article.sourceDB || '';
            return sourceStr.split(';').map(s => s.trim()).filter(s => s);
        };
        
        const sources1 = getSources(article1);
        const sources2 = getSources(article2);
        
        // Must come from different sources (no overlap in source sets)
        const hasSourceOverlap = sources1.some(s1 => sources2.includes(s1));
        if (hasSourceOverlap) {
            return false; // Same source(s), not duplicates
        }

        // Check DOI match (if both have DOIs) - strongest indicator
        const doi1 = normalizeDOI(article1.doi || article1.externalIds?.DOI);
        const doi2 = normalizeDOI(article2.doi || article2.externalIds?.DOI);
        if (doi1 && doi2 && doi1 === doi2) {
            return true;
        }

        // Check title similarity (≥ 85%) - must have both titles
        const title1 = (article1.title || '').trim();
        const title2 = (article2.title || '').trim();
        if (title1.length >= 10 && title2.length >= 10) { // Only check if titles are substantial
            const similarity = calculateSimilarity(title1, title2);
            if (similarity >= 0.85) {
                // If title similarity is high, also check authors to be more confident
                const authors1 = extractAuthorNames(article1);
                const authors2 = extractAuthorNames(article2);
                // If both have authors, require at least 1 overlap for title match
                if (authors1.length > 0 && authors2.length > 0) {
                    const authorOverlap = authors1.filter(a1 => authors2.includes(a1));
                    if (authorOverlap.length >= 1) {
                        return true;
                    }
                } else {
                    // If no authors, rely on title similarity alone
                    return true;
                }
            }
        }

        // Check author overlap (≥ 2 authors) - only if we have enough authors
        if (hasAuthorOverlap(article1, article2)) {
            // Also check title similarity to be more confident
            if (title1.length >= 5 && title2.length >= 5) {
                const similarity = calculateSimilarity(title1, title2);
                if (similarity >= 0.70) { // Lower threshold when we have author match
                    return true;
                }
            } else {
                // If titles are too short, rely on author overlap alone
                return true;
            }
        }

        return false;
    };

    // Merge multiple articles, keeping the most complete metadata
    const mergeArticles = (articles) => {
        if (articles.length === 0) return null;
        if (articles.length === 1) return articles[0];
        
        const merged = { ...articles[0] };
        
        // Collect all unique sources from all articles
        const sources = new Set();
        articles.forEach(article => {
            // Handle both single source strings and already merged sources (semicolon-separated)
            const articleSources = (article.sourceDB || '').split(';').map(s => s.trim()).filter(s => s);
            articleSources.forEach(source => sources.add(source));
        });
        
        // Merge sources (sorted for consistency)
        merged.sourceDB = Array.from(sources).sort().join('; ');

        // Keep longer/more complete title from all articles
        articles.forEach(article => {
            if ((article.title || '').length > (merged.title || '').length) {
                merged.title = article.title;
            }
        });

        // Merge authors (keep unique authors from all articles)
        const allAuthors = [];
        const seenAuthorNames = new Set();
        
        articles.forEach(article => {
            if (Array.isArray(article.authors)) {
                article.authors.forEach(author => {
                    const name = typeof author === 'string' ? author : (author?.name || '');
                    const normalized = normalizeAuthorName(name);
                    if (normalized && !seenAuthorNames.has(normalized)) {
                        seenAuthorNames.add(normalized);
                        allAuthors.push(typeof author === 'string' ? { name } : author);
                    }
                });
            }
        });
        merged.authors = allAuthors;

        // Keep most complete year from all articles
        articles.forEach(article => {
            if (article.year && (!merged.year || article.year > merged.year)) {
                merged.year = article.year;
            }
            if (article.pubdate && (!merged.pubdate || article.pubdate > merged.pubdate)) {
                merged.pubdate = article.pubdate;
            }
        });

        // Keep most complete journal/venue from all articles
        articles.forEach(article => {
            if ((article.venue || '').length > (merged.venue || '').length) {
                merged.venue = article.venue;
            }
            if ((article.journal || '').length > (merged.journal || '').length) {
                merged.journal = article.journal;
            }
            if ((article.source || '').length > (merged.source || '').length) {
                merged.source = article.source;
            }
        });

        // Keep most complete DOI from all articles
        articles.forEach(article => {
            if (!merged.doi && article.doi) {
                merged.doi = article.doi;
            }
            if (article.externalIds) {
                if (!merged.externalIds) {
                    merged.externalIds = { ...article.externalIds };
                } else {
                    merged.externalIds = { ...merged.externalIds, ...article.externalIds };
                }
            }
        });

        // Keep longest abstract from all articles
        articles.forEach(article => {
            if ((article.abstract || '').length > (merged.abstract || '').length) {
                merged.abstract = article.abstract;
            }
        });

        // Keep other fields from articles with more complete data
        articles.forEach(article => {
            if (article.url && !merged.url) merged.url = article.url;
            if (article.citationCount !== undefined && (merged.citationCount === undefined || article.citationCount > merged.citationCount)) {
                merged.citationCount = article.citationCount;
            }
            if (article.fieldsOfStudy && (!merged.fieldsOfStudy || article.fieldsOfStudy.length > merged.fieldsOfStudy.length)) {
                merged.fieldsOfStudy = article.fieldsOfStudy;
            }
        });

        return merged;
    };

    // Main deduplication function
    const deduplicateArticles = (articles) => {
        if (!articles || articles.length === 0) return articles;

        console.log(`Starting deduplication of ${articles.length} articles...`);
        const deduplicated = [];
        const processed = new Set();

        for (let i = 0; i < articles.length; i++) {
            if (processed.has(i)) continue;

            // Collect all duplicates of this article (including itself)
            const duplicateGroup = [articles[i]];
            const duplicateIndices = [i];

            // Find all duplicates of this article
            for (let j = i + 1; j < articles.length; j++) {
                if (processed.has(j)) continue;

                // Check if articles[j] is a duplicate of any article in the current group
                const isDuplicate = duplicateGroup.some(groupArticle => 
                    areDuplicates(groupArticle, articles[j])
                );

                if (isDuplicate) {
                    duplicateIndices.push(j);
                    duplicateGroup.push(articles[j]);
                }
            }

            // Mark all duplicates as processed
            duplicateIndices.forEach(idx => processed.add(idx));

            // Merge all duplicates in the group at once
            const mergedArticle = mergeArticles(duplicateGroup);
            deduplicated.push(mergedArticle);
        }

        console.log(`Deduplication complete: ${articles.length} → ${deduplicated.length} articles`);
        return deduplicated;
    };

    const generateExportFile = async (format, articles, options) => {
        // Apply deduplication before generating export file if enabled
        let processedArticles = articles;
        if (options?.deduplicate === true) {
            processedArticles = deduplicateArticles(articles);
        }

        if (format === 'csv') {
            return generateCsvFile(processedArticles, options);
        } else if (format === 'ris') {
            return generateRisFile(processedArticles, options);
        } else if (format === 'printable') {
            return generatePrintableFile(processedArticles, options);
        }
        throw new Error(`Unsupported format: ${format}`);
    };

    const generateCsvFile = (articles, options) => {
        const headers = ['Title', 'Authors', 'Year', 'Journal/Venue', 'DOI', 'Abstract', 'Source'];
        const escapeCsvCell = (cell) => `"${String(cell || '').replace(/"/g, '""')}"`;
        
        const formatAuthors = (authors) => {
            if (!authors) return '';
            if (Array.isArray(authors)) {
                return authors.map(a => {
                    if (typeof a === 'string') return a;
                    if (a && typeof a === 'object' && a.name) return a.name;
                    return '';
                }).join('; ');
            }
            return typeof authors === 'string' ? authors : '';
        };
        
        const rows = articles.map(item => [
            escapeCsvCell(item.title),
            escapeCsvCell(formatAuthors(item.authors)),
            escapeCsvCell(item.year || item.pubdate),
            escapeCsvCell(item.venue || item.journal || item.source),
            escapeCsvCell(item.doi || item.externalIds?.DOI),
            escapeCsvCell(item.abstract),
            escapeCsvCell(item.sourceDB)
        ].join(','));
        
        const csvContent = [headers.join(','), ...rows].join('\n');
        return new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    };

    const generateRisFile = (articles, options) => {
        const risContent = articles.map(item => {
            let ris = `TY  - JOUR\n`;
            if(item.title) ris += `TI  - ${item.title}\n`;
            item.authors?.forEach(author => { ris += `AU  - ${author.name}\n`; });
            if(item.year || item.pubdate) ris += `PY  - ${item.year || item.pubdate}\n`;
            if(item.venue || item.source) ris += `JO  - ${item.venue || item.source}\n`;
            const doi = item.doi || item.externalIds?.DOI;
            if(doi) ris += `DO  - ${doi}\n`;
            if(item.abstract) ris += `AB  - ${item.abstract}\n`;
            // Add source information as a note
            if(item.sourceDB) ris += `N1  - Source: ${item.sourceDB}\n`;
            ris += `ER  - \n`;
            return ris;
        }).join('');
        
        return new Blob([risContent], { type: 'application/x-research-info-systems' });
    };

    const generatePrintableFile = (articles, options) => {
        const htmlContent = `<html><head><title>Printable Report</title><style>body{font-family:sans-serif;line-height:1.5;padding:20px}article{border-bottom:1px solid #eee;padding-bottom:1rem;margin-bottom:1rem}h3{font-size:1.2rem;margin-bottom:0.5rem}p{margin:0.25rem 0}.meta{font-size:0.9rem;color:#555}</style></head><body><h1>Export Results</h1>${articles.map((item, index) => `<article><h3>${index + 1}. ${item.title || 'No Title'}</h3><p class="meta"><strong>Authors:</strong> ${item.authors?.map(a => a.name).join(', ')}</p><p class="meta"><strong>Journal/Venue:</strong> ${item.venue || item.source || 'N/A'} (${item.year || item.pubdate || 'N/A'})</p><p class="meta"><strong>DOI:</strong> ${item.doi || item.externalIds?.DOI || 'N/A'}</p><p class="meta"><strong>Source:</strong> ${item.sourceDB || 'N/A'}</p><p><strong>Abstract:</strong> ${item.abstract || 'No abstract available.'}</p></article>`).join('')}</body></html>`;
        
        return new Blob([htmlContent], { type: 'text/html' });
    };

    const downloadFile = useCallback(async (downloadId) => {
        console.log(`Attempting to download file with ID: ${downloadId}`);
        
        const download = downloads.find(d => d.id === downloadId);
        if (!download) {
            console.error('Download not found in downloads array:', downloads);
            toast.error('Download not found.');
            return;
        }
        
        console.log('Found download:', download);
        console.log('Download has fileBlob in memory:', !!download.fileBlob);
        let fileBlob = download.fileBlob;
        
        // If blob is not in memory, try to load from IndexedDB
        if (!fileBlob && (download.status === 'completed' || download.status === 'partial')) {
            console.log('File blob not in memory, attempting to load from IndexedDB...');
            try {
                fileBlob = await getFileBlob(downloadId);
                console.log('Retrieved from IndexedDB:', fileBlob ? 'Success' : 'Failed');
            } catch (error) {
                console.error('Error loading from IndexedDB:', error);
            }
        }
        
        if (!fileBlob) {
            console.error('File blob is null or undefined');
            toast.error('File not available. It may have been lost or expired.');
            return;
        }
        
        console.log('Creating download link with blob:', fileBlob);
        const link = document.createElement('a');
        link.href = URL.createObjectURL(fileBlob);
        link.download = download.name || 'export';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
        
        console.log('Download initiated successfully');
    }, [downloads]);

    const cleanupOldDownloads = useCallback(async () => {
        setDownloads(prev => {
            // Keep only the 3 most recent downloads after cleanup
            const sortedDownloads = [...prev].sort((a, b) => (b.startTime || 0) - (a.startTime || 0));
            const keptDownloads = sortedDownloads.slice(0, 3);
            const removedDownloads = sortedDownloads.slice(3);
            
            // Delete file blobs for removed downloads
            removedDownloads.forEach(async (download) => {
                if (download.status === 'completed' || download.status === 'partial') {
                    await deleteFileBlob(download.id);
                    console.log(`Cleaned up download: ${download.name}`);
                }
            });
            
            return keptDownloads;
        });
    }, []);

    const getStorageInfo = useCallback(() => {
        const completedDownloads = downloads.filter(d => d.status === 'completed' || d.status === 'partial');
        const processingDownloads = downloads.filter(d => d.status === 'processing');
        const totalSize = completedDownloads.reduce((total, download) => {
            return total + (download.fileBlob ? download.fileBlob.size : 0);
        }, 0);
        
        return {
            completed: completedDownloads.length,
            processing: processingDownloads.length,
            totalSize: totalSize,
            maxCompleted: 5,
            maxAge: 'Auto-cleanup after 5 files'
        };
    }, [downloads]);

    const value = {
        downloads,
        isOpen,
        setIsOpen,
        addDownload,
        updateDownload,
        removeDownload,
        retryDownload,
        downloadFile,
        cleanupOldDownloads,
        getStorageInfo
    };

    return (
        <GlobalDownloadContext.Provider value={value}>
            {children}
        </GlobalDownloadContext.Provider>
    );
};
