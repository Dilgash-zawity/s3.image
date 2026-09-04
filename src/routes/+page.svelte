<script lang="ts">
	import { getImages, uploadImage, deleteImage } from '#lib/images.remote';

	// SvelteKit remote query for retrieving images
	const imagesQuery = getImages();

	// Component state
	let dragOver = $state(false);
	let selectedFile = $state<File | null>(null);
	let previewDataUrl = $state<string | null>(null);
	let customName = $state('');
	let isUploading = $state(false);
	let deletingId = $state<number | null>(null);
	let errorMessage = $state<string | null>(null);
	let successMessage = $state<string | null>(null);
	let activeModalImage = $state<{
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
	} | null>(null);

	// Derived list of images from the remote query
	const images = $derived(imagesQuery.current ?? []);
	const isLoading = $derived(imagesQuery.loading && !imagesQuery.current);

	function formatBytes(bytes: number, decimals = 1) {
		if (bytes === 0) return '0 Bytes';
		const k = 1024;
		const dm = decimals < 0 ? 0 : decimals;
		const sizes = ['Bytes', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
	}

	function formatDate(dateStr: string) {
		try {
			return new Intl.DateTimeFormat(undefined, {
				month: 'short',
				day: 'numeric',
				hour: '2-digit',
				minute: '2-digit'
			}).format(new Date(dateStr));
		} catch {
			return dateStr;
		}
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
		reader.onload = (e) => {
			previewDataUrl = e.target?.result as string;
		};
		reader.readAsDataURL(file);
	}

	function onFileInputChange(event: Event) {
		const target = event.target as HTMLInputElement;
		if (target.files && target.files.length > 0) {
			handleFileSelected(target.files[0]);
		}
	}

	function onDrop(event: DragEvent) {
		event.preventDefault();
		dragOver = false;
		if (event.dataTransfer && event.dataTransfer.files.length > 0) {
			handleFileSelected(event.dataTransfer.files[0]);
		}
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
			// Call SvelteKit remote command validated with Valibot
			await uploadImage({
				name: customName.trim() || selectedFile.name,
				mimeType: selectedFile.type,
				data: previewDataUrl
			}).updates(getImages);

			successMessage = `Successfully uploaded "${customName || selectedFile.name}"`;
			clearSelection();
			await imagesQuery.refresh();
		} catch (err: any) {
			errorMessage = err?.message || 'Upload failed. Please try again.';
		} finally {
			isUploading = false;
		}
	}

	async function handleDelete(id: number, name: string) {
		if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

		deletingId = id;
		errorMessage = null;
		try {
			// Call SvelteKit remote command to remove from S3 and Postgres
			await deleteImage({ id }).updates(getImages);
			successMessage = `Deleted "${name}"`;
			if (activeModalImage?.id === id) {
				activeModalImage = null;
			}
			await imagesQuery.refresh();
		} catch (err: any) {
			errorMessage = err?.message || 'Failed to delete image';
		} finally {
			deletingId = null;
		}
	}

	function openModal(img: typeof activeModalImage) {
		activeModalImage = img;
	}

	function closeModal() {
		activeModalImage = null;
	}

	function onKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape') closeModal();
	}
</script>

<svelte:window onkeydown={onKeyDown} />

