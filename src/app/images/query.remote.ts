import { query } from '$app/server';
import { db } from '#server/db';
import { images } from '#server/db/schema';
import { s3 } from '#server/s3';
import { desc } from 'drizzle-orm';

export const GET_IMAGES = query(async () => {
	const allImages = await db.select().from(images).orderBy(desc(images.createdAt));

	return allImages.map((img) => {
		const viewUrl = s3.presign(img.s3Key, { expiresIn: 3600 });
		const thumbUrl = img.thumbKey ? s3.presign(img.thumbKey, { expiresIn: 3600 }) : viewUrl;

		return {
			...img,
			createdAt: img.createdAt.toISOString(),
			url: viewUrl,
			thumbUrl,
			downloadUrl: `/api/images/${img.id}/download`,
			rawUrl: `/api/images/${img.id}`
		};
	});
});
