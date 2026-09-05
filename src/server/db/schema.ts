import { pgTable, serial, integer, text, timestamp } from 'drizzle-orm/pg-core';

export const task = pgTable('task', {
	id: serial('id').primaryKey(),
	title: text('title').notNull(),
	priority: integer('priority').notNull().default(1)
});

export const images = pgTable('images', {
	id: serial('id').primaryKey(),
	name: text('name').notNull(),
	s3Key: text('s3_key').notNull(),
	thumbKey: text('thumb_key'),
	contentType: text('content_type').notNull(),
	size: integer('size').notNull(),
	width: integer('width'),
	height: integer('height'),
	format: text('format'),
	createdAt: timestamp('created_at').defaultNow().notNull()
});

export type ImageItem = typeof images.$inferSelect;
export type NewImageItem = typeof images.$inferInsert;
