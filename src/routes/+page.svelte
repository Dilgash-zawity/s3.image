<script lang="ts">
	// Services
	import { DELETE_IMAGE, GET_IMAGES, UPLOAD_IMAGE } from '#app/images';

	// Script
	type ImageRecord = {
		id: number;
		name: string;
		url: string;
		thumbUrl?: string;
		contentType: string;
		size: number;
		width: number | null;
		height: number | null;
		createdAt: string;
	};

	const imagesQuery = GET_IMAGES();

	let activeImage = $state<ImageRecord | null>(null);
	let deleteError = $state<string | null>(null);
	let dragOver = $state(false);
	let errorMessage = $state<string | null>(null);
	let isDeleting = $state(false);
	let isUploading = $state(false);
	let previewDataUrl = $state<string | null>(null);
	let selectedFile = $state<File | null>(null);
	let showDeleteConfirmation = $state(false);
	let showInfo = $state(false);
	let showUpload = $state(false);

	const images = $derived(imagesQuery.current ?? []);
	const isLoading = $derived(imagesQuery.loading && !imagesQuery.current);

	function formatBytes(bytes: number): string {
		if (bytes === 0) return '0 B';

		const units = ['B', 'KB', 'MB', 'GB'];
		const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
		const value = bytes / Math.pow(1024, index);

		return `${Number(value.toFixed(value >= 10 || index === 0 ? 0 : 1))} ${units[index]}`;
	}

	function formatDate(dateString: string): string {
		const date = new Date(dateString);
		return Number.isNaN(date.getTime()) ? dateString : date.toLocaleString();
	}

	function getErrorMessage(error: unknown, fallback: string): string {
		return error instanceof Error && error.message ? error.message : fallback;
	}

	function clearSelection(): void {
		selectedFile = null;
		previewDataUrl = null;
	}

	function closeUpload(): void {
		if (isUploading) return;

		clearSelection();
		dragOver = false;
		showUpload = false;
	}

	function openUpload(): void {
		errorMessage = null;
		showUpload = true;
	}

	function handleFileSelected(file: File): void {
		if (!file.type.startsWith('image/')) {
			errorMessage = 'Choose an image file to upload.';
			return;
		}

		errorMessage = null;
		selectedFile = file;

		const reader = new FileReader();
		reader.onload = () => {
			previewDataUrl = typeof reader.result === 'string' ? reader.result : null;
		};
		reader.onerror = () => {
			previewDataUrl = null;
			errorMessage = 'Unable to read the selected image.';
		};
		reader.readAsDataURL(file);
	}

	function onFileInputChange(event: Event): void {
		const [file] = (event.currentTarget as HTMLInputElement).files ?? [];
		if (file) handleFileSelected(file);
	}

	function onDrop(event: DragEvent): void {
		event.preventDefault();
		dragOver = false;

		const [file] = event.dataTransfer?.files ?? [];
		if (file) handleFileSelected(file);
	}

	async function handleUpload(): Promise<void> {
		if (!selectedFile || !previewDataUrl) return;

		isUploading = true;
		errorMessage = null;

		try {
			await UPLOAD_IMAGE({
				name: selectedFile.name,
				mimeType: selectedFile.type,
				data: previewDataUrl
			}).updates(GET_IMAGES);

			isUploading = false;
			closeUpload();
			await imagesQuery.refresh();
		} catch (error: unknown) {
			errorMessage = getErrorMessage(error, 'Upload failed. Please try again.');
		} finally {
			isUploading = false;
		}
	}

	function openLightbox(image: ImageRecord): void {
		activeImage = image;
		deleteError = null;
		showDeleteConfirmation = false;
		showInfo = false;
	}

	function closeLightbox(): void {
		if (isDeleting) return;

		activeImage = null;
		deleteError = null;
		showDeleteConfirmation = false;
		showInfo = false;
	}

	function openDeleteConfirmation(): void {
		deleteError = null;
		showDeleteConfirmation = true;
	}

	function closeDeleteConfirmation(): void {
		if (isDeleting) return;

		deleteError = null;
		showDeleteConfirmation = false;
	}

	async function handleDelete(): Promise<void> {
		if (!activeImage || isDeleting) return;

		isDeleting = true;
		deleteError = null;

		try {
			await DELETE_IMAGE({ id: activeImage.id }).updates(GET_IMAGES);

			activeImage = null;
			showDeleteConfirmation = false;
			showInfo = false;
			await imagesQuery.refresh();
		} catch {
			deleteError = 'Unable to delete this image. Please try again.';
		} finally {
			isDeleting = false;
		}
	}

	function onLightboxBackdropClick(event: MouseEvent): void {
		if (event.target === event.currentTarget && !showDeleteConfirmation) closeLightbox();
	}

	function onKeyDown(event: KeyboardEvent): void {
		if (event.key !== 'Escape') return;

		if (showDeleteConfirmation) closeDeleteConfirmation();
		else if (activeImage) closeLightbox();
		else if (showUpload) closeUpload();
	}
