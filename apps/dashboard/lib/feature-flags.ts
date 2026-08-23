/**
 * Features that are built but not being offered yet.
 *
 * A flag here is the only switch: the tab, the landing page's pitch for it and
 * the route behind it all read the same constant, so a feature is never half
 * on — advertised on the home page but missing from the sidebar, or hidden in
 * the UI while its endpoint still answers a direct POST.
 */

/**
 * AI Analysis — the sidebar tab, the landing page sections that sell it, and
 * `POST /api/analyze`. Off while the feature is held back; flip to `true` to
 * bring all three back at once.
 */
export const AI_ANALYSIS_ENABLED: boolean = false;
