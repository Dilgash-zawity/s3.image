import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '#lib/server/db';
import { images } from '#lib/server/db/schema';
import { s3 } from '#lib/server/s3';
import { eq } from 'drizzle-orm';

export const GET: RequestHandler = async ({ params }) => {
	const id = Number(params.id);
	if (isNaN(id)) {
		error(400, 'Invalid image ID');
	}

	const [record] = await db.select().from(images).where(eq(images.id, id));
	if (!record) {
		error(404, 'Image not found');
	}

	const s3File = s3.file(record.s3Key);
	const exists = await s3File.exists();
	if (!exists) {
		error(404, 'File not found in storage');
	}

	return new Response(s3File.stream(), {
		headers: {
			'Content-Type': record.contentType,
			'Cache-Control': 'public, max-age=86400',
			'Content-Length': String(record.size)
		}
	});
};