</script>

<svelte:window onkeydown={onKeyDown} />

<svelte:head><title>Gallery</title></svelte:head>

<main class="min-h-screen bg-background px-4 py-5 text-foreground sm:px-6 sm:py-6 lg:px-8 lg:py-8">
	{#if errorMessage}
		<div
			class="mx-auto mb-5 max-w-[1800px] border border-destructive bg-background px-4 py-3 text-sm text-destructive shadow-sm"
			role="alert"
		>
			<div class="flex items-center justify-between gap-4">
				<p>{errorMessage}</p>
				<button
					type="button"
					onclick={() => (errorMessage = null)}
					class="rounded-sm p-1 transition hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
					aria-label="Dismiss error"
				>
					<svg
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						class="size-4"
						aria-hidden="true"
					>
						<path d="m6 6 12 12M18 6 6 18" />
					</svg>
				</button>
			</div>
		</div>
	{/if}

	{#if isLoading}
		<div
			class="mx-auto max-w-[1800px] columns-2 gap-4 sm:columns-3 sm:gap-5 lg:columns-4 xl:columns-5"
			aria-label="Loading gallery"
			aria-busy="true"
		>
			{#each Array(10) as _, index (index)}
				<div
					class={`mb-4 break-inside-avoid bg-muted animate-pulse sm:mb-5 ${
						index % 3 === 0
							? 'aspect-square'
							: index % 3 === 1
								? 'aspect-[3/4]'
								: 'aspect-[4/3]'
					}`}
				></div>
			{/each}
		</div>
	{:else if images.length === 0}
		<section
			class="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center"
			aria-labelledby="empty-gallery-title"
		>
			<h1 id="empty-gallery-title" class="text-lg font-medium">Your gallery is empty</h1>
			<p class="mt-2 text-sm text-muted-foreground">
				Upload an image to start your collection.
			</p>
		</section>
	{:else}
		<section
			class="mx-auto max-w-[1800px] columns-2 gap-4 sm:columns-3 sm:gap-5 lg:columns-4 xl:columns-5"
			aria-label="Image gallery"
		>
			{#each images as image (image.id)}
				<button
					type="button"
					onclick={() => openLightbox(image)}
					class="group mb-4 block w-full break-inside-avoid overflow-hidden bg-muted text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:mb-5"
					aria-label={`Open ${image.name}`}
				>
					<img
						src={image.thumbUrl || image.url}
						alt={image.name}
						loading="lazy"
						class="block h-auto w-full transition duration-300 ease-out group-hover:scale-[1.015] group-hover:brightness-105 group-focus-visible:scale-[1.015] group-focus-visible:brightness-105"
					/>
				</button>
			{/each}
		</section>
	{/if}
</main>

<button
	type="button"
	onclick={openUpload}
	class="fixed right-5 bottom-5 z-30 flex size-14 items-center justify-center !rounded-full bg-primary text-primary-foreground shadow-lg transition duration-200 hover:scale-105 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary active:scale-95 sm:right-7 sm:bottom-7"
	aria-label="Upload image"
>
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		class="size-6"
		aria-hidden="true"
	>
		<path d="M12 5v14M5 12h14" />
	</svg>
</button>

{#if showUpload}
	<dialog
		open
		class="fixed inset-0 z-40 m-0 flex size-full max-h-none max-w-none items-center justify-center border-0 bg-foreground/70 p-4"
		aria-modal="true"
		aria-labelledby="upload-title"
		onclick={(event) => event.target === event.currentTarget && closeUpload()}
	>
		<section class="w-full max-w-lg overflow-hidden bg-background shadow-xl">
			<header class="border-b border-border px-5 py-4 sm:px-6">
				<h1 id="upload-title" class="text-base font-medium">Upload image</h1>
				<p class="mt-1 text-sm text-muted-foreground">
					Choose an image from your device or drop it below.
				</p>
			</header>
			<div class="p-5 sm:p-6">
				{#if errorMessage}
					<p class="mb-4 text-sm text-destructive" role="alert">{errorMessage}</p>
				{/if}
				<div
					class={`border border-dashed p-4 transition sm:p-5 ${dragOver ? 'border-primary bg-muted' : 'border-border'}`}
					ondragover={(event) => {
						event.preventDefault();
						dragOver = true;
					}}
					ondragleave={() => (dragOver = false)}
					ondrop={onDrop}
					role="region"
					aria-label="Drop an image here"
				>
					<input
						id="upload-image"
						type="file"
						accept="image/*"
						class="sr-only"
						onchange={onFileInputChange}
					/>
					{#if selectedFile && previewDataUrl}
						<div class="flex flex-col gap-5 sm:flex-row">
							<img
								src={previewDataUrl}
								alt="Selected preview"
								class="aspect-square w-full bg-muted object-contain sm:size-36"
							/>
							<div class="flex min-w-0 flex-1 flex-col justify-between gap-5">
								<div>
									<p class="truncate text-sm font-medium">{selectedFile.name}</p>
									<p class="mt-1 text-sm text-muted-foreground">
										{formatBytes(selectedFile.size)}
									</p>
								</div>
								<div class="flex flex-wrap gap-2">
									<button
										type="button"
										onclick={handleUpload}
										disabled={isUploading}
										class="bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
									>
										{isUploading ? 'Uploading…' : 'Upload'}
									</button>
									<button
										type="button"
										onclick={closeUpload}
										disabled={isUploading}
										class="border border-border px-4 py-2 text-sm transition hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
									>
										Cancel
									</button>
								</div>
							</div>
						</div>
					{:else}
						<label
							for="upload-image"
							class="flex min-h-52 cursor-pointer flex-col items-center justify-center px-4 text-center"
						>
							<svg
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="1.8"
								class="size-8 text-muted-foreground"
								aria-hidden="true"
							>
								<path d="M12 16V4m0 0L7 9m5-5 5 5M5 20h14" />
							</svg>
							<p class="mt-3 text-sm font-medium">Drop an image here or choose a file</p>
							<p class="mt-1 text-sm text-muted-foreground">Image files only</p>
						</label>
					{/if}
				</div>
				{#if !selectedFile || !previewDataUrl}
					<div class="mt-4 flex justify-end">
						<button
							type="button"
							onclick={closeUpload}
							class="border border-border px-4 py-2 text-sm transition hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
						>
							Cancel
						</button>
					</div>
				{/if}
			</div>
		</section>
	</dialog>
{/if}

{#if activeImage}
	<dialog
		open
		class="fixed inset-0 z-40 m-0 flex size-full max-h-none max-w-none items-center justify-center border-0 bg-foreground/90 p-4 sm:p-6"
		aria-modal="true"
		aria-label={`Preview ${activeImage.name}`}
		onclick={onLightboxBackdropClick}
	>
		<div class="relative flex size-full items-center justify-center">
			<img
				src={activeImage.url}
				alt={activeImage.name}
				class="max-h-full max-w-full object-contain"
			/>
			<div class="absolute top-0 right-0 flex items-center gap-2 !rounded-full bg-background/95 p-1.5 text-foreground shadow-lg backdrop-blur">
				<button
					type="button"
					onclick={() => (showInfo = !showInfo)}
					disabled={isDeleting}
					class="flex size-9 items-center justify-center !rounded-full transition hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
					aria-label={showInfo ? 'Hide image information' : 'Show image information'}
					aria-pressed={showInfo}
				>
					<svg
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						class="size-5"
						aria-hidden="true"
					>
						<circle cx="12" cy="12" r="9" />
						<path d="M12 11v6M12 7h.01" />
					</svg>
				</button>
				<button
					type="button"
					onclick={openDeleteConfirmation}
					disabled={isDeleting}
					class="flex size-9 items-center justify-center !rounded-full text-destructive transition hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
					aria-label="Delete image"
					aria-controls="delete-confirmation"
				>
					<svg
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						class="size-5"
						aria-hidden="true"
					>
						<path d="M4 7h16M10 11v6M14 11v6M9 7l1-3h4l1 3M6 7l1 13h10l1-13" />
					</svg>
				</button>
				<button
					type="button"
					onclick={closeLightbox}
					disabled={isDeleting}
					class="flex size-9 items-center justify-center !rounded-full transition hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
					aria-label="Close image preview"
				>
					<svg
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						class="size-5"
						aria-hidden="true"
					>
						<path d="m6 6 12 12M18 6 6 18" />
					</svg>
				</button>
			</div>
			{#if showInfo}
				<aside
					class="absolute right-0 bottom-0 w-full max-w-sm border border-border bg-background/95 p-5 text-sm text-foreground shadow-xl backdrop-blur sm:w-80"
					aria-label="Image metadata"
				>
					<p class="mb-4 text-xs font-medium tracking-wide text-muted-foreground uppercase">
						Image details
					</p>
					<dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3">
						<dt class="text-muted-foreground">Name</dt>
						<dd class="truncate font-medium">{activeImage.name}</dd>
						{#if activeImage.width && activeImage.height}
							<dt class="text-muted-foreground">Dimensions</dt>
							<dd>{activeImage.width} × {activeImage.height}</dd>
						{/if}
						<dt class="text-muted-foreground">Format</dt>
						<dd>{activeImage.contentType}</dd>
						<dt class="text-muted-foreground">Size</dt>
						<dd>{formatBytes(activeImage.size)}</dd>
						<dt class="text-muted-foreground">Added</dt>
						<dd>{formatDate(activeImage.createdAt)}</dd>
					</dl>
				</aside>
			{/if}
			{#if showDeleteConfirmation}
				<section
					id="delete-confirmation"
					class="absolute top-14 right-0 w-full max-w-sm border border-border bg-background p-5 text-foreground shadow-xl sm:w-80"
					aria-labelledby="delete-title"
					aria-describedby="delete-description"
				>
					<h2 id="delete-title" class="text-sm font-medium">Delete image?</h2>
					<p id="delete-description" class="mt-2 text-sm text-muted-foreground">
						This permanently removes <span class="font-medium text-foreground">{activeImage.name}</span>.
					</p>
					{#if deleteError}
						<p class="mt-3 text-sm text-destructive" role="alert">{deleteError}</p>
					{/if}
					<div class="mt-5 flex justify-end gap-2">
						<button
							type="button"
							onclick={closeDeleteConfirmation}
							disabled={isDeleting}
							class="border border-border px-3 py-2 text-sm transition hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
						>
							Cancel
						</button>
						<button
							type="button"
							onclick={handleDelete}
							disabled={isDeleting}
							class="bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
						>
							{isDeleting ? 'Deleting…' : 'Delete'}
						</button>
					</div>
				</section>
			{/if}
		</div>
	</dialog>
{/if}
