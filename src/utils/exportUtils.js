/**
 * Export utilities for generating files from article data
 * Provides consistent export functionality across the application
 */

/**
 * Escapes a CSV cell value by wrapping in quotes and escaping internal quotes
 * @param {any} cell - The cell value to escape
 * @returns {string} The escaped CSV cell
 */
const escapeCsvCell = (cell) => {
    return `"${String(cell || '').replace(/"/g, '""')}"`;
};

/**
 * Formats an authors array or string into a consistent string format
 * @param {Array|string} authors - The authors data
 * @returns {string} Formatted authors string
 */
const formatAuthors = (authors) => {
    if (!authors) return '';
    
    if (Array.isArray(authors)) {
        return authors.map(author => {
            if (typeof author === 'string') return author;
            if (author && typeof author === 'object' && author.name) return author.name;
            return '';
        }).filter(Boolean).join('; ');
    }
    
    return typeof authors === 'string' ? authors : '';
};

/**
 * Generates a CSV file blob from an array of articles
 * @param {Array} articles - Array of article objects
 * @param {Object} options - Export options (currently unused but available for future extensions)
 * @returns {Blob} CSV file blob
 */
export const generateCsvExport = (articles, options = {}) => {
    const headers = ['Title', 'Authors', 'Year', 'Journal/Venue', 'DOI', 'Abstract', 'Source'];
    
    const rows = articles.map(article => [
        escapeCsvCell(article.title),
        escapeCsvCell(formatAuthors(article.authors)),
        escapeCsvCell(article.year || article.pubdate),
        escapeCsvCell(article.venue || article.journal || article.source),
        escapeCsvCell(article.doi || article.externalIds?.DOI),
        escapeCsvCell(article.abstract),
        escapeCsvCell(article.sourceDB)
    ].join(','));
    
    const csvContent = [headers.join(','), ...rows].join('\n');
    
    // Add BOM for proper UTF-8 encoding in Excel
    return new Blob([`\uFEFF${csvContent}`], { 
        type: 'text/csv;charset=utf-8;' 
    });
};

/**
 * Generates a RIS file blob from an array of articles
 * @param {Array} articles - Array of article objects
 * @param {Object} options - Export options (currently unused but available for future extensions)
 * @returns {Blob} RIS file blob
 */
export const generateRisExport = (articles, options = {}) => {
    const risContent = articles.map(article => {
        let ris = 'TY  - JOUR\n';
        
        if (article.title) {
            ris += `TI  - ${article.title}\n`;
        }
        
        // Handle authors array
        if (article.authors && Array.isArray(article.authors)) {
            article.authors.forEach(author => {
                const authorName = typeof author === 'string' 
                    ? author 
                    : (author && author.name) || '';
                if (authorName) {
                    ris += `AU  - ${authorName}\n`;
                }
            });
        }
        
        if (article.year || article.pubdate) {
            ris += `PY  - ${article.year || article.pubdate}\n`;
        }
        
        if (article.venue || article.journal || article.source) {
            ris += `JO  - ${article.venue || article.journal || article.source}\n`;
        }
        
        const doi = article.doi || article.externalIds?.DOI;
        if (doi) {
            ris += `DO  - ${doi}\n`;
        }
        
        if (article.abstract) {
            ris += `AB  - ${article.abstract}\n`;
        }
        
        ris += 'ER  - \n';
        return ris;
    }).join('');
    
    return new Blob([risContent], { 
        type: 'application/x-research-info-systems' 
    });
};

/**
 * Generates an HTML file blob for printable reports from an array of articles
 * @param {Array} articles - Array of article objects
 * @param {Object} options - Export options
 * @param {string} options.title - Title for the report (optional)
 * @returns {Blob} HTML file blob
 */
export const generatePrintableExport = (articles, options = {}) => {
    const title = options.title || 'Export Results';
    
    const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <title>Printable Report - ${title}</title>
    <style>
        body {
            font-family: sans-serif;
            line-height: 1.5;
            padding: 20px;
            max-width: 800px;
            margin: 0 auto;
        }
        article {
            border-bottom: 1px solid #eee;
            padding-bottom: 1rem;
            margin-bottom: 1rem;
            page-break-inside: avoid;
        }
        h1 {
            color: #333;
            border-bottom: 2px solid #333;
            padding-bottom: 0.5rem;
        }
        h3 {
            font-size: 1.2rem;
            margin-bottom: 0.5rem;
            color: #444;
        }
        p {
            margin: 0.25rem 0;
        }
        .meta {
            font-size: 0.9rem;
            color: #555;
        }
        .abstract {
            margin-top: 0.5rem;
            text-align: justify;
        }
        @media print {
            body { margin: 0; }
            article { page-break-inside: avoid; }
        }
    </style>
</head>
<body>
    <h1>Results for: ${title}</h1>
    <p class="meta">Generated on ${new Date().toLocaleDateString()} • ${articles.length} articles</p>
    ${articles.map((article, index) => `
        <article>
            <h3>${index + 1}. ${article.title || 'No Title'}</h3>
            <p class="meta">
                <strong>Authors:</strong> ${formatAuthors(article.authors) || 'N/A'}
            </p>
            <p class="meta">
                <strong>Journal/Venue:</strong> ${article.venue || article.journal || article.source || 'N/A'} 
                (${article.year || article.pubdate || 'N/A'})
            </p>
            <p class="meta">
                <strong>DOI:</strong> ${article.doi || article.externalIds?.DOI || 'N/A'}
            </p>
            <p class="meta">
                <strong>Source Database:</strong> ${article.sourceDB || 'N/A'}
            </p>
            <div class="abstract">
                <strong>Abstract:</strong> ${article.abstract || 'No abstract available.'}
            </div>
        </article>
    `).join('')}
</body>
</html>`;
    
    return new Blob([htmlContent], { 
        type: 'text/html;charset=utf-8;' 
    });
};

/**
 * Generates an export file based on format type
 * @param {string} format - Export format ('csv', 'ris', 'printable')
 * @param {Array} articles - Array of article objects
 * @param {Object} options - Export options
 * @returns {Blob} Generated file blob
 * @throws {Error} If format is not supported
 */
export const generateExportFile = (format, articles, options = {}) => {
    switch (format.toLowerCase()) {
        case 'csv':
            return generateCsvExport(articles, options);
        case 'ris':
            return generateRisExport(articles, options);
        case 'printable':
            return generatePrintableExport(articles, options);
        default:
            throw new Error(`Unsupported export format: ${format}`);
    }
};

/**
 * Downloads a blob as a file
 * @param {Blob} blob - The file blob to download
 * @param {string} filename - The filename for the download
 */
export const downloadBlob = (blob, filename) => {
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
        // Modern browsers
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    } else {
        // Fallback for older browsers
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
};

/**
 * Gets the appropriate file extension for a given format
 * @param {string} format - Export format
 * @returns {string} File extension
 */
export const getFileExtension = (format) => {
    const extensions = {
        csv: 'csv',
        ris: 'ris',
        printable: 'html'
    };
    return extensions[format.toLowerCase()] || 'txt';
};

/**
 * Generates a filename for export based on project name, format, and timestamp
 * @param {string} projectName - Name of the project
 * @param {string} format - Export format
 * @param {Date} timestamp - Optional timestamp (defaults to now)
 * @returns {string} Generated filename
 */
export const generateExportFilename = (projectName, format, timestamp = new Date()) => {
    const cleanProjectName = projectName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const dateStr = timestamp.toISOString().split('T')[0];
    const extension = getFileExtension(format);
    
    return `${cleanProjectName}_export_${dateStr}.${extension}`;
};
