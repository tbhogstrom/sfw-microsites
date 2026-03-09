// Photo Picker — browser app
// Tui Image Editor is loaded globally as `tui.ImageEditor` via CDN script tag

const PRESETS = {
  'hero':         { width: 1440, height: 810 },
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
let editor = null;

// --- DOM refs ---
const queueList = document.getElementById('queue-list');
const queueCount = document.getElementById('queue-count');
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

// --- Init ---
async function init() {
  await loadConfig();
  await loadPhotos();
  initEditor();
  bindEvents();
}

async function loadConfig() {
  // Microsites and categories come from the server via a config endpoint
  const res = await fetch('/api/config');
  const config = await res.json();

  // Populate microsite dropdown
  config.microsites.forEach(({ key, name }) => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = `${key} — ${name}`;
    selectMicrosite.appendChild(opt);
  });

  // Populate category dropdown
  config.imageCategories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    selectCategory.appendChild(opt);
  });

  // Populate preset dropdown (one per category + manual option)
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

  // Build queue thumbnails
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

function initEditor() {
  editor = new tui.ImageEditor(document.getElementById('tui-editor'), {
    includeUI: {
      menu: ['crop', 'rotate', 'flip', 'filter'],
      initMenu: 'filter',
      uiSize: { width: '100%', height: '100%' },
      theme: {},
    },
    cssMaxWidth: document.getElementById('editor-panel').clientWidth,
    cssMaxHeight: document.getElementById('editor-panel').clientHeight - 50,
    usageStatistics: false,
  });
}

async function goToPhoto(index) {
  currentIndex = index;
  const filename = photos[index];

  // Load photo into Tui editor
  const imageUrl = `/api/photos/${encodeURIComponent(filename)}`;
  await editor.loadImageFromURL(imageUrl, filename);
  editor.clearUndoStack();

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

    // Scroll active item into view
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

  // Quality slider label
  inputQuality.addEventListener('input', () => {
    qualityValue.textContent = inputQuality.value;
  });

  // Category change -> auto-fill preset and dimensions
  selectCategory.addEventListener('change', () => {
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
  });

  // Preset change -> fill dimensions
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
}

async function handleUpload() {
  const microsite = selectMicrosite.value;
  const category = selectCategory.value;
  const filename = photos[currentIndex];
  const quality = parseInt(inputQuality.value, 10);
  const format = document.querySelector('input[name="format"]:checked').value;
  const width = inputWidth.value ? parseInt(inputWidth.value, 10) : null;
  const height = inputHeight.value ? parseInt(inputHeight.value, 10) : null;

  if (!microsite) {
    uploadResult.textContent = 'Please select a microsite.';
    uploadResult.className = 'error';
    return;
  }

  btnUpload.disabled = true;
  uploadResult.textContent = 'Processing...';
  uploadResult.className = '';

  try {
    // 1. Get current editor canvas as base64
    const dataURL = editor.toDataURL();
    const [header, base64] = dataURL.split(',');
    const mimeType = header.match(/:(.*?);/)[1];

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

    // Auto-advance
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
