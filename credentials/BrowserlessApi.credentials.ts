import type { ICredentialType, INodeProperties } from 'n8n-workflow';

export class BrowserlessApi implements ICredentialType {
	name = 'browserlessApi';

	displayName = 'Browserless API';

	documentationUrl = 'https://docs.browserless.io/';

	testedBy = 'browserlessApiTest';

	properties: INodeProperties[] = [
		{
			displayName: 'Browserless URL',
			name: 'browserlessUrl',
			type: 'string',
			default: 'ws://localhost:3000',
			placeholder: 'ws://your-browserless-host:3000',
			description:
				'WebSocket URL of your self-hosted Browserless instance (e.g. ws://localhost:3000 or wss://browserless.example.com)',
			required: true,
		},
		{
			displayName: 'API Token',
			name: 'apiToken',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			description:
				'Browserless API token. Leave empty if your instance does not require authentication.',
		},
	];
}
