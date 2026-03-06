import puppeteer from 'puppeteer-core';
import type { Browser, Page } from 'puppeteer-core';
import type { PageOptions } from './types';

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