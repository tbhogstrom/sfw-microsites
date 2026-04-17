"""Build labeled 3x3 contact-sheet grids from raw image bytes for vision triage."""
from __future__ import annotations

import base64
import io

from PIL import Image, ImageDraw, ImageFont

GRID_BG = (40, 40, 40)
LABEL_BG = (0, 0, 0, 180)
LABEL_FG = (255, 255, 255)


def _load_font(size: int = 22) -> ImageFont.ImageFont:
    try:
        return ImageFont.truetype("arial.ttf", size)
    except OSError:
        return ImageFont.load_default()


def build_labeled_grid(cells_bytes: list[bytes], cell_size: int = 256) -> Image.Image:
    """Compose up to 9 image bytes into a 3x3 grid with cell numbers 1-9 overlaid.

    Unreadable bytes are silently skipped (cell remains background).
    Inputs beyond the 9th are ignored. Empty input raises ValueError.
    """
    if not cells_bytes:
        raise ValueError("build_labeled_grid requires at least one cell")

    grid_px = cell_size * 3
    grid = Image.new("RGB", (grid_px, grid_px), GRID_BG)
    font = _load_font(max(16, cell_size // 12))

    for idx, raw in enumerate(cells_bytes[:9]):
        row, col = divmod(idx, 3)
        x, y = col * cell_size, row * cell_size
        try:
            with Image.open(io.BytesIO(raw)) as img:
                img = img.convert("RGB")
                img.thumbnail((cell_size, cell_size))
                ox = x + (cell_size - img.width) // 2
                oy = y + (cell_size - img.height) // 2
                grid.paste(img, (ox, oy))
        except Exception:
            pass

        label = str(idx + 1)
        draw = ImageDraw.Draw(grid, "RGBA")
        pad = 4
        bbox = draw.textbbox((0, 0), label, font=font)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        draw.rectangle(
            [x + pad, y + pad, x + pad + tw + pad * 2, y + pad + th + pad * 2],
            fill=LABEL_BG,
        )
        draw.text((x + pad * 2, y + pad * 2), label, fill=LABEL_FG, font=font)

    return grid


def encode_grid_jpeg_b64(grid: Image.Image, quality: int = 85) -> str:
    """Return a base64-encoded JPEG of the grid, suitable for the Anthropic vision API."""
    buf = io.BytesIO()
    grid.save(buf, format="JPEG", quality=quality)
    return base64.b64encode(buf.getvalue()).decode()
