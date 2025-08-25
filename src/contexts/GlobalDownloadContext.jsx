import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { retryAsync } from '../utils/utils.js';
import { searchPubmed } from '../api/pubmedApi.js';
import { searchElsevier } from '../api/elsevierApi.js';
import { searchCore } from '../api/coreApi.js';
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
            
            updateDownload(download.id, { 
                totalRecords: cappedTotalRecords, 
                originalTotalRecords: totalRecords,
                progress: 10 
            });

            const allArticles = await fetchAllArticles(download, totalRecords);
            
            const fileBlob = await generateExportFile(format, allArticles, options);
            
            const expectedTotal = download.totalRecords || totalRecords;
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
        const { queries, searchTotals, options } = download;
        const allArticles = [];

        // Per-database batch sizes (optimized for each API's rate limits)
        const getBatchSize = (dbKey) => {
            switch (dbKey) {
                case 'scopus':
                case 'embase':
                    return 25; // Scopus has very strict rate limits
                case 'pubmed':
                    return 50; 
                case 'core':
                default:
                    return 500; // Default batch size
            }
        };
        
        const databasesToExport = options.selectedDBs && options.selectedDBs.length > 0 
            ? options.selectedDBs 
            : Object.keys(queries).filter(dbKey => queries[dbKey]);
        
        // Create all database tasks upfront
        const databaseTasks = databasesToExport.map(async (dbKey) => {
            const query = queries[dbKey];
            if (!query) return [];
            
            const totalCount = searchTotals?.[dbKey] || 0;
            if (totalCount === 0) return [];
            
            const exportCap = EXPORT_CAPS[dbKey] || totalCount;
            const cappedCount = Math.min(totalCount, exportCap);
            const batchSize = getBatchSize(dbKey);
            
            console.log(`Starting parallel fetch for ${dbKey}: ${cappedCount} records in batches of ${batchSize}`);
            
            const dbArticles = [];
            let dbProcessedRecords = 0;
            
            // Process batches for this database
            for (let offset = 0; offset < cappedCount; offset += batchSize) {
                const currentBatchSize = Math.min(batchSize, cappedCount - offset);
                
                try {
                    const response = await retryAsync(async () => {
                        console.log(`Fetching ${dbKey} batch: offset ${offset}, size ${currentBatchSize}`);
                        
                        if (dbKey === 'pubmed') {
                            return await searchPubmed(query, currentBatchSize, offset);
                        } else if (dbKey === 'scopus' || dbKey === 'embase') {
                            return await searchElsevier(dbKey, query, currentBatchSize, offset);
                        } else if (dbKey === 'core') {
                            return await searchCore(query, currentBatchSize, offset);
                        }
                        throw new Error(`Unsupported database: ${dbKey}`);
                    }, { 
                        tries: 3, 
                        baseDelayMs: 1000, 
                        factor: 3
                    });
                    
                    const articles = response.data || response;
                    if (articles && articles.length > 0) {
                        const processedArticles = articles.map(article => ({
                            ...article,
                            sourceDB: dbKey,
                            uniqueId: `${dbKey}_${article.uid || article.id || Math.random().toString(36).substr(2, 9)}`
                        }));
                        
                        dbArticles.push(...processedArticles);
                        dbProcessedRecords += articles.length;
                        
                        
                        console.log(`✅ ${dbKey}: ${articles.length} articles (${dbProcessedRecords}/${cappedCount})`);
                    }
                    
                    // Rate limiting delay per database
                    await new Promise(resolve => setTimeout(resolve, 2500));
                    
                } catch (error) {
                    console.error(`❌ ${dbKey} failed at offset ${offset}:`, error.message);
                    break;
                }
            }
            
            console.log(`🏁 ${dbKey} completed: ${dbArticles.length} articles`);
            return dbArticles;
        });
        
        updateDownload(download.id, { progress: 20 }); // Show we're starting
        
        const results = await Promise.allSettled(databaseTasks);
        
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
        
        updateDownload(download.id, { 
            processedRecords: totalProcessed, 
            progress: 90 
        });
        
        if (failedDatabases.length > 0) {
            console.log(`⚠️ Some databases failed: ${failedDatabases.join(', ')}. Continuing with ${allArticles.length} articles.`);
        }
        
        return allArticles;
    };

    const generateExportFile = async (format, articles, options) => {
        if (format === 'csv') {
            return generateCsvFile(articles, options);
        } else if (format === 'ris') {
            return generateRisFile(articles, options);
        } else if (format === 'printable') {
            return generatePrintableFile(articles, options);
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
            ris += `ER  - \n`;
            return ris;
        }).join('');
        
        return new Blob([risContent], { type: 'application/x-research-info-systems' });
    };

    const generatePrintableFile = (articles, options) => {
        const htmlContent = `<html><head><title>Printable Report</title><style>body{font-family:sans-serif;line-height:1.5;padding:20px}article{border-bottom:1px solid #eee;padding-bottom:1rem;margin-bottom:1rem}h3{font-size:1.2rem;margin-bottom:0.5rem}p{margin:0.25rem 0}.meta{font-size:0.9rem;color:#555}</style></head><body><h1>Export Results</h1>${articles.map((item, index) => `<article><h3>${index + 1}. ${item.title || 'No Title'}</h3><p class="meta"><strong>Authors:</strong> ${item.authors?.map(a => a.name).join(', ')}</p><p class="meta"><strong>Journal/Venue:</strong> ${item.venue || item.source || 'N/A'} (${item.year || item.pubdate || 'N/A'})</p><p class="meta"><strong>DOI:</strong> ${item.doi || item.externalIds?.DOI || 'N/A'}</p><p><strong>Abstract:</strong> ${item.abstract || 'No abstract available.'}</p></article>`).join('')}</body></html>`;
        
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
