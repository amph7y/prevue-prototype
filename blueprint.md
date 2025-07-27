# Project Blueprint

## Overview
This project is a React application integrated with Firebase, designed to assist users in research and literature review. It provides functionalities like searching external databases (e.g., PubMed, Elsevier), managing research projects, and potentially AI-driven insights.

## Current Features
*   **PubMed API Integration:** Fetches article counts and summaries from PubMed.
*   **Elsevier API Integration:** (Assumed, based on `elsevierApi.js` existence)
*   **Gemini API Integration:** (Assumed, based on `geminiApi.js` existence)
*   **Component Structure:** Common components for UI elements (modals, spinners, pagination), and dashboard/editor components for core functionalities.
*   **Firebase Configuration:** Set up for Firebase services (assumed for authentication, database, etc.).
*   **Vite Development Server:** Configured for local development.
*   **Tailwind CSS:** Used for styling.

## Plan for PubMed Query Enhancement

### Purpose
To optimize and expand the PubMed API integration in `src/api/pubmedApi.js` for more comprehensive data retrieval and better error handling.

### Steps
1.  **Modify `fetchPubmed`:**
    *   Make the `fetchPubmed` function more flexible to handle different `retmode` values (e.g., `xml` for `efetch`).
    *   Add better error handling, including specific messages for network errors or API-specific issues.
2.  **Add `getPubmedArticleDetails` function:**
    *   Implement a new function `getPubmedArticleDetails` that uses `efetch.fcgi` to retrieve full article details (including abstracts) for a given list of PubMed IDs.
3.  **Enhance `searchPubmed` function:**
    *   Modify `searchPubmed` to optionally fetch full details using the new `getPubmedArticleDetails` function.
    *   Add pagination support (`retstart` parameter).
    *   Parse the XML response from `efetch` if full details are requested.
4.  **Update Error Handling:** Ensure all API calls have robust `try-catch` blocks and informative error messages.
