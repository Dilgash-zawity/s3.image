<script lang="ts">
	// Services
	import { DELETE_IMAGE, GET_IMAGES, UPLOAD_IMAGE } from '#app/images';

	// Script
	type ImageRecord = {
		id: number;
		name: string;
		url: string;
		downloadUrl: string;
		contentType: string;
		size: number;
		width: number | null;
		height: number | null;
		format: string | null;
		createdAt: string;
	};

	const imagesQuery = GET_IMAGES();

	let dragOver = $state(false);
	let selectedFile = $state<File | null>(null);
	let previewDataUrl = $state<string | null>(null);
	let customName = $state('');
	let isUploading = $state(false);
	let deletingId = $state<number | null>(null);
	let errorMessage = $state<string | null>(null);
	let successMessage = $state<string | null>(null);
	let activeModalImage = $state<ImageRecord | null>(null);

	const images = $derived(imagesQuery.current ?? []);
	const isLoading = $derived(imagesQuery.loading && !imagesQuery.current);

	function formatBytes(bytes: number, decimals = 1) {
		if (bytes === 0) return '0 Bytes';

		const k = 1024;
		const dm = decimals < 0 ? 0 : decimals;
		const sizes = ['Bytes', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));

		return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
	}

	function formatDate(dateString: string) {
		try {
			return new Intl.DateTimeFormat(undefined, {
				month: 'short',
				day: 'numeric',
				hour: '2-digit',
				minute: '2-digit'
			}).format(new Date(dateString));
		} catch {
			return dateString;
		}
	}

	function getErrorMessage(error: unknown, fallback: string) {
		return error instanceof Error && error.message ? error.message : fallback;
	}

	function handleFileSelected(file: File) {
		if (!file.type.startsWith('image/')) {
			errorMessage = 'Only image files are allowed';
			return;
		}

		errorMessage = null;
		selectedFile = file;
		customName = file.name;

		const reader = new FileReader();
		reader.onload = () => {
			previewDataUrl = typeof reader.result === 'string' ? reader.result : null;
		};
		reader.readAsDataURL(file);
	}

	function onFileInputChange(event: Event) {
		const target = event.target as HTMLInputElement;
		const [file] = target.files ?? [];

		if (file) handleFileSelected(file);
	}

	function onDrop(event: DragEvent) {
		event.preventDefault();
		dragOver = false;

		const [file] = event.dataTransfer?.files ?? [];
		if (file) handleFileSelected(file);
	}

	function clearSelection() {
		selectedFile = null;
		previewDataUrl = null;
		customName = '';
	}

	async function handleUpload() {
		if (!selectedFile || !previewDataUrl) return;

		isUploading = true;
		errorMessage = null;
		successMessage = null;

		try {
			await UPLOAD_IMAGE({
				name: customName.trim() || selectedFile.name,
				mimeType: selectedFile.type,
				data: previewDataUrl
			}).updates(GET_IMAGES);

			successMessage = `Successfully uploaded "${customName || selectedFile.name}"`;
			clearSelection();
			await imagesQuery.refresh();
		} catch (error: unknown) {
			errorMessage = getErrorMessage(error, 'Upload failed. Please try again.');
		} finally {
			isUploading = false;
		}
	}

	async function handleDelete(id: number, name: string) {
		if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

		deletingId = id;
		errorMessage = null;

		try {
			await DELETE_IMAGE({ id }).updates(GET_IMAGES);
			successMessage = `Deleted "${name}"`;
			if (activeModalImage?.id === id) activeModalImage = null;
			await imagesQuery.refresh();
		} catch (error: unknown) {
			errorMessage = getErrorMessage(error, 'Failed to delete image');
		} finally {
			deletingId = null;
		}
	}

	function openModal(image: ImageRecord) {
		activeModalImage = image;
	}

	function closeModal() {
		activeModalImage = null;
	}

	function onKeyDown(event: KeyboardEvent) {
		if (event.key === 'Escape') closeModal();
	}
</script>

<svelte:window onkeydown={onKeyDown} />

