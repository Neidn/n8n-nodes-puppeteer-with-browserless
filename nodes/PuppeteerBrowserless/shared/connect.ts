import puppeteer from 'puppeteer-core';
import type { Browser, Page } from 'puppeteer-core';
import type { BrowserlessSession, PageOptions } from './types';

/**
 * Builds the Browserless WebSocket endpoint URL.
 * Appends the API token as a query parameter when provided.
 * The returned URL is used for session reuse: all items in a single
 * execute() call share one browser connection via this endpoint.
 */
export function buildWsEndpoint(browserlessUrl: string, apiToken: string): string {
	const base = browserlessUrl.replace(/\/+$/, '');
	return apiToken ? `${base}?token=${encodeURIComponent(apiToken)}` : base;
}

/**
 * Connects to a Browserless instance using the given WebSocket endpoint.
 * Uses puppeteer.connect() so no local Chromium is needed.
 * The returned Browser instance is shared across all items in one execution.
 */
export async function connectBrowser(wsEndpoint: string): Promise<Browser> {
	return puppeteer.connect({ browserWSEndpoint: wsEndpoint });
}

/**
 * Converts a WebSocket Browserless URL to its HTTP equivalent for REST calls.
 * e.g. wss://host:443 → https://host:443, ws://host:3000 → http://host:3000
 */
function wsUrlToHttp(browserlessUrl: string): string {
	return browserlessUrl
		.replace(/^wss:\/\//, 'https://')
		.replace(/^ws:\/\//, 'http://')
		.replace(/\/+$/, '');
}

/**
 * Fetches the list of active Browserless sessions via the /sessions HTTP endpoint.
 */
export async function getSessions(browserlessUrl: string, apiToken: string): Promise<BrowserlessSession[]> {
	const base = wsUrlToHttp(browserlessUrl);
	const url = apiToken ? `${base}/sessions?token=${encodeURIComponent(apiToken)}` : `${base}/sessions`;
	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`GET /sessions returned ${res.status} ${res.statusText}`);
	}
	return res.json() as Promise<BrowserlessSession[]>;
}

/**
 * Fixes the browserWSEndpoint returned by /sessions, which contains 0.0.0.0:3000
 * as the host. Replaces it with the real host (and port) from the credential URL.
 */
export function fixSessionEndpoint(rawEndpoint: string, browserlessUrl: string): string {
	const cleanBrowserless = browserlessUrl.replace(/\/+$/, '');
	// Parse the target host from the credential URL (ws/wss → http/https for URL parsing)
	const targetUrl = new URL(wsUrlToHttp(cleanBrowserless));
	// Parse the raw endpoint (ws/wss → http/https for URL parsing)
	const raw = new URL(rawEndpoint.replace(/^wss?:\/\//, 'http://'));
	raw.host = targetUrl.host;
	raw.protocol = cleanBrowserless.startsWith('wss://') ? 'wss:' : 'ws:';
	return raw.toString();
}

/**
 * Opens a new page in the shared browser and applies per-item options
 * (viewport, timeout, user agent). The caller is responsible for
 * closing this page after the operation completes.
 */
export async function newConfiguredPage(browser: Browser, options: PageOptions): Promise<Page> {
	const page = await browser.newPage();

	await page.setViewport({ width: options.viewportWidth, height: options.viewportHeight });
	page.setDefaultNavigationTimeout(options.timeout);
	page.setDefaultTimeout(options.timeout);

	if (options.userAgent) {
		await page.setUserAgent(options.userAgent);
	}

	return page;
}