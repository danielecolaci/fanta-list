from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / '.local-tools/pdf'))
import pymupdf

source = sys.argv[1] if len(sys.argv) > 1 else 'public/data/lista.pdf'
with pymupdf.open(source) as document:
    for index, page in enumerate(document, 1):
        pix = page.get_pixmap(matrix=pymupdf.Matrix(2, 2), colorspace=pymupdf.csGRAY,
                             clip=pymupdf.Rect(580, 0, 1100, page.rect.height), alpha=False)
        samples = bytes(255 if value > 170 else 0 for value in pix.samples)
        clean = pymupdf.Pixmap(pymupdf.csGRAY, pix.width, pix.height, samples, False)
        clean.save(f'.local-tools/listone-audit/page-{index:02d}-roles.png')
