import { command } from "$app/server";
import { db } from "#server/db";
import { images } from "#server/db/schema";
import { s3 } from "#server/s3";
import { eq } from "drizzle-orm";
import { V_DeleteImage, V_UploadImage } from "./validation.js";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB

export const UPLOAD_IMAGE = command(
    V_UploadImage,
    async ({ name, mimeType, data }) => {
        const base64Data = data.includes(";base64,")
            ? data.split(";base64,")[1]
            : data;

        const buffer = Buffer.from(base64Data, "base64");

        // Protect against images larger than 10 MB
        if (buffer.byteLength > MAX_IMAGE_SIZE) {
            throw new Error("Image must be smaller than 10 MB");
        }

        let width: number | null = null;
        let height: number | null = null;
        let format: string | null = null;
        let thumbKey: string | null = null;

        // Extract metadata and generate thumbnail using Bun.Image
        try {
            const img = new Bun.Image(buffer);

            const meta = await img.metadata();

            if (meta.width > 0) {
                width = meta.width;
            }

            if (meta.height > 0) {
                height = meta.height;
            }

            if (meta.format) {
                format = meta.format;
            }

            // Generate thumbnail
            try {
                const resized = await img.resize(400, 400, {
                    fit: "inside",
                });

                const thumbImage = await resized.webp();

                const thumbBuffer = await thumbImage.bytes();

                thumbKey = `thumbnails/${Date.now()}-${crypto.randomUUID()}.webp`;

                await s3.write(thumbKey, thumbBuffer, {
                    type: "image/webp",
                });
            } catch (err) {
                console.warn(
                    "Failed to generate thumbnail with Bun.Image:",
                    err,
                );
            }
        } catch (err) {
            console.warn(
                "Bun.Image metadata extraction failed:",
                err,
            );
        }

        const ext =
            format ||
            name.split(".").pop()?.toLowerCase() ||
            "png";

        const s3Key =
            `images/${Date.now()}-${crypto.randomUUID()}.${ext}`;

        // Upload original image
        try {
            await s3.write(s3Key, buffer, {
                type: mimeType,
            });
        } catch (err) {
            // Clean up thumbnail if original upload fails
            if (thumbKey) {
                try {
                    await s3.delete(thumbKey);
                } catch {
                    // Ignore cleanup failure
                }
            }

            throw err;
        }

        // Store database record
        try {
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
                    format,
                })
                .returning();

            if (!record) {
                throw new Error(
                    "Failed to create image database record",
                );
            }

            return {
                success: true,
                image: {
                    ...record,

                    createdAt: record.createdAt.toISOString(),

                    url: s3.presign(record.s3Key, {
                        expiresIn: 3600,
                    }),

                    thumbUrl: record.thumbKey
                        ? s3.presign(record.thumbKey, {
                              expiresIn: 3600,
                          })
                        : undefined,

                    downloadUrl: `/api/images/${record.id}/download`,

                    rawUrl: `/api/images/${record.id}`,
                },
            };
        } catch (err) {
            // Database failed, remove uploaded files
            try {
                await s3.delete(s3Key);

                if (thumbKey) {
                    await s3.delete(thumbKey);
                }
            } catch (cleanupError) {
                console.warn(
                    "Failed to clean up S3 files:",
                    cleanupError,
                );
            }

            throw err;
        }
    },
);

export const DELETE_IMAGE = command(
    V_DeleteImage,
    async ({ id }) => {
        const [existing] = await db
            .select()
            .from(images)
            .where(eq(images.id, id));

        if (!existing) {
            throw new Error("Image not found");
        }

        // Delete files from S3
        try {
            await s3.delete(existing.s3Key);

            if (existing.thumbKey) {
                await s3.delete(existing.thumbKey);
            }
        } catch (err) {
            console.warn(
                "Error deleting S3 files:",
                err,
            );
        }

        // Delete database record
        await db
            .delete(images)
            .where(eq(images.id, id));

        return {
            success: true,
            id,
        };
    },
);