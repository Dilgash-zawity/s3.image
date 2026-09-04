import {
	S3_ACCESS_KEY_ID,
	S3_SECRET_ACCESS_KEY,
	S3_BUCKET,
	S3_ENDPOINT,
	S3_REGION
} from '$app/env/private';

type S3ClientInstance = InstanceType<typeof Bun.S3Client>;

// When running in Bun runtime, instantiate the native S3Client directly.
// In Node.js (e.g. during SvelteKit build analysis), use a noop fallback.
export const s3: S3ClientInstance =
	typeof Bun !== 'undefined'
		? new Bun.S3Client({
				accessKeyId: S3_ACCESS_KEY_ID,
				secretAccessKey: S3_SECRET_ACCESS_KEY,
				bucket: S3_BUCKET,
				endpoint: S3_ENDPOINT,
				region: S3_REGION
			})
		: (new Proxy({} as S3ClientInstance, {
				get() {
					return () => {};
				}
			}));
