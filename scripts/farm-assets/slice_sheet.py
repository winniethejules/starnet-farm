#!/usr/bin/env python3
"""farm fork: cut a generated icon sheet (an even cols x rows grid) into one raw image per icon.

  python slice_sheet.py sheet.png out_dir cols rows name1 name2 ...

Writes out_dir/<name>.png for each cell, in reading order; pixelize.py then turns each into a sprite."""
import sys
from PIL import Image

src, out, cols, rows, *names = sys.argv[1:]
cols, rows = int(cols), int(rows)
im = Image.open(src).convert('RGB')
cw, ch = im.width / cols, im.height / rows
for i, name in enumerate(names[:cols * rows]):
    c, r = i % cols, i // cols
    cell = im.crop((round(c * cw), round(r * ch), round((c + 1) * cw), round((r + 1) * ch)))
    cell.save(f'{out}/{name}.png')
    print(name, cell.size)
