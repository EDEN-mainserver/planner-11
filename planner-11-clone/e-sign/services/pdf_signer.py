"""원본 PDF에 필드 값을 오버레이해 서명된 PDF를 생성."""
import base64
import io

from PIL import Image
from pypdf import PdfReader, PdfWriter
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.pdfgen import canvas

from services.files import get_file_bytes

# 한글 폰트 (CJK 내장) — 실패 시 Helvetica 폴백 (한글 깨짐 주의)
_CJK_FONTS = ["HeiseiMin-W3", "HYSMyeongJo-Medium", "STSong-Light"]
KOR_FONT = "Helvetica"
for _font_name in _CJK_FONTS:
    try:
        pdfmetrics.registerFont(UnicodeCIDFont(_font_name))
        KOR_FONT = _font_name
        break
    except Exception:
        continue
if KOR_FONT == "Helvetica":
    print("[pdf_signer] 경고: CJK 폰트를 찾지 못했습니다. 한글이 깨질 수 있습니다.")


def _value_for_field(batch: dict, field: dict, field_index: int):
    owner = field.get("owner")
    if owner == "doc":
        return field.get("value")
    try:
        signer_idx = int(owner)
    except (TypeError, ValueError):
        return None
    signers = batch.get("signers", [])
    if signer_idx >= len(signers):
        return None
    signer = signers[signer_idx]
    if signer.get("status") != "signed":
        return None
    for v in signer.get("filled", []):
        if v.get("field_index") == field_index:
            return v.get("value")
    return None


def generate_signed_pdf(batch: dict, doc_idx: int) -> bytes:
    doc_id = batch["doc_ids"][doc_idx]
    fname, file_data = get_file_bytes(doc_id)
    if not fname or not file_data:
        raise FileNotFoundError(doc_id)
    if not fname.lower().endswith(".pdf"):
        raise ValueError("PDF 형식만 지원합니다.")

    scale = float(batch.get("scale") or 1.4)  # px / pt (pdf.js viewport scale)
    fields = batch.get("fields") or []

    # 페이지별 그룹화 (현재 doc만)
    by_page: dict[int, list[tuple[int, dict]]] = {}
    for i, f in enumerate(fields):
        if f.get("docIdx") != doc_idx:
            continue
        by_page.setdefault(int(f.get("pageIdx", 1)), []).append((i, f))

    reader = PdfReader(io.BytesIO(file_data))
    writer = PdfWriter()

    for page_num, page in enumerate(reader.pages, start=1):
        page_w = float(page.mediabox.width)
        page_h = float(page.mediabox.height)
        page_fields = by_page.get(page_num, [])

        if not page_fields:
            writer.add_page(page)
            continue

        packet = io.BytesIO()
        c = canvas.Canvas(packet, pagesize=(page_w, page_h))

        for field_index, f in page_fields:
            value = _value_for_field(batch, f, field_index)
            if value in (None, ""):
                continue

            # px → pt 좌표 변환 (Y축은 PDF 기준 하단부터)
            x_pt = float(f.get("x", 0)) / scale
            y_top_pt = float(f.get("y", 0)) / scale
            w_pt = float(f.get("w", 0)) / scale
            h_pt = float(f.get("h", 0)) / scale
            y_pt = page_h - y_top_pt - h_pt

            tool = f.get("tool")
            try:
                if tool in ("signature", "stamp", "image") and isinstance(value, str) and value.startswith("data:image"):
                    _, b64 = value.split(",", 1)
                    img = Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGBA")
                    c.drawImage(ImageReader(img), x_pt, y_pt,
                                width=w_pt, height=h_pt, mask="auto")
                elif tool == "checkbox":
                    if value in ("checked", True, "true"):
                        c.setFont(KOR_FONT, max(8, min(h_pt - 2, 14)))
                        c.drawString(x_pt + 2, y_pt + 2, "✓")
                else:
                    c.setFont(KOR_FONT, max(8, min(h_pt - 4, 12)))
                    c.drawString(x_pt + 2, y_pt + 4, str(value))
            except Exception as e:
                print(f"[pdf_signer] field {field_index} draw error: {e}")

        c.save()
        packet.seek(0)
        overlay = PdfReader(packet)
        page.merge_page(overlay.pages[0])
        writer.add_page(page)

    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()
