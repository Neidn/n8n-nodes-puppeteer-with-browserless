import type { PuppeteerLifeCycleEvent } from 'puppeteer-core';

export type WaitUntil = PuppeteerLifeCycleEvent;

export interface PageOptions {
	viewportWidth: number;
	viewportHeight: number;
	userAgent?: string;
	timeout: number;
	waitUntil: WaitUntil;
}