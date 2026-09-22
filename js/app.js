/**
 * MaarstOn Craft — Image Compress Controller
 * 100% In-Browser • Zero Server Upload • High Performance & Memory Safe
 */

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Core Compression Engine
  const imageEngine = new ImageEngine();

  // App State
  const state = {
    currentFile: null,
    viewMode: 'side',       // 'side', 'split', 'toggle'
    mobilePreview: 'comp',  // 'orig', 'comp'
    splitRatio: 0.5,
    isDraggingSplit: false,
    ratioLocked: true,
    aspectRatioVal: 1,
    debounceTimer: null
  };

  // --- 1. Theme Management (Yellow + Black / Yellow + White) ---
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const storedTheme = localStorage.getItem('maarston-theme') || 'dark';
  applyTheme(storedTheme);

  themeToggleBtn?.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'light' ? 'dark' : 'light';
    applyTheme(next);
    showToast(`Switched to ${next} mode`, 'info');
  });

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('maarston-theme', theme);

    const logo = document.getElementById('headerBrandLogo');
    if (logo) {
      logo.src = theme === 'light' ? 'assets/logo/logo-full-light.svg' : 'assets/logo/logo-full-dark.svg';
    }

    if (themeToggleBtn) {
      themeToggleBtn.innerHTML = theme === 'light'
        ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
    }
  }

  // --- 2. Elements Cache ---
  const dropzone = document.getElementById('dropzone');
  const filePicker = document.getElementById('filePicker');
  const btnDropzoneBrowse = document.getElementById('btnDropzoneBrowse');
  const btnChangeImage = document.getElementById('btnChangeImage');
  const uploadSection = document.getElementById('uploadSection');
  const workspaceSection = document.getElementById('workspaceSection');
  const errorBanner = document.getElementById('errorBanner');
  const errorMessage = document.getElementById('errorMessage');
  const closeErrorBtn = document.getElementById('closeErrorBtn');

  // Slider & Status Controls
  const qualitySlider = document.getElementById('qualitySlider');
  const qualityNumDisplay = document.getElementById('qualityNumDisplay');
  const qualityStatusCard = document.getElementById('qualityStatusCard');
  const statusBadgeText = document.getElementById('statusBadgeText');
  const statusDescText = document.getElementById('statusDescText');
  const presetButtons = document.querySelectorAll('.preset-btn');

  // Real-Time Metrics
  const metricOrigSize = document.getElementById('metricOrigSize');
  const metricCompSize = document.getElementById('metricCompSize');
  const metricSavedBytes = document.getElementById('metricSavedBytes');
  const metricReductionBadge = document.getElementById('metricReductionBadge');

  // Size Increase Warning Banner & Quick Fixes
  const sizeIncreaseWarning = document.getElementById('sizeIncreaseWarning');
  const warningIncreasePct = document.getElementById('warningIncreasePct');
  const btnFixQuality = document.getElementById('btnFixQuality');
  const btnFixWebp = document.getElementById('btnFixWebp');
  const btnFixResize = document.getElementById('btnFixResize');

  // File Metadata Strip
  const metaFileName = document.getElementById('metaFileName');
  const metaOriginalSize = document.getElementById('metaOriginalSize');
  const metaDimensions = document.getElementById('metaDimensions');
  const metaFormat = document.getElementById('metaFormat');
  const metaRatio = document.getElementById('metaRatio');

  // Viewport Elements
  const tabSideBySide = document.getElementById('tabSideBySide');
  const tabSplitSlider = document.getElementById('tabSplitSlider');
  const tabToggleMobile = document.getElementById('tabToggleMobile');
  const viewSideBySide = document.getElementById('viewSideBySide');
  const viewSplitSlider = document.getElementById('viewSplitSlider');
  const viewToggleMobile = document.getElementById('viewToggleMobile');

  const sideOrigImg = document.getElementById('sideOrigImg');
  const sideCompImg = document.getElementById('sideCompImg');
  const sideOrigSizeBadge = document.getElementById('sideOrigSizeBadge');
  const sideCompSizeBadge = document.getElementById('sideCompSizeBadge');

  const splitCanvas = document.getElementById('splitCanvas');
  const splitCanvasContainer = document.getElementById('splitCanvasContainer');

  const mobBtnOriginal = document.getElementById('mobBtnOriginal');
  const mobBtnCompressed = document.getElementById('mobBtnCompressed');
  const mobPreviewImg = document.getElementById('mobPreviewImg');
  const mobOrigBadge = document.getElementById('mobOrigBadge');
  const mobCompBadge = document.getElementById('mobCompBadge');

  // Advanced Controls
  const formatSelect = document.getElementById('formatSelect');
  const transparencyAlert = document.getElementById('transparencyAlert');
  const btnSwitchWebp = document.getElementById('btnSwitchWebp');
  const resizeWInput = document.getElementById('resizeWInput');
  const resizeHInput = document.getElementById('resizeHInput');
  const btnLockRatio = document.getElementById('btnLockRatio');
  const scaleButtons = document.querySelectorAll('.scale-btn');
  const filenameInput = document.getElementById('filenameInput');

  // Actions
  const btnDownload = document.getElementById('btnDownload');
  const btnReset = document.getElementById('btnReset');
  const mobileStickyBar = document.getElementById('mobileStickyBar');
  const mobStickySize = document.getElementById('mobStickySize');
  const mobStickyBadge = document.getElementById('mobStickyBadge');
  const btnMobileStickyDownload = document.getElementById('btnMobileStickyDownload');

  // --- 3. Dropzone & File Selection ---
  dropzone?.addEventListener('click', () => filePicker.click());
  btnDropzoneBrowse?.addEventListener('click', (e) => {
    e.stopPropagation();
    filePicker.click();
  });
  btnChangeImage?.addEventListener('click', () => filePicker.click());

  dropzone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone?.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone?.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleSelectedFile(e.dataTransfer.files[0]);
    }
  });

  filePicker?.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleSelectedFile(e.target.files[0]);
    }
  });

  async function handleSelectedFile(file) {
    clearError();
    if (!file.type.startsWith('image/')) {
      showError('Please upload a supported image file (JPG, PNG, or WebP).');
      return;
    }

    try {
      showToast(`Loading ${file.name}...`, 'info');
      state.currentFile = file;

      const info = await imageEngine.loadImage(file);

      // Safe downscale protection for massive photos (> 4K)
      const downscale = imageEngine.downscaleIfExceeds(3840);
      if (downscale) {
        showToast(`Ultra-large photo (${downscale.oldW}×${downscale.oldH}) scaled to ${downscale.newW}×${downscale.newH} for browser memory safety.`, 'info');
      }

      // Switch to Workspace View
      uploadSection.style.display = 'none';
      workspaceSection.style.display = 'flex';
      mobileStickyBar.style.display = 'flex';
      mobileStickyBar.classList.add('active');
      document.body.classList.add('has-mobile-bar');

      // Populate File Metadata Strip
      metaFileName.textContent = info.name;
      metaOriginalSize.textContent = imageEngine.formatBytes(info.size);
      metaDimensions.textContent = `${info.width} × ${info.height} px`;
      metaFormat.textContent = info.type.replace('image/', '').toUpperCase();
      metaRatio.textContent = info.aspectRatio;

      // Setup Resize Inputs
      state.aspectRatioVal = info.width / info.height;
      resizeWInput.value = info.width;
      resizeHInput.value = info.height;

      // Setup Filename & Format
      const rawBase = info.name.replace(/\.[^/.]+$/, '');
      filenameInput.value = `${rawBase}-compressed`;
      formatSelect.value = imageEngine.settings.format;

      // Check transparency
      checkTransparencyAlert();

      // Trigger Initial Real Compression
      executeCompression(true);

      showToast(`Loaded ${info.name}`, 'success');
    } catch (err) {
      showError(err.message);
    }
  }

  // --- 4. Quality Slider & Presets ---
  qualitySlider?.addEventListener('input', () => {
    const q = parseInt(qualitySlider.value, 10);
    qualityNumDisplay.textContent = `${q}%`;

    // Update Status Card
    updateStatusCard(q / 100);

    // Sync Preset Buttons
    presetButtons.forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.getAttribute('data-q'), 10) === q);
    });

    // Schedule debounced compression
    scheduleCompression(false);
  });

  presetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      presetButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const q = parseInt(btn.getAttribute('data-q'), 10);
      qualitySlider.value = q;
      qualityNumDisplay.textContent = `${q}%`;
      updateStatusCard(q / 100);
      scheduleCompression(true);
    });
  });

  function updateStatusCard(quality) {
    const status = imageEngine.getQualityStatus(quality);
    qualityStatusCard.className = `quality-status-card status-${status.level}`;
    statusBadgeText.textContent = status.badge;
    statusDescText.textContent = status.description;
  }

  // --- 5. Real Compression Execution ---
  function scheduleCompression(immediate = false) {
    clearTimeout(state.debounceTimer);
    if (immediate) {
      executeCompression();
    } else {
      state.debounceTimer = setTimeout(() => executeCompression(), 120);
    }
  }

  async function executeCompression() {
    if (!imageEngine.sourceCanvas.width) return;

    try {
      const q = parseInt(qualitySlider.value, 10) / 100;
      const fmt = formatSelect.value;
      const targetW = parseInt(resizeWInput.value, 10) || imageEngine.fileInfo.width;
      const targetH = parseInt(resizeHInput.value, 10) || imageEngine.fileInfo.height;

      const res = await imageEngine.compress(q, fmt, targetW, targetH);

      // Update Summary Metrics
      metricOrigSize.textContent = imageEngine.formatBytes(res.originalSize);
      metricCompSize.textContent = imageEngine.formatBytes(res.compressedSize);

      if (res.isLarger) {
        // Critical Bug 2 Fix: Handle negative savings accurately
        metricSavedBytes.textContent = `+${imageEngine.formatBytes(res.increasedBytes)} (Larger)`;
        metricSavedBytes.className = 'metric-val warning-text';
        metricReductionBadge.textContent = `+${res.increasePct}%`;
        metricReductionBadge.className = 'reduction-badge badge-increase';
        metricCompSize.className = 'metric-val highlight warning-text';

        // Display intelligent warning banner with guidance
        if (sizeIncreaseWarning) {
          warningIncreasePct.textContent = `+${res.increasePct}%`;
          sizeIncreaseWarning.style.display = 'flex';
        }

        // Sync Mobile Sticky Bar with warning state
        mobStickySize.textContent = imageEngine.formatBytes(res.compressedSize);
        mobStickyBadge.textContent = `+${res.increasePct}%`;
        mobStickyBadge.className = 'reduction-badge badge-increase';
      } else {
        metricSavedBytes.textContent = imageEngine.formatBytes(res.savedBytes);
        metricSavedBytes.className = 'metric-val';
        const sign = res.reductionPct > 0 ? '-' : '';
        metricReductionBadge.textContent = `${sign}${res.reductionPct}%`;
        metricReductionBadge.className = 'reduction-badge badge-saved';
        metricCompSize.className = 'metric-val highlight';

        // Hide warning banner
        if (sizeIncreaseWarning) {
          sizeIncreaseWarning.style.display = 'none';
        }

        // Sync Mobile Sticky Bar
        mobStickySize.textContent = imageEngine.formatBytes(res.compressedSize);
        mobStickyBadge.textContent = `${sign}${res.reductionPct}%`;
        mobStickyBadge.className = 'reduction-badge badge-saved';
      }

      // Update Previews
      sideOrigImg.src = imageEngine.originalBlobUrl;
      sideOrigSizeBadge.textContent = imageEngine.formatBytes(res.originalSize);
      sideCompImg.src = res.blobUrl;
      sideCompSizeBadge.textContent = imageEngine.formatBytes(res.compressedSize);

      mobOrigBadge.textContent = imageEngine.formatBytes(res.originalSize);
      mobCompBadge.textContent = imageEngine.formatBytes(res.compressedSize);
      if (state.mobilePreview === 'orig') {
        mobPreviewImg.src = imageEngine.originalBlobUrl;
      } else {
        mobPreviewImg.src = res.blobUrl;
      }

      // Update Split View Canvas if active
      if (state.viewMode === 'split') {
        updateSplitCanvas();
      }

    } catch (err) {
      showError(err.message);
    }
  }

  // --- 6. Quick Fix Actions for Larger Files ---
  btnFixQuality?.addEventListener('click', () => {
    qualitySlider.value = 60;
    qualityNumDisplay.textContent = '60%';
    updateStatusCard(0.6);
    presetButtons.forEach(btn => btn.classList.remove('active'));
    scheduleCompression(true);
    showToast('Quality lowered to 60%', 'info');
  });

  btnFixWebp?.addEventListener('click', () => {
    formatSelect.value = 'image/webp';
    checkTransparencyAlert();
    scheduleCompression(true);
    showToast('Switched to WebP format', 'success');
  });

  btnFixResize?.addEventListener('click', () => {
    scaleButtons.forEach(b => b.classList.remove('active'));
    const btn75 = Array.from(scaleButtons).find(b => b.getAttribute('data-scale') === '0.75');
    if (btn75) btn75.classList.add('active');

    resizeWInput.value = Math.round(imageEngine.fileInfo.width * 0.75);
    resizeHInput.value = Math.round(imageEngine.fileInfo.height * 0.75);
    scheduleCompression(true);
    showToast('Dimensions scaled to 75%', 'info');
  });

  // --- 7. Viewport Modes (Side-by-Side, Split Slider, Mobile Toggle) ---
  tabSideBySide?.addEventListener('click', () => switchViewMode('side'));
  tabSplitSlider?.addEventListener('click', () => switchViewMode('split'));
  tabToggleMobile?.addEventListener('click', () => switchViewMode('toggle'));

  function switchViewMode(mode) {
    state.viewMode = mode;
    [tabSideBySide, tabSplitSlider, tabToggleMobile].forEach(t => t?.classList.remove('active'));

    viewSideBySide.style.display = mode === 'side' ? '' : 'none';
    viewSplitSlider.style.display = mode === 'split' ? '' : 'none';
    viewToggleMobile.style.display = mode === 'toggle' ? '' : 'none';

    if (mode === 'side') tabSideBySide?.classList.add('active');
    if (mode === 'split') {
      tabSplitSlider?.classList.add('active');
      updateSplitCanvas();
    }
    if (mode === 'toggle') tabToggleMobile?.classList.add('active');
  }

  // Split View Slider Dragging Interaction
  function updateSplitCanvas() {
    if (!imageEngine.sourceCanvas.width) return;
    const container = splitCanvasContainer;
    const w = container.clientWidth || 600;
    const h = container.clientHeight || 420;

    splitCanvas.width = w;
    splitCanvas.height = h;

    imageEngine.renderSplitComparison(splitCanvas, state.splitRatio);
  }

  const handleSplitPointer = (clientX) => {
    const rect = splitCanvasContainer.getBoundingClientRect();
    let ratio = (clientX - rect.left) / rect.width;
    ratio = Math.max(0.02, Math.min(0.98, ratio));
    state.splitRatio = ratio;
    imageEngine.renderSplitComparison(splitCanvas, ratio);
  };

  splitCanvasContainer?.addEventListener('pointerdown', (e) => {
    state.isDraggingSplit = true;
    try { splitCanvasContainer.setPointerCapture(e.pointerId); } catch (_) {}
    handleSplitPointer(e.clientX);
  });

  splitCanvasContainer?.addEventListener('pointermove', (e) => {
    if (state.isDraggingSplit || e.buttons === 1) {
      handleSplitPointer(e.clientX);
    }
  });

  splitCanvasContainer?.addEventListener('pointerup', (e) => {
    state.isDraggingSplit = false;
    try { splitCanvasContainer.releasePointerCapture(e.pointerId); } catch (_) {}
  });

  splitCanvasContainer?.addEventListener('pointercancel', () => {
    state.isDraggingSplit = false;
  });

  // Mobile Toggle Switch
  mobBtnOriginal?.addEventListener('click', () => {
    state.mobilePreview = 'orig';
    mobBtnOriginal.classList.add('active');
    mobBtnCompressed.classList.remove('active');
    mobPreviewImg.src = imageEngine.originalBlobUrl;
  });

  mobBtnCompressed?.addEventListener('click', () => {
    state.mobilePreview = 'comp';
    mobBtnCompressed.classList.add('active');
    mobBtnOriginal.classList.remove('active');
    if (imageEngine.compressedBlobUrl) {
      mobPreviewImg.src = imageEngine.compressedBlobUrl;
    }
  });

  // --- 8. Advanced Settings (Format, Transparency, Resize) ---
  formatSelect?.addEventListener('change', () => {
    checkTransparencyAlert();
    scheduleCompression(true);
  });

  function checkTransparencyAlert() {
    if (formatSelect.value === 'image/jpeg' && imageEngine.fileInfo.hasAlpha) {
      transparencyAlert.style.display = 'flex';
    } else {
      transparencyAlert.style.display = 'none';
    }
  }

  btnSwitchWebp?.addEventListener('click', () => {
    formatSelect.value = 'image/webp';
    checkTransparencyAlert();
    scheduleCompression(true);
    showToast('Switched to WebP to preserve transparent background', 'success');
  });

  // Aspect Ratio Lock
  btnLockRatio?.addEventListener('click', () => {
    state.ratioLocked = !state.ratioLocked;
    btnLockRatio.classList.toggle('active', state.ratioLocked);
  });

  resizeWInput?.addEventListener('input', () => {
    const w = parseInt(resizeWInput.value, 10);
    if (state.ratioLocked && state.aspectRatioVal && w > 0) {
      resizeHInput.value = Math.round(w / state.aspectRatioVal);
    }
    resetScaleButtons();
    scheduleCompression(false);
  });

  resizeHInput?.addEventListener('input', () => {
    const h = parseInt(resizeHInput.value, 10);
    if (state.ratioLocked && state.aspectRatioVal && h > 0) {
      resizeWInput.value = Math.round(h * state.aspectRatioVal);
    }
    resetScaleButtons();
    scheduleCompression(false);
  });

  scaleButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      scaleButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const scale = parseFloat(btn.getAttribute('data-scale'));
      resizeWInput.value = Math.round(imageEngine.fileInfo.width * scale);
      resizeHInput.value = Math.round(imageEngine.fileInfo.height * scale);
      scheduleCompression(false);
    });
  });

  function resetScaleButtons() {
    scaleButtons.forEach(b => b.classList.remove('active'));
  }

  // --- 9. Download & Reset Actions ---
  const triggerDownload = () => {
    try {
      const customName = filenameInput.value.trim();
      imageEngine.download(customName);
      showToast('Downloading compressed image...', 'success');
    } catch (e) {
      showError(e.message);
    }
  };

  btnDownload?.addEventListener('click', triggerDownload);
  btnMobileStickyDownload?.addEventListener('click', triggerDownload);

  btnReset?.addEventListener('click', () => {
    resetAll();
  });

  function resetAll() {
    imageEngine.cleanupMemory();
    state.currentFile = null;
    state.viewMode = 'side';
    state.splitRatio = 0.5;

    viewSideBySide.style.display = '';
    viewSplitSlider.style.display = 'none';
    viewToggleMobile.style.display = 'none';
    tabSideBySide?.classList.add('active');
    tabSplitSlider?.classList.remove('active');
    tabToggleMobile?.classList.remove('active');

    filePicker.value = '';
    uploadSection.style.display = '';
    workspaceSection.style.display = 'none';

    if (sizeIncreaseWarning) {
      sizeIncreaseWarning.style.display = 'none';
    }

    mobileStickyBar.style.display = 'none';
    mobileStickyBar.classList.remove('active');
    document.body.classList.remove('has-mobile-bar');

    clearError();
    showToast('Ready for new image', 'info');
  }

  // --- 10. Error Handling & Toasts ---
  closeErrorBtn?.addEventListener('click', clearError);

  function showError(msg) {
    if (errorBanner && errorMessage) {
      errorMessage.textContent = msg;
      errorBanner.style.display = 'flex';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function clearError() {
    if (errorBanner) {
      errorBanner.style.display = 'none';
    }
  }

  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }, 3000);
  }
});
