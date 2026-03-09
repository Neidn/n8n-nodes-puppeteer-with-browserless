import puppeteer from 'puppeteer-core';
import type { Browser, Page } from 'puppeteer-core';
import type { BrowserlessSession, PageOptions } from './types';

/**
 * Returns true if the credential URL is secure (wss:// or https://).
 */
function isSecureUrl(url: string): boolean {
	return /^wss:\/\/|^https:\/\//.test(url);
}

/**
 * Normalizes any Browserless credential URL (http/https/ws/wss) to a proper
 * WebSocket URL with an explicit port.
 *   https://host       → wss://host:443
 *   http://host:3000   → ws://host:3000
 *   wss://host         → wss://host:443
 *   ws://host:3000     → ws://host:3000
 */
function toWsUrl(browserlessUrl: string): string {
	const clean = browserlessUrl.replace(/\/+$/, '');
	const secure = isSecureUrl(clean);
	const httpUrl = clean
		.replace(/^wss:\/\//, 'https://')
		.replace(/^ws:\/\//, 'http://');
	const parsed = new URL(httpUrl);
	const port = parsed.port || (secure ? '443' : '80');
	const protocol = secure ? 'wss:' : 'ws:';
	return `${protocol}//${parsed.hostname}:${port}`;
}

/**
 * Converts a Browserless URL (ws/wss/http/https) to its HTTP equivalent for REST calls.
 */
function toHttpUrl(browserlessUrl: string): string {
	return browserlessUrl
		.replace(/^wss:\/\//, 'https://')
		.replace(/^ws:\/\//, 'http://')
		.replace(/\/+$/, '');
}

/**
 * Builds the Browserless WebSocket endpoint URL.
 * Accepts http/https/ws/wss — always produces a wss:// or ws:// URL.
 * Appends the API token as a query parameter when provided.
 */
export function buildWsEndpoint(browserlessUrl: string, apiToken: string): string {
	const base = toWsUrl(browserlessUrl);
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
 * Fetches the list of active Browserless sessions via the /sessions HTTP endpoint.
 */
export async function getSessions(browserlessUrl: string, apiToken: string): Promise<BrowserlessSession[]> {
	const base = toHttpUrl(browserlessUrl);
	const url = apiToken ? `${base}/sessions?token=${encodeURIComponent(apiToken)}` : `${base}/sessions`;
	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`GET /sessions returned ${res.status} ${res.statusText}`);
	}
	return res.json() as Promise<BrowserlessSession[]>;
}

/**
 * Fixes the browserWSEndpoint returned by /sessions, which contains 0.0.0.0:3000
 * as the host. Replaces it with the real host and port from the credential URL.
 * Always produces a wss:// or ws:// URL with explicit port and token query param.
 */
export function fixSessionEndpoint(rawEndpoint: string, browserlessUrl: string, apiToken: string): string {
	const normalized = toWsUrl(browserlessUrl);
	const target = new URL(normalized.replace(/^wss?:\/\//, 'http://'));
	// Parse raw endpoint (ws/wss → http for URL parsing)
	const raw = new URL(rawEndpoint.replace(/^wss?:\/\//, 'http://'));
	raw.hostname = target.hostname;
	raw.port = target.port;
	raw.protocol = isSecureUrl(browserlessUrl) ? 'wss:' : 'ws:';
	if (apiToken) {
		raw.searchParams.set('token', apiToken);
	}
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