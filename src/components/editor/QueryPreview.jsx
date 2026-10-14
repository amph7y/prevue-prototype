import React from 'react';
import { cn } from '../../utils/cn.js';
import { queryLegend } from '../../utils/queryBuilder.js';

const EXCLUDED_STYLE = 'bg-gray-200 text-gray-700 border-gray-300';

// Which color belongs to which concept. Only concepts that are in the query are listed, in query order.
//   pieces: from buildQuery; nameFor(id) and colorFor(id) give a concept's name and palette colors
export function ConceptLegend({ pieces, nameFor, colorFor, className }) {
    const { conceptIds, hasExcluded } = queryLegend(pieces);
    if (conceptIds.length === 0) return null;
    return (
        <div className={cn('flex flex-wrap items-center gap-2', className)} data-testid="concept-legend">
            <span className="text-xs font-medium text-gray-500">Colors:</span>
            <ul className="flex flex-wrap items-center gap-2">
                {conceptIds.map((id) => {
                    const color = colorFor(id);
                    return (
                        <li
                            key={id}
                            className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium', color.chip)}
                            data-concept-id={id}
                        >
                            <span className={cn('h-2 w-2 rounded-full', color.dot)} aria-hidden="true" />
                            {nameFor(id)}
                        </li>
                    );
                })}
                {hasExcluded && (
                    <li className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium', EXCLUDED_STYLE)}>
                        Excluded terms
                    </li>
                )}
            </ul>
        </div>
    );
}

// The query with each concept's part in its color. If the pieces don't add up to the query
// (for example a query loaded from Refine history), the query is shown as plain text.
// The text is shown as text only, never as HTML.
export function ColoredQuery({ query, pieces, colorFor, placeholder, className }) {
    const text = typeof query === 'string' ? query : '';
    const colored = Array.isArray(pieces) && pieces.length > 0 && pieces.map((p) => p.text).join('') === text;
    return (
        <div
            className={cn('whitespace-pre-wrap break-words font-mono text-sm leading-7 text-gray-800', className)}
            data-testid="query-preview"
            data-colored={colored ? 'true' : 'false'}
            tabIndex={0}
            aria-label="Query"
        >
            {!text && <span className="text-gray-400">{placeholder}</span>}
            {text && !colored && text}
            {text && colored && pieces.map((p, i) => {
                if (p.kind === 'concept') {
                    return (
                        <span key={i} className={cn('box-decoration-clone rounded px-0.5 py-0.5', colorFor(p.conceptId).chip)} data-concept-id={p.conceptId}>
                            {p.text}
                        </span>
                    );
                }
                if (p.kind === 'exclude') {
                    return <span key={i} className={cn('box-decoration-clone rounded px-0.5 py-0.5', EXCLUDED_STYLE)}>{p.text}</span>;
                }
                return <span key={i} className="font-semibold text-gray-500">{p.text}</span>;
            })}
        </div>
    );
}
