#!/usr/bin/env python3
"""farm fork: turn a generated, upscaled pixel-art image into a true-resolution sprite.

Image models draw pixel art as big soft blocks (an art pixel is ~8-16 screen pixels, edges slightly blurred),
on a flat magenta key. This finds the block size and phase, samples the middle of every block, keys out the
magenta, snaps to a small palette and crops to the art, so the result is a real 1:1 sprite the renderer can
draw at any integer zoom.

  python pixelize.py in.png out.png [--width 84 | --cell 12.4] [--colors 24] [--preview 6]
"""
import argparse
import numpy as np
from PIL import Image

KEY = np.array([255, 0, 255], dtype=np.float32)


BG = None   # the raw image's own flat background, read off its border (the model does not always use magenta)


def is_key(rgb):
    # magenta and its blurred fringe: strong red + blue, weak green
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    k = (r > 150) & (b > 150) & (g < 110) & (np.abs(r - b) < 90)
    if BG is not None:
        k |= np.abs(rgb - BG).sum(axis=-1) < 45
    return k


def border_background(img):
    edge = np.concatenate([img[:4].reshape(-1, 3), img[-4:].reshape(-1, 3), img[:, :4].reshape(-1, 3), img[:, -4:].reshape(-1, 3)])
    ref = np.median(edge, axis=0)
    share = (np.abs(edge - ref).sum(axis=1) < 45).mean()
    return ref if share > 0.85 else None


def change_positions(arr, axis):
    d = np.abs(np.diff(arr.astype(np.int32), axis=axis)).sum(axis=2)
    return d > 60


def estimate_cell(edges_1d_profile, lo=4.0, hi=40.0):
    """edges_1d_profile[i] = how many edges sit between pixel i and i+1 along this axis."""
    """F-score of a candidate grid: RECALL = share of edge mass sitting on a grid line, PRECISION = share of
    grid lines that actually carry an edge. Too small a cell has lines with nothing on them; too large a
    cell (a multiple) misses edges in between. The true cell maximises both."""
    prof = np.asarray(edges_1d_profile, dtype=np.float64)
    n = len(prof); total = prof.sum() + 1e-9
    strong = prof > max(1.0, prof.max() * 0.04)
    best = (-1, None, None)
    for cell in np.arange(lo, hi, 0.05):
        for phase in np.arange(0, cell, max(0.25, cell / 16)):
            lines = np.arange(phase, n, cell)
            idx = np.clip(np.round(lines - 0.5).astype(int), 0, n - 1)
            win = np.stack([np.clip(idx + d, 0, n - 1) for d in (-1, 0, 1)])
            recall = prof[np.unique(win)].sum() / total
            precision = strong[win].any(axis=0).mean()
            f = 2 * recall * precision / (recall + precision + 1e-9)
            if f > best[0]:
                best = (f, cell, phase)
    return best[1], best[2]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src'); ap.add_argument('dst')
    ap.add_argument('--cell', type=float, default=None)
    ap.add_argument('--width', type=int, default=None, help='target sprite width in world px (overrides grid detection)')
    ap.add_argument('--colors', type=int, default=24)
    ap.add_argument('--preview', type=int, default=0)
    a = ap.parse_args()

    img = np.asarray(Image.open(a.src).convert('RGB')).astype(np.float32)
    global BG
    BG = border_background(img)
    if a.width:
        # crop to the art (everything that is not key), then size the cell from the target width
        nk = ~is_key(img)
        ys, xs = np.where(nk)
        img = img[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        a.cell = img.shape[1] / a.width
    H, W, _ = img.shape
    ex = change_positions(img, 1).sum(axis=0).astype(np.float64)     # edges between columns
    ey = change_positions(img, 0).sum(axis=1).astype(np.float64)     # edges between rows
    if a.width:
        cx = cy = a.cell; px_ = py_ = 0.0
    elif a.cell:
        cx, px_ = a.cell, estimate_cell_phase(ex, a.cell)
        cy, py_ = a.cell, estimate_cell_phase(ey, a.cell)
    else:
        cx, px_ = estimate_cell(ex)
        cy, py_ = estimate_cell(ey)
        c = (cx + cy) / 2                                               # pixels are square
        cx = cy = c
        px_ = estimate_cell_phase(ex, c); py_ = estimate_cell_phase(ey, c)

    cols = int(round((W - px_) / cx)); rows = int(round((H - py_) / cy))
    out = np.zeros((rows, cols, 4), dtype=np.uint8)
    key = is_key(img)
    for j in range(rows):
        y0 = py_ + j * cy; ys = slice(int(y0 + cy * 0.3), max(int(y0 + cy * 0.3) + 1, int(y0 + cy * 0.7)))
        for i in range(cols):
            x0 = px_ + i * cx; xs = slice(int(x0 + cx * 0.3), max(int(x0 + cx * 0.3) + 1, int(x0 + cx * 0.7)))
            block = img[ys, xs].reshape(-1, 3); kb = key[ys, xs].reshape(-1)
            if kb.mean() > 0.5:
                continue
            block = block[~kb] if (~kb).any() else block
            out[j, i, :3] = np.median(block, axis=0)
            out[j, i, 3] = 255

    # the model sometimes ignores the magenta key and paints a flat colour instead: if most of the border is one
    # colour, flood it away from the edges (only where it touches the edge, so the same colour inside survives)
    border = np.concatenate([out[0], out[-1], out[:, 0], out[:, -1]])
    opaque = border[border[:, 3] > 0][:, :3].astype(np.int32)
    if len(opaque) > 0.6 * len(border):
        ref = np.median(opaque, axis=0)
        close = (np.abs(out[..., :3].astype(np.int32) - ref).sum(axis=2) < 60) & (out[..., 3] > 0)
        if close[[0, -1], :].mean() > 0.6 or close[:, [0, -1]].mean() > 0.6:
            seen = np.zeros(close.shape, bool)
            stack = [(y, x) for y in range(rows) for x in (0, cols - 1)] + [(y, x) for x in range(cols) for y in (0, rows - 1)]
            while stack:
                y, x = stack.pop()
                if y < 0 or x < 0 or y >= rows or x >= cols or seen[y, x] or not close[y, x]:
                    continue
                seen[y, x] = True; out[y, x, 3] = 0
                stack += [(y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)]
    sprite = Image.fromarray(out, 'RGBA')
    alpha = sprite.getchannel('A')
    bbox = alpha.getbbox()
    if bbox:
        sprite = sprite.crop(bbox); alpha = sprite.getchannel('A')
    # snap to a small palette (opaque pixels only), then restore the hard alpha
    rgb = sprite.convert('RGB').quantize(colors=a.colors, method=Image.Quantize.MEDIANCUT).convert('RGB')
    sprite = rgb.convert('RGBA'); sprite.putalpha(alpha)
    sprite.save(a.dst)
    print(f'cell={cx:.2f} phase=({px_:.2f},{py_:.2f}) -> {sprite.size[0]}x{sprite.size[1]}  {a.dst}')
    if a.preview:
        p = a.dst.replace('.png', '.preview.png')
        sprite.resize((sprite.size[0] * a.preview, sprite.size[1] * a.preview), Image.NEAREST).save(p)


def estimate_cell_phase(profile, cell):
    pos = np.arange(len(profile)) + 0.5
    best = (-1, 0)
    for phase in np.arange(0, cell, 0.1):
        k = (pos - phase) / cell
        near = np.abs(k - np.round(k)) * cell < 1.0
        s = profile[near].sum()
        if s > best[0]:
            best = (s, phase)
    return best[1]


if __name__ == '__main__':
    main()
