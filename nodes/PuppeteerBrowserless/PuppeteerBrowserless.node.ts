import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';

import { buildWsEndpoint, connectBrowser, newConfiguredPage } from './shared/connect';
import type { PageOptions } from './shared/types';
import { evaluate } from './operations/evaluate';

export class PuppeteerBrowserless implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Puppeteer (Browserless)',
		name: 'puppeteerBrowserless',
		icon: 'fa:spider',
		group: ['transform'],
		version: 1,
		description: 'Run Puppeteer scripts on a self-hosted Browserless instance',
		defaults: { name: 'Puppeteer (Browserless)' },
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'browserlessApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Script',
				name: 'jsCode',
				type: 'string',
				typeOptions: { editor: 'jsEditor', rows: 10 },
				default: `// page and browser are pre-injected — no imports needed.
// Write async logic and use return to pass data to the next node.
const title = await page.title();
return { title };`,
				noDataExpression: true,
				description:
					'JavaScript to execute. <code>page</code> (Puppeteer Page) and <code>browser</code> (Puppeteer Browser) are available.',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Timeout (ms)',
						name: 'timeout',
						type: 'number',
						default: 30000,
						description: 'Maximum navigation and selector wait timeout in milliseconds',
					},
					{
						displayName: 'Viewport Width',
						name: 'viewportWidth',
						type: 'number',
						default: 1280,
					},
					{
						displayName: 'Viewport Height',
						name: 'viewportHeight',
						type: 'number',
						default: 720,
					},
					{
						displayName: 'User Agent',
						name: 'userAgent',
						type: 'string',
						default: '',
						placeholder: 'Mozilla/5.0 ...',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const credentials = await this.getCredentials('browserlessApi');
		const wsEndpoint = buildWsEndpoint(
			credentials.browserlessUrl as string,
			credentials.apiToken as string,
		);

		// One browser connection shared across all items in this execution.
		// Each item opens its own page, which is closed after use.
		// browser.disconnect() keeps the Browserless session alive for reuse.
		const browser = await connectBrowser(wsEndpoint);

		try {
			for (let i = 0; i < items.length; i++) {
				const jsCode = this.getNodeParameter('jsCode', i) as string;
				const options = this.getNodeParameter('options', i, {}) as {
					timeout?: number;
					viewportWidth?: number;
					viewportHeight?: number;
					waitUntil?: string;
					userAgent?: string;
				};

				const pageOptions: PageOptions = {
					timeout: options.timeout ?? 30000,
					viewportWidth: options.viewportWidth ?? 1280,
					viewportHeight: options.viewportHeight ?? 720,
					userAgent: options.userAgent,
				};

				const page = await newConfiguredPage(browser, pageOptions);

				try {
					const result = await evaluate(page, browser, jsCode);

					returnData.push({
						json: (result ?? {}) as IDataObject,
						pairedItem: i,
					});
				} catch (error) {
					if (this.continueOnFail()) {
						returnData.push({ json: { error: (error as Error).message }, pairedItem: i });
					} else {
						throw error;
					}
				} finally {
					await page.close();
				}
			}
		} finally {
			// disconnect() keeps the Chromium session alive in Browserless
			// so subsequent workflow runs can reuse the same browser instance
			await browser.disconnect();
		}

		return [returnData];
	}
}