export interface PageOptions {
	viewportWidth: number;
	viewportHeight: number;
	userAgent?: string;
	timeout: number;
}

export interface BrowserlessSession {
	browserId: string;
	browserWSEndpoint: string;
	[key: string]: unknown;
}