import { command } from '$app/server';
import { db } from '#server/db';
import { images } from '#server/db/schema';
import { s3 } from '#server/s3';
import { eq } from 'drizzle-orm';
import { V_DeleteImage, V_UploadImage } from './validation.js';

export const UPLOAD_IMAGE = command(V_UploadImage, async ({ name, mimeType, data }) => {
	const base64Data = data.includes(';base64,') ? data.split(';base64,')[1] : data;
	const buffer = Buffer.from(base64Data, 'base64');

	let width: number | null = null;
	let height: number | null = null;
	let format: string | null = null;
	let thumbKey: string | null = null;

	// Extract metadata and generate thumbnail using Bun.Image
	try {
		const img = new Bun.Image(buffer);
		const meta = await img.metadata();
		if (meta.width > 0) width = meta.width;
		if (meta.height > 0) height = meta.height;
		if (meta.format) format = meta.format;

		try {
			const thumbImage = await (await img.resize(400, 400)).webp();
			const thumbBuffer = await thumbImage.bytes();
			thumbKey = `thumbnails/${Date.now()}-${crypto.randomUUID()}.webp`;
			await s3.write(thumbKey, thumbBuffer, { type: 'image/webp' });
		} catch (err) {
			console.warn('Failed to generate thumbnail with Bun.Image:', err);
		}
	} catch (err) {
		console.warn('Bun.Image metadata extraction failed:', err);
	}

	const ext = format || name.split('.').pop() || 'png';
	const s3Key = `images/${Date.now()}-${crypto.randomUUID()}.${ext}`;

	// Store original image in S3 using Bun.s3 / S3Client
	await s3.write(s3Key, buffer, { type: mimeType });

	// Store record in Postgres using Drizzle ORM
	const [record] = await db
		.insert(images)
		.values({
			name,
			s3Key,
			thumbKey,
			contentType: mimeType,
			size: buffer.byteLength,
			width,
			height,
			format
		})
		.returning();

	return {
		success: true,
		image: {
			...record,
			createdAt: record.createdAt.toISOString(),
			url: s3.presign(record.s3Key, { expiresIn: 3600 }),
			thumbUrl: record.thumbKey ? s3.presign(record.thumbKey, { expiresIn: 3600 }) : undefined,
			downloadUrl: `/api/images/${record.id}/download`,
			rawUrl: `/api/images/${record.id}`
		}
	};
});

export const DELETE_IMAGE = command(V_DeleteImage, async ({ id }) => {
	const [existing] = await db.select().from(images).where(eq(images.id, id));
	if (!existing) {
		throw new Error('Image not found');
	}

	// Delete from S3 using Bun.s3
	try {
		await s3.delete(existing.s3Key);
		if (existing.thumbKey) {
			await s3.delete(existing.thumbKey);
		}
	} catch (err) {
		console.warn('Error deleting S3 files:', err);
	}

	// Delete from PostgreSQL using Drizzle ORM
	await db.delete(images).where(eq(images.id, id));

	return { success: true, id };
});