<main class="min-h-screen bg-background text-foreground">
	<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
		<header class="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
			<div class="flex items-center gap-3">
				<div
					class="flex size-11 items-center justify-center rounded-xl border border-border bg-card text-primary"
					aria-hidden="true"
				>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" class="size-6">
						<rect x="3" y="4" width="18" height="16" rx="2" />
						<circle cx="8.5" cy="9" r="1.5" />
						<path d="m21 15-5-5L5 20" />
					</svg>
				</div>
				<div>
					<h1 class="text-xl font-semibold tracking-tight sm:text-2xl">Image Storage Prototype</h1>
					<p class="mt-1 max-w-2xl text-sm text-muted-foreground">
						Powered by SvelteKit Remote Functions, Bun.s3, Bun.Image, PostgreSQL (Drizzle) and
						Valibot
					</p>
				</div>
			</div>
			<div class="flex items-center gap-3">
				<button
					type="button"
					class="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium shadow-xs transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-50"
					onclick={() => imagesQuery.refresh()}
					title="Refresh image gallery"
				>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-4" aria-hidden="true">
						<path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
					</svg>
					Refresh
				</button>
				<span class="rounded-full bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">
					{images.length} {images.length === 1 ? 'image' : 'images'}
				</span>
			</div>
		</header>

		{#if errorMessage}
			<div
				class="mb-6 flex items-center justify-between gap-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
				role="alert"
			>
				<p>{errorMessage}</p>
				<button
					type="button"
					class="rounded p-1 transition-colors hover:bg-destructive/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-destructive"
					onclick={() => (errorMessage = null)}
					aria-label="Dismiss error"
				>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-4" aria-hidden="true">
						<path d="m6 6 12 12M18 6 6 18" />
					</svg>
				</button>
			</div>
		{/if}

		{#if successMessage}
			<div
				class="mb-6 flex items-center justify-between gap-4 rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success"
				role="status"
			>
				<p>{successMessage}</p>
				<button
					type="button"
					class="rounded p-1 transition-colors hover:bg-success/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-success"
					onclick={() => (successMessage = null)}
					aria-label="Dismiss notification"
				>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-4" aria-hidden="true">
						<path d="m6 6 12 12M18 6 6 18" />
					</svg>
				</button>
			</div>
		{/if}

		<section class="mb-10" aria-labelledby="upload-heading">
			<h2 id="upload-heading" class="sr-only">Upload an image</h2>
			<div
				class={`rounded-xl border-2 border-dashed p-6 transition-colors sm:p-8 ${
					dragOver
						? 'border-primary bg-primary/5'
						: selectedFile
							? 'border-border bg-card'
							: 'border-border bg-card hover:border-primary/60'
				}`}
				ondragover={(event) => {
					event.preventDefault();
					dragOver = true;
				}}
				ondragleave={() => (dragOver = false)}
				ondrop={onDrop}
				role="region"
				aria-label="File upload zone"
			>
				{#if !selectedFile}
					<input
						id="fileInput"
						type="file"
						accept="image/*"
						class="sr-only"
						onchange={onFileInputChange}
					/>
					<label for="fileInput" class="flex cursor-pointer flex-col items-center gap-3 text-center">
						<div class="text-primary" aria-hidden="true">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" class="size-11">
								<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
								<path d="m17 8-5-5-5 5M12 3v12" />
							</svg>
						</div>
						<div>
							<p class="font-medium">Choose an image or drag and drop</p>
							<p class="mt-1 text-sm text-muted-foreground">
								PNG, JPG, WEBP, GIF and SVG are processed with Bun.Image and stored in S3.
							</p>
						</div>
						<span class="mt-1 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium shadow-xs transition-colors hover:bg-muted">
							Browse image
						</span>
					</label>
				{:else}
					<div class="flex flex-col items-center gap-6 text-left sm:flex-row sm:items-start">
						<div class="flex size-40 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-background">
							<img src={previewDataUrl} alt="Preview" class="size-full object-contain" />
						</div>
						<div class="min-w-0 flex-1">
							<label for="imageTitle" class="text-sm font-medium text-muted-foreground">Image title / name</label>
							<input
								id="imageTitle"
								type="text"
								bind:value={customName}
								placeholder="Enter image name"
								class="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
							/>
							<div class="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
								<span class="rounded-md bg-muted px-2 py-1">{formatBytes(selectedFile.size)}</span>
								<span class="rounded-md bg-muted px-2 py-1">{selectedFile.type || 'image'}</span>
							</div>
							<div class="mt-5 flex flex-wrap gap-3">
								<button
									type="button"
									class="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-xs transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-50"
									onclick={handleUpload}
									disabled={isUploading}
								>
									{#if isUploading}
										<span class="size-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground"></span>
										Processing with Bun.Image and uploading...
									{:else}
										<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-4" aria-hidden="true">
											<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
											<path d="m17 8-5-5-5 5M12 3v12" />
										</svg>
										Upload to S3
									{/if}
								</button>
								<button
									type="button"
									class="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium shadow-xs transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-50"
									onclick={clearSelection}
									disabled={isUploading}
								>
									Cancel
								</button>
							</div>
						</div>
					</div>
				{/if}
			</div>
		</section>

		<section aria-labelledby="gallery-heading">
			<div class="mb-5 flex items-center justify-between gap-4">
				<h2 id="gallery-heading" class="text-lg font-semibold">Stored images ({images.length})</h2>
				{#if imagesQuery.loading}
					<span class="inline-flex items-center gap-2 text-sm text-muted-foreground">
						<span class="size-3 animate-spin rounded-full border-2 border-current/30 border-t-current"></span>
						Syncing...
					</span>
				{/if}
			</div>

			{#if isLoading}
				<div class="rounded-xl border border-border bg-card px-6 py-16 text-center text-muted-foreground">
					<div class="mx-auto mb-4 size-8 animate-spin rounded-full border-2 border-border border-t-primary"></div>
					<p>Loading images from PostgreSQL and S3...</p>
				</div>
			{:else if images.length === 0}
				<div class="rounded-xl border border-border bg-card px-6 py-16 text-center">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="mx-auto size-10 text-muted-foreground" aria-hidden="true">
						<path d="M3 7.5 5.5 4h13L21 7.5M4 8h16v11.5a.5.5 0 0 1-.5.5h-15a.5.5 0 0 1-.5-.5z" />
						<path d="M9 12h6" />
					</svg>
					<h3 class="mt-4 font-medium">No images stored yet</h3>
					<p class="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
						Upload your first image above to store it in S3 and save its metadata in PostgreSQL.
					</p>
				</div>
			{:else}
				<div class="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
					{#each images as image (image.id)}
						<article class="group overflow-hidden rounded-xl border border-border bg-card shadow-xs transition hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-sm">
							<button
								type="button"
								class="relative block h-52 w-full overflow-hidden bg-muted text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
								onclick={() => openModal(image)}
								aria-label={`View full image: ${image.name}`}
							>
								<img src={image.thumbUrl || image.url} alt={image.name} loading="lazy" class="size-full object-cover transition duration-300 group-hover:scale-105" />
								<span class="absolute inset-0 flex items-center justify-center bg-foreground/60 text-sm font-medium text-background opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
									View full image
								</span>
								{#if image.format}
									<span class="absolute right-3 top-3 rounded-md border border-border/60 bg-background/90 px-2 py-1 text-xs font-semibold tracking-wide text-primary backdrop-blur-sm">
										{image.format.toUpperCase()}
									</span>
								{/if}
							</button>
							<div class="flex flex-1 flex-col gap-3 p-4">
								<h3 class="truncate font-medium" title={image.name}>{image.name}</h3>
								<div class="flex flex-wrap gap-2 text-xs text-muted-foreground">
									{#if image.width && image.height}
										<span class="rounded-md bg-muted px-2 py-1">{image.width} × {image.height}</span>
									{/if}
									<span class="rounded-md bg-muted px-2 py-1">{formatBytes(image.size)}</span>
									<span class="rounded-md bg-muted px-2 py-1">{formatDate(image.createdAt)}</span>
								</div>
								<div class="mt-auto flex gap-2 border-t border-border pt-3">
									<a
										href={image.downloadUrl}
										download={image.name}
										class="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
										title="Download image"
									>
										<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-4" aria-hidden="true">
											<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
											<path d="m7 10 5 5 5-5M12 15V3" />
										</svg>
										Download
									</a>
									<button
										type="button"
										class="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-destructive/30 px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-destructive disabled:pointer-events-none disabled:opacity-50"
										onclick={() => handleDelete(image.id, image.name)}
										disabled={deletingId === image.id}
										title="Delete image"
									>
										{#if deletingId === image.id}
											<span class="size-3 animate-spin rounded-full border-2 border-current/30 border-t-current"></span>
										{:else}
											<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-4" aria-hidden="true">
												<path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14" />
											</svg>
										{/if}
										Delete
									</button>
								</div>
							</div>
						</article>
					{/each}
				</div>
			{/if}
		</section>
	</div>
</main>

{#if activeModalImage}
	<dialog
		open
		class="fixed inset-0 z-50 m-0 flex h-full max-h-none w-full max-w-none items-center justify-center bg-foreground/70 p-4 backdrop:bg-transparent"
		aria-modal="true"
		aria-labelledby="lightbox-title"
		onclick={(event) => {
			if (event.target === event.currentTarget) closeModal();
		}}
	>
		<div class="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
			<div class="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
				<div class="min-w-0">
					<h2 id="lightbox-title" class="truncate font-semibold">{activeModalImage.name}</h2>
					<p class="mt-1 text-sm text-muted-foreground">
						{activeModalImage.width
							? `${activeModalImage.width} × ${activeModalImage.height} · `
							: ''}{formatBytes(activeModalImage.size)} · {activeModalImage.contentType}
					</p>
				</div>
				<button
					type="button"
					class="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
					onclick={closeModal}
					aria-label="Close image preview"
				>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-5" aria-hidden="true">
						<path d="m6 6 12 12M18 6 6 18" />
					</svg>
				</button>
			</div>
			<div class="flex max-h-[65vh] items-center justify-center overflow-auto bg-background p-4">
				<img src={activeModalImage.url} alt={activeModalImage.name} class="max-h-[60vh] max-w-full rounded-lg object-contain" />
			</div>
			<div class="flex flex-wrap justify-end gap-3 border-t border-border px-5 py-4">
				<a
					href={activeModalImage.downloadUrl}
					download={activeModalImage.name}
					class="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-xs transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
				>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-4" aria-hidden="true">
						<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
						<path d="m7 10 5 5 5-5M12 15V3" />
					</svg>
					Download original
				</a>
				<button
					type="button"
					class="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium shadow-xs transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
					onclick={closeModal}
				>
					Close
				</button>
			</div>
		</div>
	</dialog>
{/if}