<div class="app-container">
	<!-- Header -->
	<header class="header">
		<div class="header-inner">
			<div class="branding">
				<div class="logo-icon">🖼️</div>
				<div>
					<h1>Image Storage Prototype</h1>
					<p class="subtitle">
						Powered by <strong>SvelteKit Remote Functions</strong>, <strong>Bun.s3</strong>,
						<strong>Bun.Image</strong>, <strong>PostgreSQL (Drizzle)</strong> &
						<strong>Valibot</strong>
					</p>
				</div>
			</div>
			<div class="header-actions">
				<button
					class="btn-secondary"
					onclick={() => imagesQuery.refresh()}
					title="Refresh image gallery"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
					</svg>
					Refresh
				</button>
				<div class="badge-count">
					{images.length} {images.length === 1 ? 'image' : 'images'}
				</div>
			</div>
		</div>
	</header>

	<!-- Notifications -->
	{#if errorMessage}
		<div class="notification error-notification">
			<span>⚠️ {errorMessage}</span>
			<button class="close-notif" onclick={() => (errorMessage = null)}>×</button>
		</div>
	{/if}

	{#if successMessage}
		<div class="notification success-notification">
			<span>✅ {successMessage}</span>
			<button class="close-notif" onclick={() => (successMessage = null)}>×</button>
		</div>
	{/if}

	<!-- Upload Section -->
	<section class="upload-section">
		<div
			class="dropzone {dragOver ? 'drag-over' : ''} {selectedFile ? 'has-file' : ''}"
			ondragover={(e) => {
				e.preventDefault();
				dragOver = true;
			}}
			ondragleave={() => (dragOver = false)}
			ondrop={onDrop}
			role="region"
			aria-label="File Upload Zone"
		>
			{#if !selectedFile}
				<input
					type="file"
					id="fileInput"
					accept="image/*"
					class="file-input-hidden"
					onchange={onFileInputChange}
				/>
				<label for="fileInput" class="dropzone-content">
					<div class="upload-icon">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="44"
							height="44"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="1.75"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
							<polyline points="17 8 12 3 7 8" />
							<line x1="12" y1="3" x2="12" y2="15" />
						</svg>
					</div>
					<div class="dropzone-text">
						<span class="dropzone-prompt">Choose an image or drag & drop</span>
						<span class="dropzone-hint"
							>PNG, JPG, WEBP, GIF, SVG • Processed with Bun.Image & stored in S3</span
						>
					</div>
					<span class="btn-browse">Browse Image</span>
				</label>
			{:else}
				<div class="preview-panel">
					<div class="preview-img-wrapper">
						<img src={previewDataUrl} alt="Preview" class="preview-img" />
					</div>
					<div class="preview-details">
						<label class="input-label" for="imageTitle">Image Title / Name</label>
						<input
							id="imageTitle"
							type="text"
							bind:value={customName}
							placeholder="Enter image name"
							class="text-input"
						/>
						<div class="file-meta">
							<span>📁 {formatBytes(selectedFile.size)}</span>
							<span>🏷️ {selectedFile.type || 'image'}</span>
						</div>
						<div class="preview-actions">
							<button class="btn-primary" onclick={handleUpload} disabled={isUploading}>
								{#if isUploading}
									<span class="spinner"></span>
									Processing with Bun.Image & Uploading...
								{:else}
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="16"
										height="16"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									>
										<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
										<polyline points="17 8 12 3 7 8" />
										<line x1="12" y1="3" x2="12" y2="15" />
									</svg>
									Upload to S3
								{/if}
							</button>
							<button class="btn-secondary" onclick={clearSelection} disabled={isUploading}>
								Cancel
							</button>
						</div>
					</div>
				</div>
			{/if}
		</div>
	</section>

	<!-- Gallery Section -->
	<section class="gallery-section">
		<div class="section-title-row">
			<h2>Stored Images ({images.length})</h2>
			{#if imagesQuery.loading}
				<span class="syncing-indicator">
					<span class="spinner-small"></span> Syncing...
				</span>
			{/if}
		</div>

		{#if isLoading}
			<div class="loading-state">
				<div class="spinner-large"></div>
				<p>Loading images from PostgreSQL & S3...</p>
			</div>
		{:else if images.length === 0}
			<div class="empty-state">
				<div class="empty-icon">📁</div>
				<h3>No images stored yet</h3>
				<p>Upload your first image above to store it in S3 and save its metadata in PostgreSQL.</p>
			</div>
		{:else}
			<div class="gallery-grid">
				{#each images as img (img.id)}
					<div class="image-card">
						<div
							class="card-thumbnail-container"
							onclick={() => openModal(img)}
							role="button"
							tabindex="0"
							onkeydown={(e) => e.key === 'Enter' && openModal(img)}
						>
							<img
								src={img.thumbUrl || img.url}
								alt={img.name}
								loading="lazy"
								class="card-thumbnail"
							/>
							<div class="thumbnail-overlay">
								<span>🔍 View Full</span>
							</div>
							{#if img.format}
								<span class="format-badge">{img.format.toUpperCase()}</span>
							{/if}
						</div>

						<div class="card-body">
							<h3 class="card-title" title={img.name}>{img.name}</h3>

							<div class="card-metadata">
								{#if img.width && img.height}
									<span class="meta-tag">📐 {img.width} × {img.height}</span>
								{/if}
								<span class="meta-tag">💾 {formatBytes(img.size)}</span>
								<span class="meta-tag">🕒 {formatDate(img.createdAt)}</span>
							</div>

							<div class="card-actions">
								<!-- Direct download endpoint using Bun S3 streaming -->
								<a
									href={img.downloadUrl}
									download={img.name}
									class="btn-action btn-download"
									title="Download image"
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="15"
										height="15"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									>
										<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
										<polyline points="7 10 12 15 17 10" />
										<line x1="12" y1="15" x2="12" y2="3" />
									</svg>
									Download
								</a>

								<!-- Delete button invoking remote command -->
								<button
									class="btn-action btn-delete"
									onclick={() => handleDelete(img.id, img.name)}
									disabled={deletingId === img.id}
									title="Delete image"
								>
									{#if deletingId === img.id}
										<span class="spinner-small"></span>
									{:else}
										<svg
											xmlns="http://www.w3.org/2000/svg"
											width="15"
											height="15"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											stroke-linecap="round"
											stroke-linejoin="round"
										>
											<polyline points="3 6 5 6 21 6" />
											<path
												d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
											/>
										</svg>
									{/if}
									Delete
								</button>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</section>
</div>

<!-- Lightbox Modal -->
{#if activeModalImage}
	<div
		class="modal-backdrop"
		onclick={(e) => {
			if (e.target === e.currentTarget) closeModal();
		}}
		onkeydown={(e) => {
			if (e.key === 'Escape') closeModal();
		}}
		role="dialog"
		aria-modal="true"
		tabindex="-1"
	>
		<div class="modal-content">
			<div class="modal-header">
				<div class="modal-title-group">
					<h3>{activeModalImage.name}</h3>
					<span class="modal-sub">
						{activeModalImage.width ? `${activeModalImage.width} × ${activeModalImage.height} • ` : ''}
						{formatBytes(activeModalImage.size)} •
						{activeModalImage.contentType}
					</span>
				</div>
				<button class="modal-close-btn" onclick={closeModal}>✕</button>
			</div>

			<div class="modal-body">
				<img src={activeModalImage.url} alt={activeModalImage.name} class="modal-image" />
			</div>

			<div class="modal-footer">
				<a
					href={activeModalImage.downloadUrl}
					download={activeModalImage.name}
					class="btn-primary"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
						<polyline points="7 10 12 15 17 10" />
						<line x1="12" y1="15" x2="12" y2="3" />
					</svg>
					Download Original
				</a>
				<button class="btn-secondary" onclick={closeModal}>Close</button>
			</div>
		</div>
	</div>
{/if}

<style>
	:global(body) {
		margin: 0;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell,
			sans-serif;
		background: #0d1117;
		color: #e6edf3;
		line-height: 1.5;
	}

	.app-container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem 1.5rem 4rem;
	}

	/* Header */
	.header {
		margin-bottom: 2rem;
		border-bottom: 1px solid #21262d;
		padding-bottom: 1.5rem;
	}

	.header-inner {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.branding {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.logo-icon {
		font-size: 2.2rem;
		background: #161b22;
		padding: 0.5rem;
		border-radius: 12px;
		border: 1px solid #30363d;
	}

	h1 {
		margin: 0;
		font-size: 1.6rem;
		font-weight: 700;
		color: #f0f6fc;
	}

	.subtitle {
		margin: 0.25rem 0 0;
		font-size: 0.88rem;
		color: #8b949e;
	}

	.subtitle strong {
		color: #58a6ff;
		font-weight: 500;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.badge-count {
		background: #238636;
		color: #ffffff;
		font-size: 0.82rem;
		font-weight: 600;
		padding: 0.4rem 0.8rem;
		border-radius: 20px;
	}

	/* Notifications */
	.notification {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.85rem 1.25rem;
		border-radius: 8px;
		margin-bottom: 1.5rem;
		font-size: 0.92rem;
	}

	.error-notification {
		background: rgba(248, 81, 73, 0.15);
		border: 1px solid #f85149;
		color: #ff7b72;
	}

	.success-notification {
		background: rgba(46, 160, 67, 0.15);
		border: 1px solid #2ea043;
		color: #3fb950;
	}

	.close-notif {
		background: transparent;
		border: none;
		color: inherit;
		font-size: 1.25rem;
		cursor: pointer;
		padding: 0 0.25rem;
	}

	/* Upload Dropzone */
	.upload-section {
		margin-bottom: 2.5rem;
	}

	.dropzone {
		background: #161b22;
		border: 2px dashed #30363d;
		border-radius: 12px;
		padding: 2.5rem 1.5rem;
		text-align: center;
		transition: all 0.2s ease;
		position: relative;
	}

	.dropzone.drag-over {
		border-color: #58a6ff;
		background: #1c2128;
	}

	.dropzone.has-file {
		padding: 1.5rem;
		border-style: solid;
		border-color: #30363d;
	}

	.file-input-hidden {
		display: none;
	}

	.dropzone-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		cursor: pointer;
	}

	.upload-icon {
		color: #58a6ff;
	}

	.dropzone-text {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.dropzone-prompt {
		font-size: 1.1rem;
		font-weight: 600;
		color: #f0f6fc;
	}

	.dropzone-hint {
		font-size: 0.85rem;
		color: #8b949e;
	}

	.btn-browse {
		background: #21262d;
		color: #c9d1d9;
		border: 1px solid #363b42;
		padding: 0.5rem 1.25rem;
		border-radius: 6px;
		font-size: 0.9rem;
		font-weight: 500;
		margin-top: 0.5rem;
		transition: all 0.15s ease;
	}

	.dropzone-content:hover .btn-browse {
		background: #30363d;
		color: #f0f6fc;
	}

	/* Preview Panel */
	.preview-panel {
		display: flex;
		gap: 2rem;
		align-items: center;
		text-align: left;
		flex-wrap: wrap;
	}

	.preview-img-wrapper {
		width: 180px;
		height: 180px;
		border-radius: 8px;
		overflow: hidden;
		background: #0d1117;
		border: 1px solid #30363d;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.preview-img {
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
	}

	.preview-details {
		flex: 1;
		min-width: 250px;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.input-label {
		font-size: 0.85rem;
		font-weight: 500;
		color: #8b949e;
	}

	.text-input {
		background: #0d1117;
		border: 1px solid #30363d;
		color: #f0f6fc;
		padding: 0.6rem 0.85rem;
		border-radius: 6px;
		font-size: 0.95rem;
		width: 100%;
		box-sizing: border-box;
	}

	.text-input:focus {
		outline: none;
		border-color: #58a6ff;
	}

	.file-meta {
		display: flex;
		gap: 1rem;
		font-size: 0.85rem;
		color: #8b949e;
	}

	.preview-actions {
		display: flex;
		gap: 0.75rem;
		margin-top: 0.5rem;
	}

	/* Buttons */
	.btn-primary {
		background: #238636;
		color: #ffffff;
		border: none;
		padding: 0.6rem 1.25rem;
		border-radius: 6px;
		font-size: 0.9rem;
		font-weight: 600;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		text-decoration: none;
		transition: background 0.15s ease;
	}

	.btn-primary:hover:not(:disabled) {
		background: #2ea043;
	}

	.btn-primary:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn-secondary {
		background: #21262d;
		color: #c9d1d9;
		border: 1px solid #30363d;
		padding: 0.6rem 1rem;
		border-radius: 6px;
		font-size: 0.9rem;
		font-weight: 500;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		transition: all 0.15s ease;
	}

	.btn-secondary:hover:not(:disabled) {
		background: #30363d;
		color: #f0f6fc;
	}

	/* Gallery */
	.section-title-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.25rem;
	}

	.section-title-row h2 {
		font-size: 1.3rem;
		font-weight: 600;
		margin: 0;
	}

	.syncing-indicator {
		font-size: 0.85rem;
		color: #8b949e;
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.loading-state,
	.empty-state {
		background: #161b22;
		border: 1px solid #30363d;
		border-radius: 12px;
		padding: 3.5rem 1.5rem;
		text-align: center;
		color: #8b949e;
	}

	.empty-icon {
		font-size: 3rem;
		margin-bottom: 0.5rem;
	}

	.empty-state h3 {
		color: #f0f6fc;
		margin: 0.5rem 0 0.25rem;
	}

	.empty-state p {
		max-width: 400px;
		margin: 0.25rem auto 0;
		font-size: 0.9rem;
	}

	.gallery-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 1.5rem;
	}

	/* Image Card */
	.image-card {
		background: #161b22;
		border: 1px solid #30363d;
		border-radius: 10px;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		transition: transform 0.15s ease, border-color 0.15s ease;
	}

	.image-card:hover {
		transform: translateY(-2px);
		border-color: #58a6ff;
	}

	.card-thumbnail-container {
		position: relative;
		width: 100%;
		height: 200px;
		background: #0d1117;
		cursor: pointer;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.card-thumbnail {
		width: 100%;
		height: 100%;
		object-fit: cover;
		transition: transform 0.25s ease;
	}

	.card-thumbnail-container:hover .card-thumbnail {
		transform: scale(1.04);
	}

	.thumbnail-overlay {
		position: absolute;
		inset: 0;
		background: rgba(13, 17, 23, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		color: #ffffff;
		font-size: 0.9rem;
		font-weight: 500;
		opacity: 0;
		transition: opacity 0.2s ease;
	}

	.card-thumbnail-container:hover .thumbnail-overlay {
		opacity: 1;
	}

	.format-badge {
		position: absolute;
		top: 10px;
		right: 10px;
		background: rgba(13, 17, 23, 0.85);
		color: #58a6ff;
		font-size: 0.72rem;
		font-weight: 700;
		padding: 0.2rem 0.5rem;
		border-radius: 4px;
		border: 1px solid rgba(88, 166, 255, 0.3);
		backdrop-filter: blur(4px);
	}

	.card-body {
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		flex: 1;
	}

	.card-title {
		margin: 0;
		font-size: 0.98rem;
		font-weight: 600;
		color: #f0f6fc;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.card-metadata {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.meta-tag {
		background: #21262d;
		color: #8b949e;
		font-size: 0.75rem;
		padding: 0.2rem 0.5rem;
		border-radius: 4px;
	}

	.card-actions {
		display: flex;
		gap: 0.5rem;
		margin-top: auto;
		padding-top: 0.5rem;
		border-top: 1px solid #21262d;
	}

	.btn-action {
		flex: 1;
		padding: 0.45rem 0.75rem;
		border-radius: 6px;
		font-size: 0.82rem;
		font-weight: 500;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		text-decoration: none;
		border: 1px solid transparent;
		transition: all 0.15s ease;
	}

	.btn-download {
		background: #21262d;
		color: #58a6ff;
		border-color: #30363d;
	}

	.btn-download:hover {
		background: #30363d;
		border-color: #58a6ff;
	}

	.btn-delete {
		background: transparent;
		color: #f85149;
		border-color: #30363d;
	}

	.btn-delete:hover:not(:disabled) {
		background: rgba(248, 81, 73, 0.12);
		border-color: #f85149;
	}

	.btn-delete:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Modal / Lightbox */
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.85);
		backdrop-filter: blur(6px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: 1.5rem;
		box-sizing: border-box;
	}

	.modal-content {
		background: #161b22;
		border: 1px solid #30363d;
		border-radius: 12px;
		max-width: 900px;
		width: 100%;
		max-height: 90vh;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
	}

	.modal-header {
		padding: 1rem 1.5rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
		border-bottom: 1px solid #21262d;
	}

	.modal-title-group h3 {
		margin: 0;
		font-size: 1.1rem;
		color: #f0f6fc;
	}

	.modal-sub {
		font-size: 0.8rem;
		color: #8b949e;
	}

	.modal-close-btn {
		background: transparent;
		border: none;
		color: #8b949e;
		font-size: 1.4rem;
		cursor: pointer;
		padding: 0.25rem;
	}

	.modal-close-btn:hover {
		color: #f0f6fc;
	}

	.modal-body {
		padding: 1rem;
		background: #0d1117;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: auto;
		max-height: 65vh;
	}

	.modal-image {
		max-width: 100%;
		max-height: 60vh;
		object-fit: contain;
		border-radius: 6px;
	}

	.modal-footer {
		padding: 1rem 1.5rem;
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		border-top: 1px solid #21262d;
	}

	/* Spinners */
	.spinner {
		width: 14px;
		height: 14px;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-top-color: #ffffff;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	.spinner-small {
		width: 12px;
		height: 12px;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-top-color: currentColor;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
		display: inline-block;
	}

	.spinner-large {
		width: 32px;
		height: 32px;
		border: 3px solid #30363d;
		border-top-color: #58a6ff;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
		margin: 0 auto 1rem;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
