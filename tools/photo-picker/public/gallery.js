// public/gallery.js

async function init() {
  let config;
  try {
    const configRes = await fetch('/api/config');
    if (!configRes.ok) throw new Error(`Server error: ${configRes.status}`);
    config = await configRes.json();
  } catch (err) {
    document.getElementById('loading').textContent = `Failed to load: ${err.message}`;
    return;
  }

  const picker = document.getElementById('site-picker');
  config.microsites.forEach(({ key }) => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = key;
    picker.appendChild(opt);
  });

  const params = new URLSearchParams(location.search);
  const siteParam = params.get('site');
  if (siteParam && config.microsites.some(m => m.key === siteParam)) {
    picker.value = siteParam;
  }

  picker.addEventListener('change', () => loadGallery(picker.value));
  loadGallery(picker.value);
}

async function loadGallery(microsite) {
  const body = document.getElementById('gallery-body');
  const loading = document.getElementById('loading');
  loading.style.display = 'block';
  body.innerHTML = '';

  let data;
  try {
    const res = await fetch(`/api/gallery/${microsite}`);
    if (!res.ok) throw new Error(`Server error: ${res.status}`);
    data = await res.json();
  } catch (err) {
    loading.textContent = `Failed to load: ${err.message}`;
    return;
  }

  loading.style.display = 'none';

  // Build expandable tree
  data.clusters.forEach(cluster => {
    const clusterDiv = document.createElement('div');
    clusterDiv.className = 'cluster-section';

    const imageCount = (cluster.images || []).length;
    const clusterHeader = document.createElement('div');
    clusterHeader.className = 'cluster-header';
    clusterHeader.style.cursor = 'pointer';

    const toggle = document.createElement('span');
    toggle.className = 'cluster-toggle';
    toggle.textContent = '▼';
    toggle.style.marginRight = '8px';

    const title = document.createElement('span');
    title.className = 'cluster-title';
    title.textContent = cluster.title;

    const meta = document.createElement('span');
    meta.className = 'cluster-meta';
    meta.textContent = `${imageCount} image${imageCount !== 1 ? 's' : ''}`;

    clusterHeader.appendChild(toggle);
    clusterHeader.appendChild(title);
    clusterHeader.appendChild(meta);

    const clusterContent = document.createElement('div');
    clusterContent.className = 'cluster-content';

    // Group images by subtopic (description field)
    const imagesBySubtopic = {};
    if (cluster.images) {
      cluster.images.forEach(img => {
        const subtopic = img.description || 'Images';
        if (!imagesBySubtopic[subtopic]) imagesBySubtopic[subtopic] = [];
        imagesBySubtopic[subtopic].push(img);
      });
    }

    if (Object.keys(imagesBySubtopic).length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.style.padding = '16px';
      emptyMsg.style.color = '#888';
      emptyMsg.textContent = 'No images. Drag photos here to add them.';
      clusterContent.appendChild(emptyMsg);
    } else {
      Object.entries(imagesBySubtopic).forEach(([subtopic, images]) => {
        const subtopicDiv = document.createElement('div');
        subtopicDiv.className = 'subtopic-section';

        const label = document.createElement('div');
        label.className = 'subtopic-label';
        label.textContent = subtopic;

        const grid = document.createElement('div');
        grid.className = 'image-grid';

        images.forEach(img => {
          const card = document.createElement('div');
          card.className = 'image-card';
          card.innerHTML = `<img src="${img.url}" alt="" class="image-thumb" /><button class="image-remove">×</button>`;
          grid.appendChild(card);
        });

        // Add empty slots for drag-drop
        const slotsNeeded = Math.max(4 - images.length, 0);
        for (let i = 0; i < slotsNeeded; i++) {
          const slot = document.createElement('div');
          slot.className = 'empty-slot';
          slot.dataset.clusterSlug = cluster.clusterSlug;
          slot.dataset.subtopic = subtopic;
          slot.dataset.microsite = microsite;
          slot.innerHTML = '<div class="empty-slot-content"><div class="empty-slot-icon">+</div><div class="empty-slot-text">Drop</div></div>';
          grid.appendChild(slot);
        }

        subtopicDiv.appendChild(label);
        subtopicDiv.appendChild(grid);
        clusterContent.appendChild(subtopicDiv);
      });
    }

    clusterHeader.addEventListener('click', () => {
      const visible = clusterContent.style.display !== 'none';
      clusterContent.style.display = visible ? 'none' : 'block';
      toggle.textContent = visible ? '▶' : '▼';
    });

    clusterDiv.appendChild(clusterHeader);
    clusterDiv.appendChild(clusterContent);
    body.appendChild(clusterDiv);
  });

  setupDragDrop(microsite);
}

function setupDragDrop(microsite) {
  const slots = document.querySelectorAll('.empty-slot');

  slots.forEach(slot => {
    ['dragover', 'dragenter'].forEach(eventName => {
      slot.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        slot.classList.add('drag-over');
      });
    });

    slot.addEventListener('dragleave', (e) => {
      e.preventDefault();
      slot.classList.remove('drag-over');
    });

    slot.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      slot.classList.remove('drag-over');
      handlePhotoDrop(e, slot, microsite);
    });
  });
}

async function handlePhotoDrop(event, slot, microsite) {
  const files = event.dataTransfer.files;
  if (files.length === 0) return;

  const file = files[0];
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
    alert('Please drop an image file');
    return;
  }

  slot.innerHTML = '<div style="padding: 8px; text-align: center; color: #888;">Uploading...</div>';

  try {
    const base64 = await fileToBase64(file);
    const clusterSlug = slot.dataset.clusterSlug;
    const subtopic = slot.dataset.subtopic;

    // Upload
    const uploadRes = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageData: base64,
        mimeType: file.type || 'image/jpeg',
        filename: file.name,
        microsite: microsite,
        category: 'service-page'
      })
    });

    if (!uploadRes.ok) throw new Error('Upload failed');
    const { url } = await uploadRes.json();

    // Assign
    const assignRes = await fetch('/api/update-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        microsite: microsite,
        imageUrl: url,
        clusterSlug: clusterSlug,
        subtopic: subtopic,
        title: titleFromSlug(clusterSlug)
      })
    });

    if (!assignRes.ok) throw new Error('Assignment failed');

    // Show image
    const card = document.createElement('div');
    card.className = 'image-card';
    card.innerHTML = `<img src="${url}" alt="" class="image-thumb" /><button class="image-remove">×</button>`;
    slot.replaceWith(card);

  } catch (err) {
    alert('Error: ' + err.message);
    // Reload to reset
    setTimeout(() => loadGallery(microsite), 1500);
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function titleFromSlug(slug) {
  return slug.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
}

init();
