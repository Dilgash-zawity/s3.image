import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	DATABASE_URL: { description: 'The database connection string.' },
	S3_ACCESS_KEY_ID: { description: 'S3 access key id.' },
	S3_SECRET_ACCESS_KEY: { description: 'S3 secret access key.' },
	S3_BUCKET: { description: 'S3 bucket name.' },
	S3_ENDPOINT: { description: 'S3 endpoint.' },
	S3_REGION: { description: 'S3 region.' }
});
