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

  // Create 2-column grid
  const grid = document.createElement('div');
  grid.className = 'gallery-grid';

  // Collect all images with cluster/subtopic info
  const allCards = [];

  data.clusters.forEach(cluster => {
    const imagesBySubtopic = {};
    if (cluster.images) {
      cluster.images.forEach(img => {
        const subtopic = img.description || 'General';
        if (!imagesBySubtopic[subtopic]) imagesBySubtopic[subtopic] = [];
        imagesBySubtopic[subtopic].push(img);
      });
    }

    // Add images first
    Object.entries(imagesBySubtopic).forEach(([subtopic, images]) => {
      images.forEach(img => {
        allCards.push({
          type: 'image',
          cluster: cluster.title,
          clusterSlug: cluster.clusterSlug,
          subtopic: subtopic,
          image: img,
          microsite: microsite
        });
      });
    });

    // Add empty slots (4 per subtopic)
    // If no images exist, create default 'General' subtopic with 4 empty slots
    const subtopics = Object.keys(imagesBySubtopic).length > 0
      ? Object.keys(imagesBySubtopic)
      : ['General'];

    subtopics.forEach(subtopic => {
      const images = imagesBySubtopic[subtopic] || [];
      const slotsNeeded = Math.max(4 - images.length, 0);
      for (let i = 0; i < slotsNeeded; i++) {
        allCards.push({
          type: 'empty',
          cluster: cluster.title,
          clusterSlug: cluster.clusterSlug,
          subtopic: subtopic,
          microsite: microsite
        });
      }
    });
  });

  // Render all cards in grid
  allCards.forEach(cardData => {
    if (cardData.type === 'image') {
      const card = document.createElement('div');
      card.className = 'image-card';
      card.innerHTML = `
        <div class="image-card-labels">
          <div class="image-card-cluster">${cardData.cluster}</div>
          <div class="image-card-subtopic">${cardData.subtopic}</div>
        </div>
        <div class="image-card-image">
          <img src="${cardData.image.url}" alt="" />
          <button class="image-remove">×</button>
        </div>
      `;
      grid.appendChild(card);
    } else if (cardData.type === 'empty') {
      const slot = document.createElement('div');
      slot.className = 'empty-slot';
      slot.dataset.clusterSlug = cardData.clusterSlug;
      slot.dataset.subtopic = cardData.subtopic;
      slot.dataset.microsite = cardData.microsite;
      slot.innerHTML = `
        <div class="empty-slot-icon">⬇</div>
        <div class="empty-slot-text">
          <strong>${cardData.cluster}</strong><br/>
          ${cardData.subtopic}
        </div>
      `;
      grid.appendChild(slot);
    }
  });

  body.appendChild(grid);
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

    if (!assignRes.ok) {
      const errData = await assignRes.json().catch(() => ({}));
      throw new Error(`Assignment failed: ${errData.error || assignRes.statusText}`);
    }

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
