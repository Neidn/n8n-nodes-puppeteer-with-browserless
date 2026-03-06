import type { Browser, Page } from 'puppeteer-core';

type AsyncFn = (...args: unknown[]) => Promise<unknown>;
type AsyncFnConstructor = new (...argNames: string[]) => AsyncFn;

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as AsyncFnConstructor;

/**
 * Runs user-supplied async JavaScript with `page` and `browser` pre-injected.
 * No imports or setup required in the user script. Example:
 *
 *   const title = await page.title();
 *   return { title };
 */
export async function evaluate(
	page: Page,
	browser: Browser,
	jsCode: string,
): Promise<unknown> {
	const fn = new AsyncFunction('page', 'browser', jsCode);
	return fn(page, browser);
}