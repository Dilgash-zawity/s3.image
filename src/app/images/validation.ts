import * as v from "valibot";

export const V_UploadImage = v.object({
    name: v.pipe(
        v.string(),
        v.minLength(1, "Image name is required"),
        v.maxLength(255, "Image name is too long"),
    ),

    mimeType: v.pipe(
        v.string(),
        v.regex(
            /^image\/(jpeg|png|webp|gif|avif)$/i,
            "Unsupported image format",
        ),
    ),

    data: v.pipe(v.string(), v.minLength(1, "Image data is required")),
});

export const V_DeleteImage = v.object({
    id: v.pipe(
        v.number(),
        v.integer("ID must be an integer"),
        v.minValue(1, "Invalid image ID"),
    ),
});
