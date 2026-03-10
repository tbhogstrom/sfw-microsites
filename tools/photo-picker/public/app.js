// Photo Picker — browser app

const PRESETS = {
  'hero':         { width: 1440, height: 810 },
  'background':   { width: 1440, height: 810 },
  'gallery':      { width: 800,  height: 600 },
  'before-after': { width: 1000, height: 667 },
  'completed':    { width: 1000, height: 667 },
  'damage':       { width: 800,  height: 600 },
  'process':      { width: 800,  height: 600 },
  'repair':       { width: 800,  height: 600 },
  'team':         { width: 600,  height: 800 },
  'equipment':    { width: 800,  height: 600 },
};

const PRESET_LABELS = {
  'hero':         'Hero — 1440×810',
  'background':   'Background — 1440×810',
  'gallery':      'Gallery — 800×600',
  'before-after': 'Before/After — 1000×667',
  'completed':    'Completed — 1000×667',
  'damage':       'Damage — 800×600',
  'process':      'Process — 800×600',
  'repair':       'Repair — 800×600',
  'team':         'Team — 600×800',
  'equipment':    'Equipment — 800×600',
};

// --- State ---
let photos = [];
let currentIndex = 0;
let photoStatus = {}; // filename -> 'uploaded' | 'skipped' | null
let uploadLog = []; // { filename, category, page, url, microsite }
let sessionGalleryCounts = {}; // microsite -> count of gallery uploads this session
let lastUploadedUrl = null; // used by preview tab

// --- DOM refs ---
const queueList = document.getElementById('queue-list');
const queueCount = document.getElementById('queue-count');
const photoPreview = document.getElementById('photo-preview');
const editorPosition = document.getElementById('editor-position');
const selectMicrosite = document.getElementById('select-microsite');
const selectCategory = document.getElementById('select-category');
const selectPreset = document.getElementById('select-preset');
const inputWidth = document.getElementById('input-width');
const inputHeight = document.getElementById('input-height');
const inputQuality = document.getElementById('input-quality');
const qualityValue = document.getElementById('quality-value');
const uploadResult = document.getElementById('upload-result');
const btnUpload = document.getElementById('btn-upload');
const btnSkip = document.getElementById('btn-skip');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');

// New refs — URL log + gallery
const pageAssignRow = document.getElementById('page-assign-row');
const selectPage = document.getElementById('select-page');
const urlLogList = document.getElementById('url-log-list');
const btnCopyAll = document.getElementById('btn-copy-all');
const galleryGenerateSection = document.getElementById('gallery-generate-section');
const galleryGenerateHint = document.getElementById('gallery-generate-hint');
const btnGenerateGallery = document.getElementById('btn-generate-gallery');
const galleryModal = document.getElementById('gallery-modal');
const gallerySnippetText = document.getElementById('gallery-snippet-text');
const btnModalCopy = document.getElementById('btn-modal-copy');
const btnModalClose = document.getElementById('btn-modal-close');

// New refs — preview tab
const centerTabs = document.querySelectorAll('.center-tab');
const componentPreview = document.getElementById('component-preview');

// --- Helpers ---

function showPageAssign() {
  const cat = selectCategory.value;
  pageAssignRow.style.display = (cat === 'hero' || cat === 'background') ? '' : 'none';
}

function addToLog(entry) {
  uploadLog.push(entry);

  const div = document.createElement('div');
  div.className = 'log-entry';
  div.title = 'Click to copy URL';

  const label = document.createElement('div');
  label.className = 'log-entry-label';
  label.textContent = `${entry.filename} → ${entry.category}${entry.page ? ` (${entry.page})` : ''}`;

  const url = document.createElement('div');
  url.className = 'log-entry-url';
  url.textContent = entry.url;

  div.appendChild(label);
  div.appendChild(url);

  div.addEventListener('click', () => {
    navigator.clipboard.writeText(entry.url);
    div.classList.add('copied');
    url.textContent = 'Copied!';
    setTimeout(() => {
      div.classList.remove('copied');
      url.textContent = entry.url;
    }, 1500);
  });

  urlLogList.appendChild(div);
  urlLogList.scrollTop = urlLogList.scrollHeight;
}

function updateGalleryButton() {
  const microsite = selectMicrosite.value;
  const count = sessionGalleryCounts[microsite] || 0;
  if (count >= 4) {
    galleryGenerateSection.style.display = '';
    galleryGenerateHint.textContent = `${count} gallery images ready for ${microsite}`;
  } else {
    galleryGenerateSection.style.display = 'none';
  }
}

