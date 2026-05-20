'use client';
import React, { useState } from 'react';
import type { ImageRef } from '@/lib/types';

const MAX_BYTES = 25 * 1024 * 1024;

type Props = {
  projectId: string;
  onUploaded: (img: ImageRef) => void;
};

export function ImageDrop({ projectId, onUploaded }: Props) {
  const [hover, setHover] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function handleFiles(files: FileList | null) {
    setError(null);
    const file = files?.[0];
    if (!file) return;
    if (!/^image\/(jpeg|png)$/.test(file.type)) {
      setError('Pick a JPG or PNG.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('Image is too large (25 MB max).');
      return;
    }

    setBusy(true);

    const reader = new FileReader();
    reader.onload = () => {
      const probe = new Image();
      probe.onload = async () => {
        try {
          const buf = await file.arrayBuffer();
          const res = await fetch(`/api/projects/${projectId}/image`, {
            method: 'PUT',
            headers: {
              'content-type': file.type,
              'x-image-width': String(probe.naturalWidth),
              'x-image-height': String(probe.naturalHeight),
            },
            body: buf,
          });
          if (!res.ok) {
            setError(`Upload failed (${res.status}). Check your blob token.`);
            setBusy(false);
            return;
          }
          const { image } = (await res.json()) as { image: ImageRef };
          onUploaded(image);
        } catch {
          setError('Upload failed. Check your network and blob token.');
          setBusy(false);
        }
      };
      probe.onerror = () => {
        setError('Could not read that image.');
        setBusy(false);
      };
      probe.src = String(reader.result);
    };
    reader.onerror = () => {
      setError('Could not read that file.');
      setBusy(false);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="grid h-full place-items-center p-10">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setHover(true);
        }}
        onDragLeave={() => setHover(false)}
        onDrop={(e) => {
          e.preventDefault();
          setHover(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`flex h-72 w-full max-w-xl cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed text-center transition ${
          hover ? 'border-[var(--accent)] bg-blue-50' : 'border-slate-300 bg-white'
        } ${busy ? 'pointer-events-none opacity-60' : ''}`}
      >
        <div className="text-lg font-medium">
          {busy ? 'Uploading…' : 'Drop a drawing image here'}
        </div>
        <div className="mt-1 text-sm text-slate-500">or click to pick a JPG or PNG</div>
        <input
          type="file"
          accept="image/png,image/jpeg"
          className="hidden"
          onChange={(e) => handleFiles(e.currentTarget.files)}
        />
        {error && <div className="mt-4 text-sm text-red-600">{error}</div>}
      </label>
    </div>
  );
}
