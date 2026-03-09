import { connectBrowser, fixSessionEndpoint, getSessions } from '../shared/connect';

/**
 * Creates a new Browserless session by:
 * 1. Snapshotting existing sessions via GET /sessions
 * 2. Connecting a new browser (which registers a new session in Browserless)
 * 3. Fetching sessions again and diffing to isolate the new one
 * 4. Fixing the raw browserWSEndpoint (0.0.0.0:3000 → real host)
 * 5. Disconnecting without closing so the session stays alive for reconnection
 *
 * Returns the corrected browserWSEndpoint and browserId for use in subsequent nodes.
 */
export async function createSession(
	browserlessUrl: string,
	apiToken: string,
): Promise<{ browserWSEndpoint: string; browserId: string }> {
	const wsEndpoint = browserlessUrl.replace(/\/+$/, '');
	const fullWsEndpoint = apiToken ? `${wsEndpoint}?token=${encodeURIComponent(apiToken)}` : wsEndpoint;

	const beforeSessions = await getSessions(browserlessUrl, apiToken);
	const beforeIds = new Set(beforeSessions.map((s) => s.browserId));

	const browser = await connectBrowser(fullWsEndpoint);

	const afterSessions = await getSessions(browserlessUrl, apiToken);
	const newSessions = afterSessions.filter((s) => !beforeIds.has(s.browserId));

	if (newSessions.length === 0) {
		await browser.disconnect();
		throw new Error('Could not identify the new Browserless session after connecting. No new sessions found in /sessions.');
	}

	const mySession = newSessions[newSessions.length - 1];
	const browserWSEndpoint = fixSessionEndpoint(mySession.browserWSEndpoint, browserlessUrl);

	// Disconnect without closing — keeps the Chromium session alive in Browserless
	await browser.disconnect();

	return { browserWSEndpoint, browserId: mySession.browserId };
}