function renderPreview(imageUrl, category, microsite) {
  const micrositeOption = Array.from(selectMicrosite.options).find(o => o.value === microsite);
  const siteName = micrositeOption ? micrositeOption.textContent.split(' — ')[1] : microsite;

  if (category === 'hero' || category === 'background') {
    const label = category === 'background' ? 'Section background' : siteName;
    const sub = category === 'background' ? 'Background image preview' : 'Professional repair services in Portland &amp; Seattle';
    componentPreview.innerHTML = `
      <div class="preview-hero">
        <img src="${imageUrl}" alt="" />
        <div class="preview-hero-overlay">
          <div class="preview-hero-headline">${label}</div>
          <div class="preview-hero-sub">${sub}</div>
        </div>
      </div>`;
    return;
  }

  if (category === 'gallery') {
    const galleryUrls = uploadLog
      .filter(e => e.microsite === microsite && e.category === 'gallery')
      .map(e => e.url)
      .slice(-4);

    while (galleryUrls.length < 4) galleryUrls.push(imageUrl);
    galleryUrls[galleryUrls.length - 1] = imageUrl;

    componentPreview.innerHTML = `
      <div class="preview-gallery">
        ${galleryUrls.map(url => `
          <div class="preview-gallery-card">
            <img src="${url}" alt="" />
            <div class="preview-gallery-card-overlay">
              <div class="preview-gallery-card-title">Service</div>
            </div>
          </div>`).join('')}
      </div>`;
    return;
  }

  componentPreview.innerHTML = `
    <div class="preview-single" style="position:relative">
      <img src="${imageUrl}" alt="" />
      <div class="preview-label">${category}</div>
    </div>`;
}

// --- Init ---
async function init() {
  await loadConfig();
  await loadPhotos();
  bindEvents();
}

async function loadConfig() {
  const res = await fetch('/api/config');
  const config = await res.json();

  config.microsites.forEach(({ key, name }) => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = `${key} — ${name}`;
    selectMicrosite.appendChild(opt);
  });

  config.imageCategories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    selectCategory.appendChild(opt);
  });

  const noneOpt = document.createElement('option');
  noneOpt.value = '';
  noneOpt.textContent = 'No resize';
  selectPreset.appendChild(noneOpt);

  config.imageCategories.forEach(cat => {
    if (PRESETS[cat]) {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = PRESET_LABELS[cat];
      selectPreset.appendChild(opt);
    }
  });
}

async function loadPhotos() {
  const res = await fetch('/api/photos');
  const data = await res.json();
  photos = data.photos;

  queueCount.textContent = `${photos.length} photo${photos.length !== 1 ? 's' : ''}`;

  queueList.innerHTML = '';
  photos.forEach((filename, i) => {
    const item = document.createElement('div');
    item.className = 'queue-item';
    item.dataset.index = i;
    const img = document.createElement('img');
    img.src = `/api/photos/${encodeURIComponent(filename)}`;
    img.alt = filename;
    item.appendChild(img);
    item.addEventListener('click', () => goToPhoto(i));
    queueList.appendChild(item);
  });

  if (photos.length > 0) goToPhoto(0);
}

function goToPhoto(index) {
  currentIndex = index;
  const filename = photos[index];
  photoPreview.src = `/api/photos/${encodeURIComponent(filename)}`;
  photoPreview.alt = filename;
  updateQueueUI();
  editorPosition.textContent = `${index + 1} / ${photos.length}`;
  uploadResult.textContent = '';
  uploadResult.className = '';
}

function updateQueueUI() {
  document.querySelectorAll('.queue-item').forEach((item, i) => {
    const filename = photos[i];
    item.className = 'queue-item';
    if (i === currentIndex) item.classList.add('active');
    if (photoStatus[filename] === 'uploaded') item.classList.add('uploaded');
    if (photoStatus[filename] === 'skipped') item.classList.add('skipped');
    if (i === currentIndex) item.scrollIntoView({ block: 'nearest' });
  });
}

