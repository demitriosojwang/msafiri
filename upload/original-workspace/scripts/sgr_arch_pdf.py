"""
SGR Feeder Platform — Architecture & Data Model Specification
Main orchestrator: builds body PDF via ReportLab, generates cover via Playwright,
merges into final PDF.
"""
import os
import sys
import subprocess

# Import part1 (setup, styles, helpers, page decoration)
sys.path.insert(0, '/home/z/my-project/scripts')
from sgr_arch_pdf_part1 import (
    # Styles + helpers
    H1, H2, H3, P, PL, Muted, Bullets, Code, Callout, Table2, HR,
    Spacer, PageBreak, safe_keep_together, Paragraph, body_style,
    CONTENT_W, ACCENT, HEADER_FILL,
    # Doc setup
    TocDocTemplate, _page_decoration,
    # Layout
    PAGE_W, PAGE_H, LEFT_M, RIGHT_M, TOP_M, BOTTOM_M,
    # Palette
    PAGE_BG, SECTION_BG, CARD_BG, BORDER, TEXT_PRIMARY, TEXT_MUTED, HEADER_FILL as HF,
)
from reportlab.lib.pagesizes import A4
from reportlab.platypus import Spacer, PageBreak, Paragraph
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT

# Import content builders
from sgr_arch_pdf_part2 import build_content_part1
from sgr_arch_pdf_part3 import build_content_part2
from sgr_arch_pdf_part4 import build_content_part3


def build_body_pdf(output_path: str):
    """Build the body PDF (TOC + all chapters). Cover is separate."""
    doc = TocDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=LEFT_M,
        rightMargin=RIGHT_M,
        topMargin=TOP_M,
        bottomMargin=BOTTOM_M,
        title='SGR Feeder Platform — Architecture & Data Model Specification',
        author='SGR Feeder Engineering',
        subject='Production architecture specification',
        creator='Z.ai',
    )

    story = []

    # Pass all helpers to content builders
    helpers = (H1, H2, H3, P, PL, Muted, Bullets, Code, Callout, Table2, HR,
               Spacer, PageBreak, safe_keep_together, Paragraph, body_style,
               CONTENT_W, ACCENT, HEADER_FILL)

    # TOC + Chapters 1-7
    story.extend(build_content_part1(*helpers))
    # Chapters 8-12
    story.extend(build_content_part2(*helpers))
    # Chapters 13 + Appendix A
    story.extend(build_content_part3(*helpers))

    doc.multiBuild(story, onFirstPage=_page_decoration, onLaterPages=_page_decoration)
    print(f'✓ Body PDF built: {output_path}')


def build_cover_pdf(html_path: str, pdf_path: str):
    """Render cover HTML to single-page PDF via html2poster.js."""
    scripts_dir = '/home/z/my-project/skills/pdf/scripts'
    result = subprocess.run([
        'node', f'{scripts_dir}/html2poster.js',
        html_path, '--output', pdf_path,
        '--width', '794px',
    ], capture_output=True, text=True)
    if result.returncode != 0:
        print('STDOUT:', result.stdout)
        print('STDERR:', result.stderr)
        raise RuntimeError(f'Cover render failed: {result.returncode}')
    print(f'✓ Cover PDF built: {pdf_path}')


def merge_cover_and_body(cover_pdf: str, body_pdf: str, output_pdf: str):
    """Merge cover (page 1) + body PDF into single final output."""
    from pypdf import PdfReader, PdfWriter

    A4_W, A4_H = 595.28, 841.89

    def normalize_page_to_a4(page):
        """Set exact A4 mediabox without scaling content (avoids content stream corruption)."""
        from pypdf.generic import RectangleObject
        page.mediabox = RectangleObject([0, 0, A4_W, A4_H])
        page.cropbox = RectangleObject([0, 0, A4_W, A4_H])
        return page

    writer = PdfWriter()
    cover_page = PdfReader(cover_pdf).pages[0]
    writer.add_page(normalize_page_to_a4(cover_page))
    for page in PdfReader(body_pdf).pages:
        writer.add_page(normalize_page_to_a4(page))
    writer.add_metadata({
        '/Title': 'SGR Feeder Platform — Architecture & Data Model Specification',
        '/Author': 'SGR Feeder Engineering',
        '/Creator': 'Z.ai',
        '/Subject': 'Production architecture specification v1.0',
    })
    with open(output_pdf, 'wb') as f:
        writer.write(f)
    print(f'✓ Final merged PDF: {output_pdf}')


if __name__ == '__main__':
    out_dir = '/home/z/my-project/download'
    os.makedirs(out_dir, exist_ok=True)

    body_pdf = '/tmp/sgr_body.pdf'
    cover_html = '/home/z/my-project/scripts/sgr_cover.html'
    cover_pdf = '/tmp/sgr_cover.pdf'
    final_pdf = f'{out_dir}/SGR_Feeder_Architecture_v1.0.pdf'

    print('=== Building body PDF (ReportLab) ===')
    build_body_pdf(body_pdf)

    print('\n=== Building cover PDF (Playwright) ===')
    build_cover_pdf(cover_html, cover_pdf)

    print('\n=== Merging cover + body ===')
    merge_cover_and_body(cover_pdf, body_pdf, final_pdf)

    print('\n=== DONE ===')
    print(f'Final PDF: {final_pdf}')
    size_kb = os.path.getsize(final_pdf) / 1024
    print(f'Size: {size_kb:.1f} KB')
