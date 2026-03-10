import type { ICredentialType, INodeProperties } from 'n8n-workflow';

export class BrowserlessApi implements ICredentialType {
	name = 'browserlessApi';

	displayName = 'Browserless API';

	documentationUrl = 'https://docs.browserless.io/';

	icon = 'file:browserless.svg' as const;

	testedBy = 'browserlessApiTest';

	properties: INodeProperties[] = [
		{
			displayName: 'Browserless URL',
			name: 'browserlessUrl',
			type: 'string',
			default: 'ws://localhost:3000',
			placeholder: 'https://browserless.example.com',
			description:
				'URL of your Browserless instance. Accepts https://, http://, wss://, or ws://. If no port is specified, 443 is used for secure connections and 80 for plain.',
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