function bindEvents() {
  btnPrev.addEventListener('click', () => {
    if (currentIndex > 0) goToPhoto(currentIndex - 1);
  });

  btnNext.addEventListener('click', () => {
    if (currentIndex < photos.length - 1) goToPhoto(currentIndex + 1);
  });

  btnSkip.addEventListener('click', () => {
    photoStatus[photos[currentIndex]] = 'skipped';
    updateQueueUI();
    if (currentIndex < photos.length - 1) goToPhoto(currentIndex + 1);
  });

  btnUpload.addEventListener('click', handleUpload);

  inputQuality.addEventListener('input', () => {
    qualityValue.textContent = inputQuality.value;
  });

  selectCategory.addEventListener('change', () => {
    showPageAssign();
    const cat = selectCategory.value;
    if (PRESETS[cat]) {
      selectPreset.value = cat;
      inputWidth.value = PRESETS[cat].width;
      inputHeight.value = PRESETS[cat].height;
    } else {
      selectPreset.value = '';
      inputWidth.value = '';
      inputHeight.value = '';
    }

    // Refresh preview if on preview tab
    const activeTab = document.querySelector('.center-tab.active');
    if (activeTab && activeTab.dataset.tab === 'preview' && lastUploadedUrl) {
      renderPreview(lastUploadedUrl, selectCategory.value, selectMicrosite.value);
    }
  });

  selectPreset.addEventListener('change', () => {
    const cat = selectPreset.value;
    if (cat && PRESETS[cat]) {
      inputWidth.value = PRESETS[cat].width;
      inputHeight.value = PRESETS[cat].height;
    } else {
      inputWidth.value = '';
      inputHeight.value = '';
    }
  });

  selectMicrosite.addEventListener('change', () => {
    updateGalleryButton();

    // Refresh preview if on preview tab
    const activeTab = document.querySelector('.center-tab.active');
    if (activeTab && activeTab.dataset.tab === 'preview' && lastUploadedUrl) {
      renderPreview(lastUploadedUrl, selectCategory.value, selectMicrosite.value);
    }
  });

  // Copy all log button
  btnCopyAll.addEventListener('click', () => {
    const text = uploadLog.map(e => `${e.filename}: ${e.url}`).join('\n');
    navigator.clipboard.writeText(text);
    btnCopyAll.textContent = 'Copied!';
    setTimeout(() => { btnCopyAll.textContent = 'Copy all'; }, 1500);
  });

  // Generate gallery button
  btnGenerateGallery.addEventListener('click', async () => {
    const microsite = selectMicrosite.value;
    try {
      const res = await fetch(`/api/gallery-snippet?microsite=${encodeURIComponent(microsite)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      gallerySnippetText.textContent = data.snippet;
      galleryModal.style.display = 'flex';
    } catch (err) {
      alert(`Could not generate snippet: ${err.message}`);
    }
  });

  btnModalClose.addEventListener('click', () => { galleryModal.style.display = 'none'; });
  btnModalCopy.addEventListener('click', () => {
    navigator.clipboard.writeText(gallerySnippetText.textContent);
    btnModalCopy.textContent = 'Copied!';
    setTimeout(() => { btnModalCopy.textContent = 'Copy'; }, 1500);
  });

  // Center panel tabs
  centerTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      centerTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const isPreview = tab.dataset.tab === 'preview';
      photoPreview.classList.toggle('hidden', isPreview);
      componentPreview.classList.toggle('visible', isPreview);
      if (isPreview) {
        const url = lastUploadedUrl || (photos[currentIndex] ? `/api/photos/${encodeURIComponent(photos[currentIndex])}` : null);
        if (url) renderPreview(url, selectCategory.value, selectMicrosite.value);
      }
    });
  });

  // Initialize on load
  showPageAssign();
  updateGalleryButton();
}

async function handleUpload() {
  const microsite = selectMicrosite.value;
  const category = selectCategory.value;
  const filename = photos[currentIndex];
  const quality = parseInt(inputQuality.value, 10);
  const format = document.querySelector('input[name="format"]:checked').value;
  const width = inputWidth.value ? parseInt(inputWidth.value, 10) : null;
  const height = inputHeight.value ? parseInt(inputHeight.value, 10) : null;
  const page = selectPage ? selectPage.value : null;

  if (!microsite) {
    uploadResult.textContent = 'Please select a microsite.';
    uploadResult.className = 'error';
    return;
  }

  btnUpload.disabled = true;
  uploadResult.textContent = 'Processing...';
  uploadResult.className = '';

  try {
    // 1. Fetch the original photo as a blob and convert to base64
    const photoRes = await fetch(`/api/photos/${encodeURIComponent(filename)}`);
    const photoBlob = await photoRes.blob();
    const mimeType = photoBlob.type || 'image/jpeg';
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(photoBlob);
    });

    // 2. Process with Sharp on the server
    const processRes = await fetch('/api/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageData: base64, mimeType, options: { width, height, quality, format } })
    });
    const processed = await processRes.json();
    if (!processRes.ok) throw new Error(processed.error);

    // 3. Upload to blob storage
    uploadResult.textContent = 'Uploading...';
    const uploadRes = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageData: processed.imageData,
        mimeType: processed.mimeType,
        filename,
        microsite,
        category
      })
    });
    const result = await uploadRes.json();
    if (!uploadRes.ok) throw new Error(result.error);

    // 4. Success
    photoStatus[filename] = 'uploaded';
    updateQueueUI();
    uploadResult.textContent = `✓ ${result.url}`;
    uploadResult.className = 'success';

    // Write URL to images.json (skip if "just upload to blob" — page is empty)
    const shouldWriteBack = category === 'gallery' ||
      ((category === 'hero' || category === 'background') && page);
    if (shouldWriteBack) {
      fetch('/api/write-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ microsite, category, page, url: result.url, filename })
      }).catch(err => console.warn('write-images failed:', err));
    }

    // Update URL log
    lastUploadedUrl = result.url;
    addToLog({ filename, category, page: category === 'hero' ? page : null, url: result.url, microsite });

    // Track gallery count
    if (category !== 'hero' && category !== 'background') {
      sessionGalleryCounts[microsite] = (sessionGalleryCounts[microsite] || 0) + 1;
      updateGalleryButton();
    }

    // Refresh preview if preview tab is active
    const activeTab = document.querySelector('.center-tab.active');
    if (activeTab && activeTab.dataset.tab === 'preview') {
      renderPreview(result.url, category, microsite);
    }

    setTimeout(() => {
      if (currentIndex < photos.length - 1) goToPhoto(currentIndex + 1);
    }, 800);

  } catch (err) {
    uploadResult.textContent = `✗ ${err.message}`;
    uploadResult.className = 'error';
  } finally {
    btnUpload.disabled = false;
  }
}

init();
