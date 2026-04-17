"""Tests for the labeled grid builder."""
import io
from PIL import Image
import pytest

from photo_scanner.grid_builder import build_labeled_grid, encode_grid_jpeg_b64


def _solid_image_bytes(color: tuple[int, int, int], size: int = 100) -> bytes:
    img = Image.new("RGB", (size, size), color)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return buf.getvalue()


def test_build_grid_full_3x3():
    cells = [_solid_image_bytes((i * 25, 100, 100)) for i in range(9)]
    grid = build_labeled_grid(cells, cell_size=128)
    assert grid.size == (128 * 3, 128 * 3)


def test_build_grid_partial_last_row():
    cells = [_solid_image_bytes((255, 0, 0)) for _ in range(5)]
    grid = build_labeled_grid(cells, cell_size=128)
    assert grid.size == (128 * 3, 128 * 3)


def test_build_grid_skips_unreadable_bytes():
    cells = [_solid_image_bytes((0, 255, 0)), b"not-an-image", _solid_image_bytes((0, 0, 255))]
    grid = build_labeled_grid(cells, cell_size=128)
    assert grid.size == (128 * 3, 128 * 3)


def test_encode_grid_jpeg_b64_returns_string():
    grid = Image.new("RGB", (256, 256), (10, 10, 10))
    encoded = encode_grid_jpeg_b64(grid)
    assert isinstance(encoded, str)
    assert len(encoded) > 100


def test_build_grid_raises_on_empty_input():
    with pytest.raises(ValueError):
        build_labeled_grid([], cell_size=128)


def test_build_grid_truncates_over_9_cells():
    cells = [_solid_image_bytes((i * 20, 0, 0)) for i in range(15)]
    grid = build_labeled_grid(cells, cell_size=128)
    assert grid.size == (128 * 3, 128 * 3)
