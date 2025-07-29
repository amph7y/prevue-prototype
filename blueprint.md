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
To create more comprehensive and effective PubMed search queries by combining both controlled vocabulary (MeSH terms) and keywords, instead of prioritizing one over the other.

### Steps
1.  **Analyze `ProjectEditor.jsx`:** The component responsible for generating search queries is located at `src/components/editor/ProjectEditor.jsx`.
2.  **Identify the Issue:** The `buildDbQuery` function within this component currently has a flawed logic. It checks for active MeSH terms and, if any are present, it exclusively uses them. Keywords are only used as a fallback if no MeSH terms are active for a given PICO category.
3.  **Modify Query Generation Logic:**
    *   Update the `buildDbQuery` function to ensure that for each PICO category, it combines both the active MeSH terms (from `controlled_vocabulary`) and the active keywords.
    *   The MeSH terms and keywords for a single category should be joined with an `OR` operator to broaden the search.
    *   The different PICO category groups will continue to be joined by an `AND` operator to ensure all concepts are present in the search results.
4.  **Verify the Change:** After applying the fix, manually inspect the generated query to confirm it correctly includes both types of terms, resulting in a more robust and comprehensive search string.
