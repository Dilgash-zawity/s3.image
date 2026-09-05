import * as v from 'valibot';

export const V_UploadImage = v.object({
	name: v.pipe(v.string(), v.minLength(1, 'Image name is required')),
	mimeType: v.pipe(v.string(), v.regex(/^image\//, 'Must be an image file')),
	data: v.pipe(v.string(), v.minLength(1, 'Image data is required'))
});

export const V_DeleteImage = v.object({
	id: v.pipe(v.number(), v.integer('ID must be an integer'))
});
