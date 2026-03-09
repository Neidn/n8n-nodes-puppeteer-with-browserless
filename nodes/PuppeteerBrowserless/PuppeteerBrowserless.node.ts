import type {
	ICredentialTestFunctions,
	ICredentialsDecrypted,
	IDataObject,
	IExecuteFunctions,
	INodeCredentialTestResult,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import {
	buildWsEndpoint,
	connectBrowser,
	fixSessionEndpoint,
	getSessions,
	newConfiguredPage,
} from './shared/connect';
import type { PageOptions } from './shared/types';
import { evaluate } from './operations/evaluate';
import { createSession } from './operations/createSession';

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
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Run Script',
						value: 'runScript',
						description: 'Connect to Browserless and run a Puppeteer script',
					},
					{
						name: 'Create Session',
						value: 'createSession',
						description:
							'Create a persistent Browserless session and return its WebSocket endpoint for reuse',
					},
				],
				default: 'runScript',
			},
			// ── Run Script ──────────────────────────────────────────────────────────
			{
				displayName: 'Session WebSocket Endpoint',
				name: 'sessionWsEndpoint',
				type: 'string',
				default: '',
				placeholder: 'wss://your-browserless-host/devtools/browser/...',
				description:
					'Optional. Connect to an existing Browserless session instead of opening a new one. Use the browserWSEndpoint output from a Create Session node.',
				displayOptions: { show: { operation: ['runScript'] } },
			},
			{
				displayName: 'Script',
				name: 'jsCode',
				type: 'string',
				typeOptions: { editor: 'jsEditor', rows: 10 },
				default: `// page and browser are pre-injected — no imports needed.\n// Write async logic and use return to pass data to the next node.\nconst title = await page.title();\nreturn { title };`,
				noDataExpression: true,
				description:
					'JavaScript to execute. <code>page</code> (Puppeteer Page) and <code>browser</code> (Puppeteer Browser) are available.',
				displayOptions: { show: { operation: ['runScript'] } },
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: { show: { operation: ['runScript'] } },
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

	methods = {
		credentialTest: {
			async browserlessApiTest(
				this: ICredentialTestFunctions,
				credential: ICredentialsDecrypted,
			): Promise<INodeCredentialTestResult> {
				const { browserlessUrl, apiToken } = credential.data as {
					browserlessUrl: string;
					apiToken: string;
				};

				const wsEndpoint = buildWsEndpoint(browserlessUrl, apiToken ?? '');

				try {
					const browser = await connectBrowser(wsEndpoint);
					await browser.disconnect();
					return { status: 'OK', message: 'Connected to Browserless successfully' };
				} catch (error) {
					const msg = (error as Error).message ?? String(error);
					return {
						status: 'Error',
						message: `Cannot connect to Browserless (${wsEndpoint}): ${msg}`,
					};
				}
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const credentials = await this.getCredentials('browserlessApi');
		const browserlessUrl = credentials.browserlessUrl as string;
		const apiToken = credentials.apiToken as string;

		for (let i = 0; i < items.length; i++) {
			const operation = this.getNodeParameter('operation', i) as string;

			// ── Create Session ────────────────────────────────────────────────────
			if (operation === 'createSession') {
				try {
					const result = await createSession(browserlessUrl, apiToken);
					returnData.push({ json: result as IDataObject, pairedItem: i });
				} catch (error) {
					const msg = (error as Error).message ?? String(error);
					if (this.continueOnFail()) {
						returnData.push({ json: { error: msg }, pairedItem: i });
					} else {
						throw new NodeOperationError(this.getNode(), `Create session failed: ${msg}`, {
							itemIndex: i,
						});
					}
				}
				continue;
			}

			// ── Run Script ────────────────────────────────────────────────────────
			const jsCode = this.getNodeParameter('jsCode', i) as string;
			const sessionWsEndpoint = this.getNodeParameter('sessionWsEndpoint', i, '') as string;
			const options = this.getNodeParameter('options', i, {}) as {
				timeout?: number;
				viewportWidth?: number;
				viewportHeight?: number;
				userAgent?: string;
			};

			const pageOptions: PageOptions = {
				timeout: options.timeout ?? 30000,
				viewportWidth: options.viewportWidth ?? 1280,
				viewportHeight: options.viewportHeight ?? 720,
				userAgent: options.userAgent,
			};

			const existingEndpoint = sessionWsEndpoint.trim();
			const wsEndpoint = existingEndpoint || buildWsEndpoint(browserlessUrl, apiToken);

			// Snapshot sessions before connecting (only for fresh connections)
			let beforeIds: Set<string> | null = null;
			if (!existingEndpoint) {
				try {
					const before = await getSessions(browserlessUrl, apiToken);
					beforeIds = new Set(before.map((s) => s.browserId));
				} catch {
					// Non-fatal — session info will be omitted from output if this fails
				}
			}

			let browser;
			try {
				browser = await connectBrowser(wsEndpoint);
			} catch (error) {
				const msg = (error as Error).message ?? String(error);
				throw new NodeOperationError(
					this.getNode(),
					`Failed to connect to Browserless at ${wsEndpoint}: ${msg}`,
					{ description: 'Check your Browserless URL and API token in the credential settings.' },
				);
			}

			// Resolve session info to include in output
			let sessionInfo: { browserWSEndpoint: string; browserId?: string } | null = null;
			if (existingEndpoint) {
				sessionInfo = { browserWSEndpoint: existingEndpoint };
			} else if (beforeIds !== null) {
				try {
					const after = await getSessions(browserlessUrl, apiToken);
					const newSession = after.filter((s) => !beforeIds!.has(s.browserId)).pop();
					if (newSession) {
						sessionInfo = {
							browserWSEndpoint: fixSessionEndpoint(newSession.browserWSEndpoint, browserlessUrl, apiToken),
							browserId: newSession.browserId,
						};
					}
				} catch {
					// Non-fatal
				}
			}

			try {
				// When reusing an existing session, reuse the existing open page so that
				// navigation, cookies and DOM state are preserved across nodes.
				// When opening a fresh connection, create a new page and close it after.
				let page;
				let ownPage: boolean;
				try {
					if (existingEndpoint) {
						const pages = await browser.pages();
						page = pages[pages.length - 1] ?? (await browser.newPage());
						await page.setViewport({ width: pageOptions.viewportWidth, height: pageOptions.viewportHeight });
						page.setDefaultNavigationTimeout(pageOptions.timeout);
						page.setDefaultTimeout(pageOptions.timeout);
						if (pageOptions.userAgent) await page.setUserAgent(pageOptions.userAgent);
						ownPage = false; // leave page open — session is managed externally
					} else {
						page = await newConfiguredPage(browser, pageOptions);
						ownPage = true;
					}
				} catch (error) {
					const msg = (error as Error).message ?? String(error);
					throw new NodeOperationError(this.getNode(), `Failed to get page: ${msg}`, {
						itemIndex: i,
					});
				}

				try {
					const result = await evaluate(page, browser, jsCode);
					returnData.push({
						json: { ...(result ?? {}), ...sessionInfo } as IDataObject,
						pairedItem: i,
					});
				} catch (error) {
					const msg = (error as Error).message ?? String(error);
					if (this.continueOnFail()) {
						returnData.push({ json: { error: msg, ...sessionInfo }, pairedItem: i });
					} else {
						throw new NodeOperationError(this.getNode(), `Script error: ${msg}`, { itemIndex: i });
					}
				} finally {
					if (ownPage) await page.close();
				}
			} finally {
				await browser.disconnect();
			}
		}

		return [returnData];
	}
}