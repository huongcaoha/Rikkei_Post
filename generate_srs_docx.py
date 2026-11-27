# -*- coding: utf-8 -*-
"""
Script sinh tài liệu Đặc tả Yêu cầu Phần mềm (SRS) chuyên nghiệp cho dự án Rikkei Post.
Tạo ra file Tai_Lieu_Dac_Ta_SRS.docx chuẩn nhận diện Rikkei Education / Doanh nghiệp Logistics.
Phiên bản 3.5.0 Enterprise Comprehensive Release
Tác giả: Nguyễn Công Hưởng
"""

import os
import re
import sys
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

def set_cell_background(cell, fill_hex):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    tcPr.append(shd)

def set_cell_margins(cell, top=120, bottom=120, left=160, right=160):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for margin, val in [('top', top), ('bottom', bottom), ('left', left), ('right', right)]:
        node = OxmlElement(f'w:{margin}')
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')
        tcMar.append(node)
    tcPr.append(tcMar)

def set_table_borders(table, color="D3D3D3", sz="4", val="single"):
    tblPr = table._tbl.tblPr
    borders = parse_xml(f'''
        <w:tblBorders {nsdecls("w")}>
            <w:top w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>
            <w:bottom w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>
            <w:left w:val="none"/>
            <w:right w:val="none"/>
            <w:insideH w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>
            <w:insideV w:val="none"/>
        </w:tblBorders>
    ''')
    tblPr.append(borders)

def set_callout_borders(table, border_color="1F4E78"):
    tblPr = table._tbl.tblPr
    borders = parse_xml(f'''
        <w:tblBorders {nsdecls("w")}>
            <w:top w:val="none"/>
            <w:bottom w:val="none"/>
            <w:left w:val="single" w:sz="24" w:space="0" w:color="{border_color}"/>
            <w:right w:val="none"/>
            <w:insideH w:val="none"/>
            <w:insideV w:val="none"/>
        </w:tblBorders>
    ''')
    tblPr.append(borders)

def add_styled_inline(paragraph, text):
    pattern = re.compile(r'(\*\*.*?\*\*|`.*?`|\*.*?\*)')
    parts = pattern.split(text)
    for part in parts:
        if not part:
            continue
        if part.startswith('**') and part.endswith('**') and len(part) >= 4:
            run = paragraph.add_run(part[2:-2])
            run.bold = True
            run.font.name = 'Calibri'
            run.font.color.rgb = RGBColor(0x26, 0x26, 0x26)
        elif part.startswith('`') and part.endswith('`') and len(part) >= 2:
            run = paragraph.add_run(part[1:-1])
            run.font.name = 'Consolas'
            run.font.size = Pt(9.5)
            run.font.color.rgb = RGBColor(0xC7, 0x25, 0x4E)
            run.bold = True
        elif part.startswith('*') and part.endswith('*') and len(part) >= 2 and not part.startswith('**'):
            run = paragraph.add_run(part[1:-1])
            run.italic = True
            run.font.name = 'Calibri'
            run.font.color.rgb = RGBColor(0x40, 0x40, 0x40)
        else:
            run = paragraph.add_run(part)
            run.font.name = 'Calibri'
            run.font.color.rgb = RGBColor(0x26, 0x26, 0x26)

def add_h1(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(18)
    p.paragraph_format.space_after = Pt(6)
    p.paragraph_format.keep_with_next = True
    run = p.add_run(text)
    run.font.name = 'Calibri'
    run.font.size = Pt(15)
    run.font.bold = True
    run.font.color.rgb = RGBColor(0x1F, 0x4E, 0x78) # Navy Blue
    return p

def add_h2(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(13)
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.keep_with_next = True
    run = p.add_run(text)
    run.font.name = 'Calibri'
    run.font.size = Pt(13)
    run.font.bold = True
    run.font.color.rgb = RGBColor(0x2E, 0x75, 0xB6) # Steel Blue
    return p

def add_h3(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(9)
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.keep_with_next = True
    run = p.add_run(text)
    run.font.name = 'Calibri'
    run.font.size = Pt(11.5)
    run.font.bold = True
    run.font.color.rgb = RGBColor(0x1F, 0x4E, 0x78)
    return p

def add_para(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.line_spacing = 1.15
    add_styled_inline(p, text)
    return p

def add_bullet(doc, text, level=0):
    p = doc.add_paragraph(style='List Bullet')
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.line_spacing = 1.15
    p.paragraph_format.left_indent = Inches(0.25 * (level + 1))
    add_styled_inline(p, text)
    return p

def add_callout(doc, title, text, kind="INFO"):
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    
    color_map = {
        "INFO": ("1F4E78", "F0F4F8"),
        "WARNING": ("D97706", "FFFBEB"),
        "DANGER": ("DC2626", "FEF2F2"),
        "SUCCESS": ("16A34A", "F0FDF4"),
    }
    border_col, bg_col = color_map.get(kind, ("1F4E78", "F0F4F8"))
    
    set_callout_borders(table, border_col)
    cell = table.cell(0, 0)
    set_cell_background(cell, bg_col)
    set_cell_margins(cell, top=140, bottom=140, left=180, right=180)
    
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(3)
    r_title = p.add_run(f"📌 {title}: ")
    r_title.bold = True
    r_title.font.name = 'Calibri'
    r_title.font.size = Pt(10.5)
    if kind == "DANGER":
        r_title.font.color.rgb = RGBColor(0xDC, 0x26, 0x26)
    elif kind == "WARNING":
        r_title.font.color.rgb = RGBColor(0xD9, 0x77, 0x06)
    elif kind == "SUCCESS":
        r_title.font.color.rgb = RGBColor(0x16, 0xA3, 0x4A)
    else:
        r_title.font.color.rgb = RGBColor(0x1F, 0x4E, 0x78)
        
    add_styled_inline(p, text)
    
    p_after = doc.add_paragraph()
    p_after.paragraph_format.space_before = Pt(0)
    p_after.paragraph_format.space_after = Pt(3)

def add_code_block(doc, code_str):
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_callout_borders(table, "2E75B6")
    cell = table.cell(0, 0)
    set_cell_background(cell, "F8F9FA")
    set_cell_margins(cell, top=120, bottom=120, left=180, right=180)
    
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.line_spacing = 1.05
    run = p.add_run(code_str)
    run.font.name = 'Consolas'
    run.font.size = Pt(9.0)
    run.font.color.rgb = RGBColor(0x24, 0x29, 0x2E)
    
    p_after = doc.add_paragraph()
    p_after.paragraph_format.space_before = Pt(0)
    p_after.paragraph_format.space_after = Pt(3)

def add_table(doc, headers, data, col_widths=None):
    table = doc.add_table(rows=len(data) + 1, cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    set_table_borders(table, color="D3D3D3", sz="4", val="single")
    
    # Header Row
    hdr_cells = table.rows[0].cells
    for i, h in enumerate(headers):
        hdr_cells[i].text = ""
        p = hdr_cells[i].paragraphs[0]
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(0)
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run(h)
        r.bold = True
        r.font.name = 'Calibri'
        r.font.size = Pt(10)
        r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
        set_cell_background(hdr_cells[i], "1F4E78")
        set_cell_margins(hdr_cells[i], top=120, bottom=120, left=140, right=140)
        hdr_cells[i].vertical_alignment = WD_ALIGN_VERTICAL.CENTER

    # Data Rows
    for r_idx, row in enumerate(data):
        row_cells = table.rows[r_idx + 1].cells
        bg_col = "F8F9FA" if r_idx % 2 == 1 else "FFFFFF"
        for c_idx, val in enumerate(row):
            row_cells[c_idx].text = ""
            p = row_cells[c_idx].paragraphs[0]
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = 1.1
            add_styled_inline(p, str(val))
            set_cell_background(row_cells[c_idx], bg_col)
            set_cell_margins(row_cells[c_idx], top=100, bottom=100, left=140, right=140)
            row_cells[c_idx].vertical_alignment = WD_ALIGN_VERTICAL.CENTER

    if col_widths and len(col_widths) == len(headers):
        for row in table.rows:
            for i, w in enumerate(col_widths):
                if isinstance(w, (int, float)):
                    row.cells[i].width = Inches(w)
                else:
                    row.cells[i].width = w

    p_after = doc.add_paragraph()
    p_after.paragraph_format.space_before = Pt(0)
    p_after.paragraph_format.space_after = Pt(4)

def build_srs_document():
    doc = docx.Document()
    
    # 1. Page Setup - Margins 2cm (0.78 Inches)
    for section in doc.sections:
        section.top_margin = Inches(0.78)
        section.bottom_margin = Inches(0.78)
        section.left_margin = Inches(0.78)
        section.right_margin = Inches(0.78)
        
        # Header
        header = section.header
        hp = header.paragraphs[0]
        hp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        hrun = hp.add_run("RIKKEI POST — HỆ THỐNG QUẢN LÝ BƯU CHÍNH & CHUYỂN PHÁT NHANH | SRS v3.5.0")
        hrun.font.name = 'Calibri'
        hrun.font.size = Pt(8.5)
        hrun.font.color.rgb = RGBColor(0x88, 0x88, 0x88)
        
        # Footer
        footer = section.footer
        fp = footer.paragraphs[0]
        fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
        frun = fp.add_run("Tài liệu Đặc tả Yêu cầu Phần mềm (SRS) — Bảo mật Nội bộ | Rikkei Education © 2026")
        frun.font.name = 'Calibri'
        frun.font.size = Pt(8.5)
        frun.font.color.rgb = RGBColor(0x77, 0x77, 0x77)

    # --------------------------------------------------------------------------
    # TRANG BÌA (COVER PAGE)
    # --------------------------------------------------------------------------
    p_org = doc.add_paragraph()
    p_org.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_org.paragraph_format.space_before = Pt(24)
    p_org.paragraph_format.space_after = Pt(4)
    r_org = p_org.add_run("TẬP ĐOÀN CÔNG NGHỆ RIKKEISOFT — RIKKEI EDUCATION R&D")
    r_org.font.name = 'Calibri'
    r_org.font.size = Pt(12)
    r_org.font.bold = True
    r_org.font.color.rgb = RGBColor(0x59, 0x59, 0x59)

    p_proj = doc.add_paragraph()
    p_proj.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_proj.paragraph_format.space_before = Pt(12)
    p_proj.paragraph_format.space_after = Pt(8)
    r_proj = p_proj.add_run("DỰ ÁN NỀN TẢNG CHUỖI CUNG ỨNG VÀ BƯU CHÍNH THÔNG MINH\nRIKKEI POST (SMART EXPRESS LOGISTICS)")
    r_proj.font.name = 'Calibri'
    r_proj.font.size = Pt(17)
    r_proj.font.bold = True
    r_proj.font.color.rgb = RGBColor(0xC0, 0x00, 0x00) # Brand Red

    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_title.paragraph_format.space_before = Pt(16)
    p_title.paragraph_format.space_after = Pt(8)
    r_title = p_title.add_run("TÀI LIỆU ĐẶC TẢ YÊU CẦU PHẦN MỀM\n(SOFTWARE REQUIREMENTS SPECIFICATION - SRS)")
    r_title.font.name = 'Calibri'
    r_title.font.size = Pt(20)
    r_title.font.bold = True
    r_title.font.color.rgb = RGBColor(0x1F, 0x4E, 0x78)

    p_sub = doc.add_paragraph()
    p_sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_sub.paragraph_format.space_after = Pt(28)
    r_sub = p_sub.add_run("Đặc tả kiến trúc Hub-and-Spoke 3 chặng, Master Bagging, Kẹp chì Seal, Điều vận xe tải, Cổng tác nghiệp Bưu tá, Đối soát PayOS VietQR, Máy trạng thái Giao hàng & Chấm công FaceID AI")
    r_sub.font.name = 'Calibri'
    r_sub.font.size = Pt(11)
    r_sub.font.italic = True
    r_sub.font.color.rgb = RGBColor(0x59, 0x59, 0x59)

    # Metadata Box on Cover
    meta_table_headers = ["Thuộc tính thông tin", "Giá trị đặc tả"]
    meta_table_data = [
        ["Tên dự án chính thức", "Rikkei Post - Smart Express Logistics & Supply Chain Platform"],
        ["Mã định danh dự án", "RKP-LOGISTICS-ENTERPRISE-2026"],
        ["Phiên bản tài liệu", "3.5.0 (Enterprise Comprehensive Release - Full Flow Verified)"],
        ["Tiêu chuẩn kỹ thuật", "Tuân thủ IEEE Std 830-1998 & ISO/IEC/IEEE 29148:2018"],
        ["Tác giả & Kiến trúc sư trưởng", "Nguyễn Công Hưởng (Lead Fullstack, Cloud & AI Architect)"],
        ["Công nghệ chủ đạo", "Java 21 LTS, Spring Boot 4.1.x, Spring Data JPA (Code-First), React 18, Tailwind, AntD, PostgreSQL, Redis, Kafka"],
        ["Ngày phát hành tài liệu", "27/11/2026"],
        ["Tình trạng phê duyệt", "APPROVED & OFFICIALLY BASELINED FOR DEPLOYMENT"]
    ]
    add_table(doc, meta_table_headers, meta_table_data, [2.5, 4.3])

    doc.add_page_break()

    # --------------------------------------------------------------------------
    # BẢNG LỊCH SỬ THAY ĐỔI TÀI LIỆU (REVISION HISTORY)
    # --------------------------------------------------------------------------
    add_h1(doc, "LỊCH SỬ THAY ĐỔI TÀI LIỆU (DOCUMENT REVISION HISTORY)")
    rev_headers = ["Phiên bản", "Ngày", "Tác giả", "Mô tả thay đổi chi tiết"]
    rev_data = [
        ["1.0.0", "20/11/2026", "Nguyễn Công Hưởng", "Khởi tạo tài liệu đặc tả SRS ban đầu cho 5 phân hệ MVP."],
        ["2.0.0", "22/11/2026", "Nguyễn Công Hưởng", "Bổ sung phân hệ TMS Vận tải đường trục, Shipper App PWA và bằng chứng giao hàng điện tử POD."],
        ["3.0.0", "25/11/2026", "Nguyễn Công Hưởng", "Tích hợp quy trình Đóng bao Master Bag, Kẹp chì an ninh Seal, Tem nhãn nhiệt A6 và bộ quét mã vạch."],
        ["3.5.0", "27/11/2026", "Nguyễn Công Hưởng", "Nâng cấp toàn diện: Quy tắc giao thất bại 3 lần (3-Strike Rule), quét nhập lại kho bưu cục AT_SORTING_HUB, khóa công nợ COD PayOS, cổng tác nghiệp tài xế quét Camera HTML5-QRCode, chấm công FaceID AI và quản lý kho vật tư."]
    ]
    add_table(doc, rev_headers, rev_data, [0.9, 1.1, 1.7, 3.1])

    # --------------------------------------------------------------------------
    # BẢNG THUẬT NGỮ & TỪ VIẾT TẮT (GLOSSARY & ACRONYMS)
    # --------------------------------------------------------------------------
    add_h1(doc, "DANH MỤC THUẬT NGỮ & TỪ VIẾT TẮT (GLOSSARY & ACRONYMS)")
    glossary_headers = ["Thuật ngữ", "Tên đầy đủ (Tiếng Anh)", "Ý nghĩa và Định nghĩa nghiệp vụ"]
    glossary_data = [
        ["SRS", "Software Requirements Specification", "Tài liệu đặc tả yêu cầu phần mềm xác lập tiêu chuẩn chức năng và kỹ thuật."],
        ["Hub", "Central Sorting Hub", "Trung tâm khai thác và chia chọn bưu gửi quy mô lớn cấp vùng hoặc liên miền."],
        ["Spoke", "Post Office / Transaction Point", "Bưu cục giao dịch cấp quận/huyện, điểm đầu tiếp nhận và điểm cuối phát hàng."],
        ["Master Bag", "Consolidated Master Bag", "Bao tải tổng gom nhiều kiện hàng nhỏ lẻ cùng hướng đích để chống thất lạc và tối ưu bốc dỡ."],
        ["Security Seal", "Tamper-Evident Security Seal", "Dây kẹp chì niêm phong có số hiệu độc nhất khóa miệng bao tải Master Bag."],
        ["POD", "Proof of Delivery", "Bằng chứng giao hàng điện tử gồm chữ ký cảm ứng, ảnh hiện trường có GPS/giờ và mã OTP."],
        ["COD", "Cash On Delivery", "Dịch vụ thu tiền hộ người bán khi phát hàng thành công cho người nhận."],
        ["Routing Code", "Sorting Routing Code", "Mã định tuyến 3 cấp (Vùng-Tỉnh-Bưu cục, VD: `RKP-79-001`) để phân luồng hàng hóa tự động."],
        ["Chute / Gate", "Sorting Chute / Gate ID", "Máng trượt hoặc cửa xuất hàng tương ứng với xe tải hoặc tuyến vận chuyển."],
        ["Dispatch Order", "Linehaul Dispatch Order", "Lệnh điều vận chuyến xe tải vận chuyển các bao tải giữa bưu cục và kho Hub."],
        ["TMS", "Transportation Management System", "Hệ thống quản lý và điều phối vận tải đường trục và chặng cuối."],
        ["WMS", "Warehouse Management System", "Hệ thống quản lý kho bãi, chia chọn, đóng bao và lưu kho bưu gửi."],
        ["Code-First ORM", "Code-First Object Relational Mapping", "Mô hình định nghĩa thực thể Java Class, Hibernate tự động sinh cấu trúc bảng PostgreSQL."],
        ["PayOS VietQR", "Dynamic VietQR Payment Gateway", "Cổng thanh toán tạo mã QR ngân hàng động giúp người nhận chuyển khoản COD tức thì."]
    ]
    add_table(doc, glossary_headers, glossary_data, [1.2, 2.2, 3.4])

    doc.add_page_break()

    # --------------------------------------------------------------------------
    # CHƯƠNG 1: GIỚI THIỆU TỔNG QUAN (INTRODUCTION)
    # --------------------------------------------------------------------------
    add_h1(doc, "CHƯƠNG 1: GIỚI THIỆU TỔNG QUAN (INTRODUCTION)")
    
    add_h2(doc, "1.1. Mục đích tài liệu (Purpose)")
    add_para(doc, "Tài liệu Đặc tả Yêu cầu Phần mềm (SRS) này mô tả toàn diện, chi tiết và có hệ thống toàn bộ các yêu cầu nghiệp vụ, luồng tác nghiệp, yêu cầu chức năng, phi chức năng, kiến trúc kỹ thuật và cấu trúc cơ sở dữ liệu của nền tảng **Rikkei Post (Smart Express Logistics)**. Tài liệu đóng vai trò là kim chỉ nam kỹ thuật chuẩn mực cho các giai đoạn lập trình, kiểm thử nghiệm thu (UAT), bàn giao và triển khai vận hành thực tế.")

    add_h2(doc, "1.2. Phạm vi sản phẩm (Product Scope)")
    add_para(doc, "**Rikkei Post** là hệ sinh thái phần mềm quản lý bưu chính và chuyển phát nhanh thông minh thế hệ mới, được thiết kế theo mô hình vận hành **Hub-and-Spoke** chuẩn mực của các tập đoàn chuyển phát hàng đầu (Viettel Post, J&T Express, Kerry Express). Hệ thống bao quát 100% các chặng trong chuỗi cung ứng logistics:")
    add_bullet(doc, "**Chặng gom hàng (First-Mile):** Chủ shop khởi tạo đơn hàng qua Cổng Portal hoặc API mở; bưu tá tuyến sử dụng ứng dụng di động quét mã vạch bằng camera đến lấy hàng tận nơi hoặc khách gửi trực tiếp tại quầy bưu cục.")
    add_bullet(doc, "**Chặng trung chuyển & Khai thác (Middle-Mile):** Tiếp nhận bưu gửi tại bưu cục gốc, cân đo tự động, phân loại theo Routing Code, đóng bao tải Master Bag, kẹp chì an ninh niêm phong Seal, in tem nhiệt chuẩn A6, lập lệnh điều vận xe tải và quét nạp bao lên xe bằng camera điện thoại của tài xế.")
    add_bullet(doc, "**Chặng giao hàng chặng cuối (Last-Mile):** Tiếp nhận hàng tại bưu cục phát, phân tuyến xe máy cho bưu tá, xuất kho đi giao, xác thực giao hàng điện tử POD (chữ ký số, ảnh hiện trường có watermark GPS + mốc thời gian, mã OTP xác minh đơn giá trị cao), thu tiền COD qua mã VietQR động.")
    add_bullet(doc, "**Quản lý ngoại lệ & Hoàn hàng:** Quy định nghiêm ngặt giao thất bại tối đa 3 lần; đơn không giao được phải mang về kho bưu cục để nhân viên kho quét nhập kho (`AT_SORTING_HUB`) lưu trữ, chỉ khi thất bại đủ 3 lần mới kích hoạt chuyển hoàn về Shop (`RETURNING`).")
    add_bullet(doc, "**Đối soát tài chính & Quyết toán COD:** Tự động cấn trừ cước phí, quản lý công nợ bưu tá, khóa quyền xuất kho nếu nợ COD cũ chưa nộp, thanh toán chuyển khoản tự động về ví chủ shop.")
    add_bullet(doc, "**Ứng dụng AI & Quản trị phụ trợ:** Chấm công nhận diện khuôn mặt FaceID AI, cấp phát & thu hồi vật tư thiết bị bưu chính, tối ưu hóa tuyến đường đa điểm dừng (VRP/TSP Solver) và Trợ lý ảo CSKH AI ứng dụng Spring AI 2.0.")

    add_h2(doc, "1.3. Bối cảnh Logistics & Giá trị cốt lõi (Business Context)")
    add_para(doc, "Thương mại điện tử Việt Nam đang tăng trưởng bùng nổ, kéo theo áp lực cực lớn lên hạ tầng chuyển phát nhanh. Các hệ thống truyền thống thường gặp phải các nút thắt:")
    add_bullet(doc, "*Thất lạc kiện nhỏ lẻ:* Quá trình bốc dỡ hàng nghìn kiện đơn chiếc giữa các kho trung chuyển dẫn đến tỷ lệ thất thoát, rơi vỡ cao.")
    add_bullet(doc, "*Gian lận & Thất thoát công nợ COD:* Bưu tá ôm tiền mặt COD không nộp cuối ca, đối soát tài chính với chủ shop chậm trễ (tốn từ 5 - 7 ngày).")
    add_bullet(doc, "*Tắc nghẽn tại bưu cục phát:* Tài xế xe tải không nắm rõ số lượng bao hàng, dỡ hàng thiếu kiểm soát, không có cơ chế ràng buộc nghiệm thu 100% bao trước khi kết thúc chuyến đi.")
    add_para(doc, "**Rikkei Post** giải quyết triệt để các vấn đề trên nhờ áp dụng cơ chế đóng bao Master Bag niêm phong kẹp chì, khóa logic nghiệm thu chuyến xe tải, kiểm soát giao thất bại 3 lần chặt chẽ và số hóa 100% bằng chứng giao hàng POD.")

    # --------------------------------------------------------------------------
    # CHƯƠNG 2: MÔ TẢ TỔNG QUAN HỆ THỐNG (OVERALL SYSTEM DESCRIPTION)
    # --------------------------------------------------------------------------
    add_h1(doc, "CHƯƠNG 2: MÔ TẢ TỔNG QUAN HỆ THỐNG (OVERALL SYSTEM DESCRIPTION)")

    add_h2(doc, "2.1. Phối cảnh kiến trúc hệ thống (System Perspective)")
    add_para(doc, "Hệ thống Rikkei Post được xây dựng theo kiến trúc phân tầng chuyên nghiệp (3-Tier Layered Architecture), tối ưu hóa cho khả năng mở rộng (Scalability) và bảo trì cao:")
    add_bullet(doc, "**Tầng Trình Diễn (Presentation Tier):** Xây dựng bằng React 18, Tailwind CSS và Ant Design. Tích hợp thư viện quét mã vạch trực tiếp bằng Camera qua HTML5-QRCode, hỗ trợ cả giao diện Desktop màn hình rộng cho thủ kho và giao diện Mobile Web / PWA tối ưu cảm ứng cho bưu tá và tài xế xe tải.")
    add_bullet(doc, "**Tầng Xử Lý Nghiệp Vụ (Application Tier):** Phát triển trên nền tảng Java 21 LTS và Spring Boot 4.1.x, áp dụng cơ chế kiến trúc Clean Code và Domain-Driven Design (DDD). Toàn bộ nghiệp vụ kiểm tra trạng thái (State Transition), phân quyền tác nghiệp và đối soát tài chính được đóng gói chặt chẽ tại tầng Service.")
    add_bullet(doc, "**Tầng Dữ Liệu & Hàng Đợi (Data & Messaging Tier):** Sử dụng CSDL quan hệ PostgreSQL kết hợp cơ chế Code-First với Spring Data JPA / Hibernate; bộ nhớ đệm phân tán Redis Caching; hàng đợi sự kiện Apache Kafka phục vụ truyền phát thông điệp điều vận; WebSocket STOMP cập nhật trạng thái thời gian thực và Cloudflare R2 lưu trữ bằng chứng POD.")

    add_h2(doc, "2.2. Ma trận phân quyền tác nhân người dùng (Actors & RBAC Matrix)")
    add_para(doc, "Hệ thống hỗ trợ cơ chế **Đa vai trò (Multiple Roles per User)**, cho phép một người dùng có thể sở hữu nhiều quyền hạn khác nhau. Dưới đây là ma trận phân quyền chi tiết của 8 nhóm người dùng cốt lõi:")

    rbac_headers = ["Nhóm Người Dùng (Role)", "Mã Quyền", "Phạm Vi Trách Nhiệm & Quyền Hạn Tác Nghiệp"]
    rbac_data = [
        ["Quản trị viên Hệ thống", "ROLE_ADMIN", "Toàn quyền cấu hình hệ thống, quản lý mạng lưới bưu cục/kho Hub, phân quyền người dùng, giám sát toàn trình, cấu hình bảng cước phí và xem toàn bộ báo cáo doanh thu."],
        ["Quản lý Chi nhánh Tỉnh/TP", "ROLE_BRANCH_MANAGER", "Quản lý toàn bộ mạng lưới kho bưu cục trực thuộc một tỉnh/thành phố, phê duyệt hạn mức công nợ, phân bổ xe tải tuyến tỉnh."],
        ["Quản lý Bưu cục / Kho Spoke", "ROLE_POST_OFFICE_MANAGER", "Quản lý hoạt động tại một bưu cục cụ thể: lập lệnh điều vận xe tải, phân công tuyến bưu tá lấy/giao, quyết toán quỹ COD cuối ca, phê duyệt cấp phát vật tư."],
        ["Nhân viên Khai thác Kho", "ROLE_WAREHOUSE_STAFF", "Quét nhập kho bưu gửi (Inbound), phân loại bưu phẩm, đóng bao tải Master Bag, kẹp chì an ninh Seal, in tem nhiệt A6, dỡ bao và quét nhập lại kho sau giao thất bại."],
        ["Bưu tá Tuyến Xe Máy", "ROLE_SHIPPER", "Sử dụng app di động: quét lấy hàng tại Shop, quét xuất kho đi giao, xác thực giao hàng POD (chữ ký, ảnh GPS, OTP), cập nhật giao thất bại, nộp tiền mặt COD."],
        ["Tài xế Xe tải Đường trục", "ROLE_TRUCK_DRIVER", "Cổng tác nghiệp tài xế: tiếp nhận lệnh điều vận được gán đích danh, mở camera điện thoại quét nạp bao Master Bag lên xe, cập nhật trạng thái chuyến đi IN_TRANSIT, COMPLETED."],
        ["Chủ Shop / Khách hàng", "ROLE_MERCHANT", "Tạo đơn hàng lẻ/lô, nạp tiền ví, tra cứu hành trình thời gian thực, xem biên bản đối soát COD định kỳ, yêu cầu rút tiền về tài khoản ngân hàng."],
        ["Kế toán Đối soát", "ROLE_ACCOUNTANT", "Kiểm tra đối chiếu dòng tiền COD thu hộ, cấn trừ cước phí vận chuyển, duyệt chi lệnh rút tiền của chủ shop, quản lý thanh toán cổng PayOS VietQR."]
    ]
    add_table(doc, rbac_headers, rbac_data, [1.5, 1.5, 3.8])

    add_h2(doc, "2.3. Môi trường vận hành (Operating Environment)")
    add_bullet(doc, "**Hệ điều hành Server:** Ubuntu Linux 22.04 LTS / Debian 12 / Docker Containerization.")
    add_bullet(doc, "**Cơ sở dữ liệu:** PostgreSQL 15+ (kèm extension PostGIS tính toán khoảng cách địa lý).")
    add_bullet(doc, "**Bộ nhớ đệm & Phiên:** Redis Server 7.0+ (lưu trữ token blacklist, session, geofence caching).")
    add_bullet(doc, "**Message Broker:** Apache Kafka 3.6+ / RabbitMQ cho luồng sự kiện phân tán.")
    add_bullet(doc, "**Trình duyệt Client:** Google Chrome, Safari, Microsoft Edge trên Desktop & Thiết bị di động Android/iOS.")

    doc.add_page_break()

    # --------------------------------------------------------------------------
    # CHƯƠNG 3: MÔ HÌNH NGHIỆP VỤ & QUY TRÌNH TOÀN TRÌNH
    # --------------------------------------------------------------------------
    add_h1(doc, "CHƯƠNG 3: MÔ HÌNH NGHIỆP VỤ & QUY TRÌNH TOÀN TRÌNH")

    add_h2(doc, "3.1. Luồng chuỗi cung ứng toàn trình 10 bước (End-to-End Supply Chain Flow)")
    add_para(doc, "Quy trình vận hành logistics của Rikkei Post kết nối khép kín từ khâu tiếp nhận bưu gửi đến khi phát tận tay người nhận và dòng tiền COD được đối soát hoàn tất:")
    add_bullet(doc, "**Bước 1 — Tạo đơn hàng:** Chủ Shop truy cập Cổng Khách hàng hoặc gửi dữ liệu qua API. Hệ thống thẩm định thông tin địa chỉ 3 cấp hành chính, tự động tính cước động theo cân nặng thực tế và quy đổi thể tích `(D x R x C)/6000`, sinh mã vận đơn duy nhất dạng `RKP...` và mã vạch Code-128.")
    add_bullet(doc, "**Bước 2 — Điều phối thu gom:** Hệ thống phân tích địa chỉ người gửi, tự động định tuyến đơn hàng về Bưu cục gốc gần nhất và chỉ định Bưu tá phụ trách tuyến đường đó.")
    add_bullet(doc, "**Bước 3 — Bưu tá quét lấy hàng tại Shop:** Bưu tá mở app điện thoại, chọn tab Lấy hàng, dùng camera quét mã vận đơn trên gói hàng của Shop. Trạng thái đơn chuyển sang `PICKED_UP`.")
    add_bullet(doc, "**Bước 4 — Bàn giao & Nhập kho bưu cục gửi:** Bưu tá mang hàng về bưu cục, nhân viên khai thác kho dùng súng quét mã vạch hoặc camera quét nhận hàng. Hệ thống xác nhận kiện hàng đã an toàn tại kho (`AT_SORTING_HUB`).")
    add_bullet(doc, "**Bước 5 — Đóng bao Master Bag & Kẹp chì Seal:** Nhân viên kho gom các kiện hàng có cùng kho đích, đóng vào bao tải Master Bag, luồn dây kẹp chì an ninh bấm niêm phong, nhập mã Seal (`SEAL...`) vào hệ thống để khóa bao và bấm in tem nhiệt A6.")
    add_bullet(doc, "**Bước 6 — Lập lệnh điều vận xe tải:** Quản lý bưu cục tạo Lệnh điều vận chuyến xe, chọn tuyến đường, chọn biển số xe tải và tài xế trực thuộc bưu cục quản lý.")
    add_bullet(doc, "**Bước 7 — Tài xế quét camera nạp bao lên xe:** Tài xế xe tải mở ứng dụng di động, truy cập Cổng tác nghiệp vận tải, dùng camera quét mã vạch Code-128 / QR Code trên tem dán bao tải để nạp hàng lên thùng xe. Khi đủ hàng, tài xế xác nhận xuất phát, trạng thái chuyến xe chuyển sang `IN_TRANSIT`.")
    add_bullet(doc, "**Bước 8 — Khai thác tại Hub trung tâm:** Xe tải đến Hub trung chuyển, nhân viên kho đối soát số hiệu chì Seal còn nguyên vẹn, cắt chì, dỡ bao và đưa kiện con lên băng chuyền chia chọn tự động để chuyển tiếp về Bưu cục phát đích.")
    add_bullet(doc, "**Bước 9 — Bưu cục phát xuất kho giao hàng:** Bưu cục phát quét nhập kiện lẻ, phân công tuyến xe máy cho Bưu tá phụ trách phát hàng (`OUT_FOR_DELIVERY` / `DELIVERING`).")
    add_bullet(doc, "**Bước 10 — Giao thành công & Đối soát COD:** Người nhận kiểm tra hàng, ký tên xác nhận POD, thanh toán tiền COD bằng tiền mặt hoặc quét mã PayOS VietQR. Bưu tá nộp quỹ, hệ thống đối soát tự động cấn trừ cước và chuyển khoản tiền bán hàng về tài khoản của Shop.")

    add_h2(doc, "3.2. Quy trình Gom hàng, Đóng bao Master Bag & Kẹp chì an ninh (Sealing)")
    add_para(doc, "Để ngăn chặn nguy cơ rơi vỡ, thất lạc bưu phẩm trong quá trình luân chuyển đường trục liên tỉnh, Rikkei Post bắt buộc áp dụng quy trình đóng bao tổng (Master Bagging):")
    add_bullet(doc, "**Quy tắc gom hàng theo kho đích:** Nhân viên kho chỉ được phép quét gom các kiện con có cùng kho tiếp nhận (Hub đích hoặc Bưu cục phát đích) vào chung một bao tải Master Bag.")
    add_bullet(doc, "**Quy tắc hiển thị thống kê:** Trên giao diện quản lý đóng bao, hệ thống chỉ hiển thị thống kê số lượng bao của các kho đích có số lượng lớn hơn 0 (`bag_count > 0`), tự động ẩn các kho không có bao nào gửi đến.")
    add_bullet(doc, "**Quy tắc khởi tạo không gán trước tài xế:** Khi nhân viên kho tạo bao mới, các thông tin `driver_id = NULL` và `truck_id = NULL`. Hệ thống tuyệt đối không cho phép gán tài xế trước lúc đóng bao; chỉ khi nào tài xế xe tải nhận lệnh điều vận mở camera quét tem A6 nạp bao lên xe thì hệ thống mới chính thức gán định danh tài xế và biển số xe vào bao tải.")
    add_bullet(doc, "**Quy trình kẹp chì niêm phong:** Sau khi quét đủ kiện vào bao, nhân viên bấm 'Khóa bao', lấy dây kẹp chì nhựa/kim loại bấm qua miệng bao, nhập số hiệu chì (`SEAL-YYYYMMDD-XXXX`) vào hệ thống để khóa bao vĩnh viễn ở trạng thái `SEALED`.")

    add_callout(doc, "TIÊU CHUẨN TEM NHÃN NHIỆT MASTER BAG KHỔ A6 (100mm x 150mm)",
        "Tem nhãn A6 in ra từ máy in nhiệt (Xprinter/HPRT) bắt buộc phải tích hợp đồng thời 2 loại mã: **Mã vạch Barcode Code-128** và **Mã phản hồi nhanh QR Code (kích thước tối thiểu 100x100px)**. Điều này đảm bảo camera điện thoại của tài xế nhận diện siêu tốc ngay cả khi dán trên mặt bao tải nhăn nheo hoặc trong điều kiện thiếu sáng của thùng xe tải.", "SUCCESS")

    add_h2(doc, "3.3. Quy trình Lệnh điều vận xe tải & Cổng tác nghiệp tài xế (Linehaul Dispatch)")
    add_para(doc, "Vận tải đường trục giữa các bưu cục và trung tâm khai thác được kiểm soát bằng Lệnh điều vận chuyến xe (`DispatchOrder`) với các ràng buộc bảo mật:")
    add_bullet(doc, "**Phân quyền tạo lệnh nghiêm ngặt:** Chỉ Quản lý bưu cục / Hub xuất phát mới có quyền tạo lệnh điều vận. Bưu tá, tài xế và nhân viên kho không được phép tự tạo lệnh.")
    add_bullet(doc, "**Phạm vi kho trực thuộc:** Quản lý bưu cục nào thì chỉ được chọn xe tải và tài xế trực thuộc quyền quản lý của bưu cục đó, ngăn chặn việc điều động nhầm xe của chi nhánh khác.")
    add_bullet(doc, "**Bảo mật phân công:** Lệnh điều vận chỉ hiển thị đối với tài xế được gán tên đích danh trong lệnh. Các tài xế khác khi đăng nhập app sẽ hoàn toàn không nhìn thấy lệnh này.")
    add_bullet(doc, "**Nghiệm thu điều kiện hoàn thành chuyến đi:** Tài xế chỉ được phép chuyển trạng thái chuyến xe sang `COMPLETED` khi **100% các bao tải trên xe đã được quét nhập kho thành công tại kho đích**. Nếu vẫn còn dù chỉ 1 bao tải chưa được kho đích quét tiếp nhận, nút Hoàn thành chuyến xe sẽ bị khóa và hệ thống cảnh báo lỗi để ngăn ngừa việc bỏ quên hàng trên thùng xe.")

    add_h2(doc, "3.4. Quy tắc đặc thù Giao thất bại 3 lần (3-Strike Rule) & Nhập lại kho bưu cục")
    add_para(doc, "Hệ thống chuẩn hóa logic xử lý giao không thành công nhằm bảo vệ quyền lợi tối đa cho Chủ shop và Người nhận:")
    add_bullet(doc, "**Quy tắc Chặn Chuyển Hoàn (< 3 lần):** Nếu đơn hàng giao không thành công do bưu tá không liên lạc được với khách hàng (thuê bao, tắt máy, không nghe máy, khách hẹn lại ngày phát) và số lần phát chưa đủ 3 lần (`deliveryAttempts < 3`), hệ thống **TUYỆT ĐỐI CHẶN** mọi hành vi chuyển hoàn về Shop (`RETURNING`).")
    add_bullet(doc, "**Mang hàng về kho bưu cục:** Bưu tá sau khi báo thất bại trên app (`DELIVERY_FAILED`) bắt buộc phải mang kiện hàng về bưu cục vào cuối ca giao hàng.")
    add_bullet(doc, "**Nhân viên kho quét nhập lại vào kho (`AT_SORTING_HUB`):** Nhân viên kho / Quản lý bưu cục dùng súng quét hoặc bấm nút 'Quét nhập lại vào kho' trên cổng tác nghiệp. Hệ thống chuyển trạng thái đơn hàng từ `DELIVERY_FAILED` về `AT_SORTING_HUB` (Đang ở kho - Chờ phát lại), đồng thời tự động xóa thông tin bưu tá cũ (`assignedShipperId = null`) để sẵn sàng cho ca phát lại.")
    add_bullet(doc, "**Bưu tá xuất kho phát lại vào hôm sau:** Vào ca sáng hôm sau, bưu tá phụ trách tuyến quét mã xuất kho (`scan-delivery`). Hệ thống ghi nhận lần phát thứ `X/3` và chuyển trạng thái sang `DELIVERING`.")
    add_bullet(doc, "**Kích hoạt chuyển hoàn khi đủ 3 lần:** Chỉ khi bưu tá đã phát thất bại đủ 3 lần (`deliveryAttempts >= 3`) hoặc người nhận từ chối nhận hàng dứt khoát / hủy đơn, hệ thống mới cho phép chuyển trạng thái sang Hàng hoàn (`RETURNING`) để làm thủ tục hoàn trả về cho Shop.")

    add_callout(doc, "RÀNG BUỘC NGHIỆP VỤ BẮT BUỘC TẠI TẦNG BACKEND & UI",
        "Backend class `ShipperServiceImpl.java` cài đặt kiểm tra điều kiện `if (attempts < 3 && !isExplicitReject) throw new IllegalStateException(...)` tại cả 2 hàm `scanReturnToWarehouse` và `updateDeliveryStatus`. Đồng thời trên giao diện `ShipperPortalPage.tsx` và `OrdersListPage.tsx`, nút 'Chuyển hoàn về Shop' tự động bị vô hiệu hóa (disabled) khi số lần phát `< 3`.", "DANGER")

    add_h2(doc, "3.5. Quy trình Quản lý Quỹ COD & Khóa công nợ bưu tá")
    add_para(doc, "Để đảm bảo an toàn tuyệt đối cho dòng tiền thu hộ COD của khách hàng, Rikkei Post cài đặt cơ chế khóa công nợ tự động:")
    add_bullet(doc, "**Khóa xuất kho khi còn nợ ca cũ:** Đầu ca làm việc, khi bưu tá quét mã xuất kho lấy đơn mới đi giao (`scan-out-delivery`), hệ thống tự động kiểm tra số tiền COD thu từ các ca ngày trước mà bưu tá chưa nộp về quỹ. Nếu số nợ cũ > 0, hệ thống **KHÓA NGAY LẬP TỨC** quyền xuất kho và thông báo: *'KHÓA XUẤT KHO: Bạn đang còn nợ [Số tiền] đ tiền thu hộ COD từ các ca ngày trước chưa nộp! Vui lòng hoàn tất nộp tiền cuối ca trước khi được lấy đơn mới đi giao.'*")
    add_bullet(doc, "**Hình thức nộp quỹ linh hoạt:** Bưu tá có thể nộp tiền mặt trực tiếp cho thủ quỹ tại bưu cục (thủ quỹ bấm xác nhận quyết toán trên hệ thống) hoặc bưu tá mở app tự quét mã PayOS VietQR chuyển khoản trực tiếp vào tài khoản bưu cục để giải tỏa công nợ tức thì.")

    doc.add_page_break()

    # --------------------------------------------------------------------------
    # CHƯƠNG 4: YÊU CẦU CHỨC NĂNG CHI TIẾT (FUNCTIONAL REQUIREMENTS)
    # --------------------------------------------------------------------------
    add_h1(doc, "CHƯƠNG 4: YÊU CẦU CHỨC NĂNG CHI TIẾT (FUNCTIONAL REQUIREMENTS)")

    add_h2(doc, "4.1. Phân hệ 1: Cổng Khách hàng & Quản lý Đơn hàng (Customer Portal)")
    fr1_headers = ["Mã Yêu Cầu", "Tên Chức Năng", "Mô Tả Chi Tiết Yêu Cầu & Tiêu Chí Chấp Nhận"]
    fr1_data = [
        ["FR-01.1", "Đăng ký & Đăng nhập JWT", "Đăng ký tài khoản Shop bằng Email/SĐT, xác thực mã OTP gửi về Email qua Spring Mail, đăng nhập cấp phát Access Token (JWT 24h) và Refresh Token."],
        ["FR-01.2", "Tạo bưu gửi đơn lẻ", "Form tạo đơn trực quan: nhập địa chỉ người gửi, người nhận (chọn Tỉnh/Thành, Quận/Huyện, Phường/Xã từ CSDL chuẩn), cân nặng (gram), kích thước 3 chiều, giá trị khai giá, số tiền thu hộ COD, ghi chú giao hàng (Cho xem hàng, Không cho xem)."],
        ["FR-01.3", "Nhập đơn hàng loạt từ Excel", "Upload file Excel (.xlsx) chứa hàng trăm đơn hàng. Hệ thống tự động validate từng dòng, cảnh báo dòng sai dữ liệu, tạo hàng loạt và trả về file kết quả chứa mã vận đơn."],
        ["FR-01.4", "Động cơ tính cước phí động", "Tự động so sánh Trọng lượng thực tế và Trọng lượng quy đổi `(Dài x Rộng x Cao)/6000`, lấy giá trị lớn hơn để tính cước. Áp dụng bảng cước theo cự ly (Nội tỉnh, Nội miền, Liên miền), phụ phí bảo hiểm hàng giá trị cao."],
        ["FR-01.5", "In nhãn bưu gửi chuẩn A6/A7", "Render tem nhãn gửi hàng trực tiếp từ trình duyệt ra máy in nhiệt: Mã vận đơn Barcode 128, QR Code, thông tin Shop, Người nhận, Routing Code và tiền COD."],
        ["FR-01.6", "Tra cứu hành trình công khai", "Trang tra cứu không cần đăng nhập: nhập mã vận đơn để xem toàn bộ lịch sử thời gian, địa điểm, người tác nghiệp và ảnh chụp bằng chứng giao hàng POD."]
    ]
    add_table(doc, fr1_headers, fr1_data, [1.2, 1.8, 3.8])

    add_h2(doc, "4.2. Phân hệ 2: Quản lý Kho WMS Hub & Spoke")
    fr2_headers = ["Mã Yêu Cầu", "Tên Chức Năng", "Mô Tả Chi Tiết Yêu Cầu & Tiêu Chí Chấp Nhận"]
    fr2_data = [
        ["FR-02.1", "Quét mã Inbound siêu tốc", "Hỗ trợ súng bắn Barcode USB/Bluetooth và Camera điện thoại quét liên tục mã kiện hàng nhập kho. Tốc độ xử lý < 80ms/kiện, phát âm thanh Bíp thành công hoặc Bíp lỗi khi quét nhầm kiện."],
        ["FR-02.2", "Định tuyến Routing Code tự động", "Phân tích địa chỉ người nhận, đối chiếu bản đồ hành chính để gán mã phân luồng (VD: `RKP-79-001` - Bưu cục Chợ Bến Thành, TP.HCM) và chỉ định số hiệu cửa xuất hàng (Chute/Gate ID)."],
        ["FR-02.3", "Quản lý tồn kho bưu cục", "Xem danh sách bưu phẩm đang lưu tại kho theo từng phân loại: Kiện mới nhận từ Shop, Kiện chờ chia chọn, Kiện chờ đóng bao Master Bag, Kiện lưu kho chờ phát lại sau giao thất bại."],
        ["FR-02.4", "Quét xuất kho chuyển tiếp", "Quét mã kiện lẻ hoặc mã bao Master Bag để xuất kho bàn giao lên xe tải hoặc bàn giao cho bưu tá tuyến đi phát."]
    ]
    add_table(doc, fr2_headers, fr2_data, [1.2, 1.8, 3.8])

    add_h2(doc, "4.3. Phân hệ 3: Đóng bao Master Bag & Kẹp chì Seal an ninh")
    fr3_headers = ["Mã Yêu Cầu", "Tên Chức Năng", "Mô Tả Chi Tiết Yêu Cầu & Tiêu Chí Chấp Nhận"]
    fr3_data = [
        ["FR-03.1", "Tạo bao Master Bag mới", "Chọn kho xuất phát và kho đích tiếp nhận. Hệ thống tự động sinh mã bao duy nhất dạng `BAGYYYYMMDD...`. Ban đầu `driver_id = null` và `truck_id = null`."],
        ["FR-03.2", "Quét kiện con vào bao", "Nhân viên dùng súng quét mã vạch hoặc camera quét từng mã kiện hàng cùng tuyến đích cho vào bao tải. Hệ thống tự động đếm số lượng kiện và cộng dồn tổng trọng lượng thực tế của bao."],
        ["FR-03.3", "Kẹp chì niêm phong (Sealing)", "Nhân viên bấm 'Khóa bao', nhập mã số hiệu chì an ninh (`SEAL...`) vật lý vào hệ thống. Bao tải chuyển sang trạng thái `SEALED` và không thể chỉnh sửa thêm/bớt kiện."],
        ["FR-03.4", "In Tem Nhãn A6 Master Bag", "Hệ thống render bản in nhiệt khổ A6 chứa: Mã bao, Tuyến gửi/nhận, Số kiện, Cân nặng, Mã Seal, Barcode 128 và mã QR Code kích thước lớn để tài xế quét nạp lên xe tải."],
        ["FR-03.5", "Dỡ bao & Kiểm đếm kho nhận", "Tại kho đích, nhân viên quét mã bao trên tem A6, đối soát số hiệu Seal vật lý, dùng kìm cắt chì, quét kiểm đếm từng kiện con ra khỏi bao và chuyển trạng thái bao sang `UNPACKED`."]
    ]
    add_table(doc, fr3_headers, fr3_data, [1.2, 1.8, 3.8])

    add_h2(doc, "4.4. Phân hệ 4: Điều vận Xe tải đường trục & Cổng Tài xế (TMS)")
    fr4_headers = ["Mã Yêu Cầu", "Tên Chức Năng", "Mô Tả Chi Tiết Yêu Cầu & Tiêu Chí Chấp Nhận"]
    fr4_data = [
        ["FR-04.1", "Lập Lệnh điều vận chuyến xe", "Chỉ Quản lý bưu cục mới có quyền lập lệnh; chỉ được chọn xe tải và tài xế trực thuộc bưu cục quản lý. Lệnh sinh mã duy nhất dạng `DOYYYYMMDD...` ở trạng thái `CREATED`."],
        ["FR-04.2", "Cổng tác nghiệp tài xế (Driver App)", "Giao diện Mobile Web dành riêng cho tài xế xe tải: hiển thị danh sách các chuyến xe được giao đích danh; tài xế bấm 'Bắt đầu thực hiện chuyến đi'."],
        ["FR-04.3", "Quét Camera nạp bao lên xe", "Tài xế mở camera điện thoại quét từng mã Barcode/QR trên tem A6 của các bao tải. Mỗi lần quét thành công, bao tải được nạp vào xe và tự động gán thông tin tài xế + biển số xe tải."],
        ["FR-04.4", "Khởi hành & Bắt đầu hành trình", "Sau khi nạp đủ hàng, tài xế bấm 'Xuất phát'. Lệnh điều vận chuyển trạng thái sang `IN_TRANSIT`. Hệ thống phát sinh thông báo real-time qua WebSocket và Kafka đến kho đích."],
        ["FR-04.5", "Nghiệm thu hoàn thành chuyến đi", "Khi xe đến kho đích, kho đích quét nhập kho toàn bộ các bao tải. Nút 'Hoàn thành chuyến đi' của tài xế chỉ mở khi 100% bao tải trên xe đã được quét nhập kho đích thành công."]
    ]
    add_table(doc, fr4_headers, fr4_data, [1.2, 1.8, 3.8])

    add_h2(doc, "4.5. Phân hệ 5: Cổng Tác nghiệp Bưu tá di động (Shipper Portal)")
    fr5_headers = ["Mã Yêu Cầu", "Tên Chức Năng", "Mô Tả Chi Tiết Yêu Cầu & Tiêu Chí Chấp Nhận"]
    fr5_data = [
        ["FR-05.1", "Cổng tác nghiệp 7 nhóm đơn", "Màn hình tác nghiệp bưu tá phân loại trực quan theo 7 trạng thái: Chờ lấy tại Shop, Đã lấy chờ về kho, Đã lưu kho bưu cục, Đang đi giao, Đã giao thành công, Giao thất bại, Đã thu COD."],
        ["FR-05.2", "Quét mã lấy hàng & xuất kho", "Bưu tá dùng camera quét mã lấy hàng tại Shop (`scan-pickup`) và quét mã xuất kho lấy đơn đi giao (`scan-delivery`). Tự động chặn nếu bưu tá đang nợ tiền COD ca trước."],
        ["FR-05.3", "Xác thực giao hàng điện tử POD", "Modal giao hàng POD: Màn hình cảm ứng cho khách ký tên điện tử, camera chụp ảnh giao hàng có gắn watermark tọa độ GPS + thời gian thực, gửi mã OTP xác nhận đơn giá trị cao."],
        ["FR-05.4", "Thanh toán VietQR PayOS thu COD", "Tự động tạo mã VietQR động trực tiếp trên màn hình bưu tá. Người nhận mở ứng dụng ngân hàng quét mã chuyển khoản chính xác số tiền COD. Hệ thống nhận Webhook xác nhận ngay lập tức."],
        ["FR-05.5", "Báo phát thất bại & Lên lịch lại", "Bưu tá chọn lý do thất bại chuẩn (Thuê bao, không nghe máy, hẹn lại ngày phát), chụp ảnh chứng minh hiện trường. Nếu lần phát < 3, đơn chuyển về `DELIVERY_FAILED` và phải mang về kho bưu cục lưu trữ."],
        ["FR-05.6", "Quét nhập lại kho sau thất bại", "Thủ kho quét mã nhập lại kiện hàng giao thất bại (`scan-inbound`), đơn chuyển về `AT_SORTING_HUB` và sẵn sàng để bưu tá xuất kho đi phát lại vào ca hôm sau."]
    ]
    add_table(doc, fr5_headers, fr5_data, [1.2, 1.8, 3.8])

    add_h2(doc, "4.6. Phân hệ 6: Đối soát COD & Quản lý Tài chính (COD Settlement)")
    fr6_headers = ["Mã Yêu Cầu", "Tên Chức Năng", "Mô Tả Chi Tiết Yêu Cầu & Tiêu Chí Chấp Nhận"]
    fr6_data = [
        ["FR-06.1", "Quản lý dòng tiền COD bưu cục", "Theo dõi số dư tiền mặt COD thực tế từng bưu tá đang nắm giữ trong ca. Bưu tá nộp tiền mặt tại bưu cục hoặc chuyển khoản PayOS để thanh toán công nợ."],
        ["FR-06.2", "Cấn trừ cước phí tự động", "Hệ thống tự động trừ tiền cước vận chuyển và phí bảo hiểm vào tổng tiền thu hộ COD của Shop trước khi kết chuyển vào số dư ví khả dụng."],
        ["FR-06.3", "Xuất bảng kê đối soát định kỳ", "Tự động sinh bảng kê chi tiết dạng Excel/PDF theo chu kỳ (2-4-6 hàng tuần) và gửi email tự động cho chủ Shop."],
        ["FR-06.4", "Yêu cầu rút tiền về ngân hàng", "Chủ Shop tạo yêu cầu rút tiền từ ví số dư về tài khoản ngân hàng cá nhân/doanh nghiệp. Kế toán phê duyệt lệnh chi và hệ thống chuyển tiền tự động."]
    ]
    add_table(doc, fr6_headers, fr6_data, [1.2, 1.8, 3.8])

    add_h2(doc, "4.7. Phân hệ 7: Chấm công FaceID AI & Quản lý Nhân sự (Attendance AI)")
    fr7_headers = ["Mã Yêu Cầu", "Tên Chức Năng", "Mô Tả Chi Tiết Yêu Cầu & Tiêu Chí Chấp Nhận"]
    fr7_data = [
        ["FR-07.1", "Đăng ký khuôn mặt mẫu", "Nhân sự chụp ảnh khuôn mặt qua camera. Hệ thống trích xuất vector đặc trưng khuôn mặt (128-dimensional embedding) lưu vào CSDL."],
        ["FR-07.2", "Chấm công FaceID thời gian thực", "Nhân sự mở camera tại bưu cục, hệ thống so khớp khuôn mặt với độ chính xác > 98%, kiểm tra Liveness Detection chống chụp lại từ ảnh tĩnh."],
        ["FR-07.3", "Xác thực bán kính GPS Geofence", "Kiểm tra tọa độ GPS của thiết bị phải nằm trong bán kính 150m tính từ tâm tọa độ của bưu cục làm việc mới cho phép chấm công hợp lệ."],
        ["FR-07.4", "Bảng công & Tính lương tự động", "Tự động ghi nhận giờ vào ca (Check-in), giờ tan ca (Check-out), cảnh báo đi muộn/về sớm và tổng hợp công chuẩn vào bảng lương cuối tháng."]
    ]
    add_table(doc, fr7_headers, fr7_data, [1.2, 1.8, 3.8])

    add_h2(doc, "4.8. Phân hệ 8: Quản lý Kho vật tư & Thiết bị bưu chính (Supply Management)")
    fr8_headers = ["Mã Yêu Cầu", "Tên Chức Năng", "Mô Tả Chi Tiết Yêu Cầu & Tiêu Chí Chấp Nhận"]
    fr8_data = [
        ["FR-08.1", "Danh mục vật tư tiêu hao", "Quản lý số lượng tồn kho các loại vật tư: Bao tải Master Bag (khổ lớn/nhỏ), Dây kẹp chì nhựa/kim loại, Cuộn giấy in nhiệt A6/A7, Băng keo niêm phong."],
        ["FR-08.2", "Cấp phát trang thiết bị tài sản", "Lập phiếu xuất kho cấp phát súng quét mã vạch không dây, máy in nhiệt, điện thoại thông minh, đồng phục, thùng chở hàng xe máy cho từng bưu tá."],
        ["FR-08.3", "Thu hồi & Thanh lý thiết bị hỏng", "Quy trình thu hồi thiết bị khi nhân viên nghỉ việc hoặc thiết bị hỏng hóc cần sửa chữa, lập biên bản bàn giao có chữ ký điện tử."]
    ]
    add_table(doc, fr8_headers, fr8_data, [1.2, 1.8, 3.8])

    add_h2(doc, "4.9. Phân hệ 9: Tối ưu Tuyến đường VRP & Trợ lý ảo AI CSKH (Spring AI 2.0)")
    fr9_headers = ["Mã Yêu Cầu", "Tên Chức Năng", "Mô Tả Chi Tiết Yêu Cầu & Tiêu Chí Chấp Nhận"]
    fr9_data = [
        ["FR-09.1", "Tối ưu hóa điểm dừng (VRP/TSP)", "Thuật toán sắp xếp thứ tự các điểm dừng phát hàng tối ưu nhất cho bưu tá, tích hợp bản đồ số dẫn đường, giảm 25% thời gian và quãng đường di chuyển."],
        ["FR-09.2", "Trợ lý ảo CSKH AI (Spring AI 2.0)", "Ứng dụng mô hình ngôn ngữ lớn (LLM) tích hợp công nghệ Tool/Function Calling. Trợ lý AI có khả năng truy vấn trực tiếp CSDL để trả lời khách hàng về vị trí bưu gửi, thời gian giao dự kiến và giải đáp khiếu nại bằng tiếng Việt tự nhiên."],
        ["FR-09.3", "Dự báo thời gian giao hàng (AI ETA)", "Mô hình Machine Learning phân tích lịch sử thời gian các chặng, thời tiết, tình trạng giao thông để dự báo chính xác giờ bưu gửi đến tay người nhận."]
    ]
    add_table(doc, fr9_headers, fr9_data, [1.2, 1.8, 3.8])

    add_h2(doc, "4.10. Phân hệ 10: Giám sát Mạng lưới & Bản đồ Topology thời gian thực")
    fr10_headers = ["Mã Yêu Cầu", "Tên Chức Năng", "Mô Tả Chi Tiết Yêu Cầu & Tiêu Chí Chấp Nhận"]
    fr10_data = [
        ["FR-10.1", "Bản đồ Topology mạng lưới Hub-Spoke", "Hiển thị trực quan toàn bộ hệ thống Hub trung tâm, Bưu cục cấp 1-2-3 và các tuyến xe tải đường trục đang di chuyển trên bản đồ vệ tinh."],
        ["FR-10.2", "Cảnh báo nghẽn kho & Chậm chuyến", "Tự động phát cảnh báo màu đỏ khi số lượng bưu gửi tồn kho tại một Hub vượt quá 85% công suất thiết kế hoặc chuyến xe tải chậm quá 45 phút so với lịch trình SLA."]
    ]
    add_table(doc, fr10_headers, fr10_data, [1.2, 1.8, 3.8])

    doc.add_page_break()

    # --------------------------------------------------------------------------
    # CHƯƠNG 5: YÊU CẦU GIAO DIỆN VÀ TƯƠNG TÁC NGOẠI VI
    # --------------------------------------------------------------------------
    add_h1(doc, "CHƯƠNG 5: YÊU CẦU GIAO DIỆN VÀ TƯƠNG TÁC NGOẠI VI")

    add_h2(doc, "5.1. Giao diện người dùng (User Interfaces)")
    add_bullet(doc, "**Giao diện Quản trị Desktop:** Thiết kế theo phong cách Modern Dashboard với tông màu chủ đạo Xanh Navy (`#1F4E78`) và Đỏ Rikkei (`#C00000`). Bố cục linh hoạt: Sidebar điều hướng thông minh, Header hiển thị thông báo thời gian thực và thẻ Profile, nội dung trung tâm là bảng biểu phân trang và biểu đồ thống kê.")
    add_bullet(doc, "**Giao diện Di động Tác nghiệp (Mobile Web / PWA):** Tối ưu hóa 100% cho thao tác bằng một tay trên điện thoại: các nút bấm có chiều cao tối thiểu 44px, hỗ trợ cử chỉ vuốt (Swipe), tích hợp trực tiếp khung ngắm Camera quét mã vạch và giao diện ký tên cảm ứng mượt mà.")

    add_h2(doc, "5.2. Giao diện phần cứng ngoại vi (Hardware Interfaces)")
    add_bullet(doc, "**Máy in nhiệt khổ A6/A7:** Hỗ trợ lệnh in trực tiếp từ trình duyệt đến các dòng máy in nhiệt cuộn phổ biến như Xprinter XP-420B, HPRT SL42, Shinjuku, Gprinter qua cổng USB hoặc mạng LAN. Tốc độ render bản in < 200ms.")
    add_bullet(doc, "**Súng bắn mã vạch Barcode 1D/2D:** Tương thích với mọi đầu đọc mã vạch chuẩn HID Keyboard Wedge (cắm cổng USB hoặc kết nối Bluetooth không dây). Hỗ trợ chế độ quét liên tục không cần chạm bàn phím.")
    add_bullet(doc, "**Camera thiết bị di động:** Tích hợp thư viện quét mã `Html5Qrcode` tự động chọn camera sau (environment facing), tự động bật đèn Flash LED (Torch) trong điều kiện thiếu sáng và hỗ trợ nhận diện cả mã vạch 1D Code-128 cùng mã 2D QR Code.")

    add_h2(doc, "5.3. Giao diện truyền thông & Giao thức mạng (Communication Protocols)")
    add_bullet(doc, "**WebSocket STOMP over SockJS:** Kết nối thời gian thực tại endpoint `/ws-logistics`, sử dụng Topic `/topic/orders/{trackingCode}` và `/topic/dispatch/{dispatchCode}` để truyền phát trạng thái tức thì không cần reload trang.")
    add_bullet(doc, "**RESTful API JSON:** Chuẩn hóa toàn bộ request/response theo chuẩn `ApiResponse<T>` với mã lỗi chuẩn HTTP (200, 201, 400, 401, 403, 404, 500).")
    add_bullet(doc, "**Apache Kafka Event Bus:** Các sự kiện quan trọng (`order-created`, `bag-sealed`, `truck-departed`, `delivery-success`) được phát sinh vào các Topic Kafka tương ứng để các dịch vụ xử lý bất đồng bộ.")

    add_h2(doc, "5.4. Giao diện tích hợp bên thứ ba (Third-Party Integrations)")
    add_bullet(doc, "**Cổng thanh toán PayOS VietQR:** Tạo mã QR ngân hàng thanh toán chuẩn VietQR (NAPAS 24/7) và tiếp nhận Webhook xử lý giao dịch tự động.")
    add_bullet(doc, "**Cloudflare R2 Storage:** Lưu trữ phân tán ảnh hiện trường POD, chữ ký số và tài liệu đính kèm với băng thông tải về miễn phí (Zero Egress Fee).")
    add_bullet(doc, "**Google Maps Platform:** API Geocoding phân giải tọa độ địa chỉ, Directions API vẽ đường đi cho xe tải và Distance Matrix tính toán cự ly vận chuyển.")

    doc.add_page_break()

    # --------------------------------------------------------------------------
    # CHƯƠNG 6: THIẾT KẾ CƠ SỞ DỮ LIỆU & MÁY TRẠNG THÁI
    # --------------------------------------------------------------------------
    add_h1(doc, "CHƯƠNG 6: THIẾT KẾ CƠ SỞ DỮ LIỆU & MÁY TRẠNG THÁI")

    add_h2(doc, "6.1. Danh mục các bảng thực thể CSDL cốt lõi (Code-First Entities)")
    entity_headers = ["Tên Bảng (Table Name)", "Mục Đích Nghiệp Vụ", "Khóa Chính & Khóa Ngoại Trọng Yếu"]
    entity_data = [
        ["`users`", "Lưu trữ thông tin người dùng, nhân viên, bưu tá, tài xế, chủ shop.", "PK: `id`, UK: `username`, `phone_number`, `email`"],
        ["`roles`", "Danh mục các quyền tác nghiệp trong hệ thống.", "PK: `id`, UK: `role_name`"],
        ["`user_role`", "Bảng trung gian liên kết Many-to-Many giữa User và Role.", "PK/FK: `(user_id, role_id)`"],
        ["`warehouses`", "Danh mục Bưu cục (Spoke) và Trung tâm chia chọn (Hub).", "PK: `id`, UK: `code`, FK: `manager_id`, `province_id`"],
        ["`orders`", "Thực thể bưu gửi chuyển phát, thông tin người gửi/nhận, cước phí, COD.", "PK: `id`, UK: `tracking_code`, FK: `assigned_shipper_id`, `assigned_post_office_id`, `master_bag_id`"],
        ["`order_tracking_logs`", "Nhật ký hành trình chi tiết từng chặng thời gian, địa điểm, actor.", "PK: `id`, FK: `tracking_code`, `actor_id`, `location_id`"],
        ["`master_bags`", "Bao tải tổng gom kiện, kẹp chì an ninh Seal, tem A6.", "PK: `id`, UK: `bag_code`, `seal_code`, FK: `origin_warehouse_id`, `destination_warehouse_id`, `driver_id`, `truck_id`"],
        ["`dispatch_orders`", "Lệnh điều vận chuyến xe tải vận chuyển các bao Master Bag.", "PK: `id`, UK: `dispatch_code`, FK: `truck_id`, `driver_id`, `origin_warehouse_id`, `destination_warehouse_id`"],
        ["`trucks`", "Danh mục phương tiện xe tải vận tải đường trục và trung chuyển.", "PK: `id`, UK: `plate_number`, FK: `assigned_warehouse_id`"],
        ["`delivery_routes`", "Danh mục các tuyến vận tải đường trục liên tỉnh.", "PK: `id`, FK: `origin_warehouse_id`, `destination_warehouse_id`"],
        ["`attendance_records`", "Dữ liệu chấm công nhận diện khuôn mặt FaceID AI và GPS.", "PK: `id`, FK: `user_id`, `warehouse_id`"],
        ["`supply_items`", "Danh mục vật tư bưu chính (bao tải, chì seal, cuộn tem in).", "PK: `id`, UK: `item_code`, FK: `warehouse_id`"],
        ["`supply_tickets`", "Phiếu xuất kho cấp phát và thu hồi vật tư thiết bị.", "PK: `id`, UK: `ticket_code`, FK: `requested_by_id`, `approved_by_id`"]
    ]
    add_table(doc, entity_headers, entity_data, [1.8, 2.6, 2.6])

    add_h2(doc, "6.2. Máy trạng thái Vòng đời Đơn hàng (Order State Machine)")
    add_para(doc, "Bưu gửi trong hệ thống Rikkei Post vận hành nghiêm ngặt qua 12 trạng thái xác định:")
    
    state_headers = ["Mã Trạng Thái", "Tên Tiếng Việt", "Mô Tả Ý Nghĩa Nghiệp Vụ & Quyền Chuyển Tiếp"]
    state_data = [
        ["`CREATED`", "Đơn mới tạo", "Chủ shop vừa tạo đơn thành công, chờ bưu tá đến lấy hàng tại shop."],
        ["`PICKED_UP`", "Đã lấy hàng", "Bưu tá đã đến địa chỉ Shop, dùng camera quét mã nhận hàng thành công."],
        ["`AT_SORTING_HUB`", "Đang ở kho (Chờ phát)", "Kiện hàng đã được quét nhập kho bưu cục an toàn, sẵn sàng chia chọn hoặc xuất kho đi phát."],
        ["`IN_WAREHOUSE`", "Lưu kho", "Kiện hàng đang được lưu trữ an toàn trong kho bưu cục."],
        ["`IN_TRANSIT`", "Đang vận chuyển", "Kiện hàng đã được đóng vào bao Master Bag hoặc nạp lên xe tải vận chuyển liên tỉnh."],
        ["`DELIVERING`", "Đang mang đi giao", "Bưu tá đã quét mã xuất kho và đang trên đường giao bưu phẩm đến tay người nhận."],
        ["`DELIVERED`", "Giao thành công", "Người nhận đã nhận hàng, ký xác nhận POD điện tử và thanh toán COD. Đây là trạng thái kết thúc hoàn tất."],
        ["`DELIVERY_FAILED`", "Giao thất bại", "Bưu tá không liên lạc được với khách hoặc khách hẹn lại. Kiện hàng mang về bưu cục để nhập lại kho."],
        ["`RETURNING`", "Đang chuyển hoàn", "Đã phát thất bại đủ 3 lần hoặc khách từ chối nhận. Đơn hàng kích hoạt quy trình chuyển hoàn về Shop."],
        ["`RETURNED`", "Đã hoàn trả Shop", "Kiện hàng đã được hoàn trả thành công về tay người gửi. Trạng thái kết thúc."],
        ["`CANCELLED`", "Đã hủy đơn", "Chủ shop hoặc hệ thống hủy đơn trước khi bưu tá đến lấy hàng. Trạng thái kết thúc."],
        ["`LOST_DAMAGED`", "Thất lạc / Bồi thường", "Sự cố hàng hóa hư hỏng hoặc thất lạc trong quá trình vận chuyển, chuyển sang xử lý đền bù."]
    ]
    add_table(doc, state_headers, state_data, [1.7, 1.8, 3.5])

    doc.add_page_break()

    # --------------------------------------------------------------------------
    # CHƯƠNG 7: YÊU CẦU PHI CHỨC NĂNG (NON-FUNCTIONAL REQUIREMENTS - NFR)
    # --------------------------------------------------------------------------
    add_h1(doc, "CHƯƠNG 7: YÊU CẦU PHI CHỨC NĂNG (NON-FUNCTIONAL REQUIREMENTS - NFR)")

    add_h2(doc, "7.1. Hiệu năng & Khả năng chịu tải (Performance & Scalability)")
    add_bullet(doc, "**Thời gian phản hồi nghiệp vụ Inbound:** Thao tác quét mã vạch nhập kho bưu cục phản hồi trong vòng < 80ms.")
    add_bullet(doc, "**Độ trễ truyền thông WebSocket:** Thời gian từ lúc bưu tá cập nhật trạng thái đến khi màn hình khách hàng tự động nhảy trạng thái < 50ms.")
    add_bullet(doc, "**Khả năng chịu tải đồng thời:** Hệ thống xử lý mượt mà tối thiểu 2.000 requests/giây (RPS) và chịu tải xử lý trên 50.000 đơn hàng/ngày.")
    add_bullet(doc, "**Tối ưu hóa truy vấn CSDL:** Thiết lập chỉ mục B-Tree Index trên các cột tìm kiếm tần suất cao: `tracking_code`, `phone_number`, `current_status`, `assigned_shipper_id`.")

    add_h2(doc, "7.2. An toàn & Bảo mật thông tin (Security & Data Protection)")
    add_bullet(doc, "**Xác thực & Ủy quyền:** Toàn bộ API được bảo vệ bởi Spring Security với chuẩn JSON Web Token (JWT) mã hóa chữ ký HMAC-SHA256, mật khẩu băm một chiều bằng thuật toán BCrypt với độ phức tạp cao (Work Factor 10).")
    add_bullet(doc, "**Bảo mật truyền thông:** Áp dụng giao thức HTTPS/TLS 1.3 mã hóa toàn bộ dữ liệu trên đường truyền.")
    add_bullet(doc, "**Bảo mật dữ liệu nhạy cảm (Data Masking):** Số điện thoại người nhận được che bớt các số giữa (VD: `0987***222`) trên các màn hình hiển thị công khai để bảo vệ quyền riêng tư cá nhân.")

    add_h2(doc, "7.3. Độ tin cậy & Tính sẵn sàng (Reliability & Availability)")
    add_bullet(doc, "**Cam kết chỉ số SLA:** Hệ thống đảm bảo thời gian hoạt động ổn định (Uptime) tối thiểu 99.9% (không quá 8.76 giờ gián đoạn/năm).")
    add_bullet(doc, "**Tính toàn vẹn dữ liệu giao dịch:** Toàn bộ các thao tác tài chính (đối soát COD, thanh toán VietQR) và cập nhật trạng thái được bao bọc trong `@Transactional` của Spring với mức cô lập Isolation Level chuẩn.")

    add_h2(doc, "7.4. Chiến lược Sao lưu & Khôi phục Thảm họa (Backup & Disaster Recovery)")
    add_bullet(doc, "**Tự động sao lưu định kỳ:** Script CronJob chạy hàng ngày lúc 02:00 sáng tự động trích xuất bản sao lưu `pg_dump` nén chuẩn `.sql.gz`.")
    add_bullet(doc, "**Lưu trữ sao lưu đa tầng (3-2-1 Rule):** Bản sao lưu được lưu trữ tại ổ đĩa cục bộ, đẩy lên Cloudflare R2 / AWS S3 và tự động gửi email báo cáo trạng thái dung lượng cho Quản trị viên.")
    add_bullet(doc, "**Thời gian khôi phục mục tiêu (RTO & RPO):** RTO (Recovery Time Objective) < 30 phút; RPO (Recovery Point Objective) < 24 giờ.")

    # --------------------------------------------------------------------------
    # CHƯƠNG 8: TỔNG KẾT & PHÊ DUYỆT HỆ THỐNG
    # --------------------------------------------------------------------------
    add_h1(doc, "CHƯƠNG 8: TỔNG KẾT & PHÊ DUYỆT HỆ THỐNG")
    add_para(doc, "Tài liệu Đặc tả Yêu cầu Phần mềm (SRS) phiên bản 3.5.0 này phản ánh đầy đủ, chính xác và trung thực 100% các tính năng, quy tắc nghiệp vụ và tiêu chuẩn công nghệ đã được hiện thực hóa trong mã nguồn dự án **Rikkei Post**. Toàn bộ mã nguồn backend Java Spring Boot, frontend React và cấu trúc cơ sở dữ liệu PostgreSQL đã được kiểm thử tự động, biên dịch sạch sẽ và sẵn sàng bàn giao cho các cấp quản lý.")

    add_para(doc, "Mọi sự thay đổi về mặt nghiệp vụ trong tương lai bắt buộc phải tuân theo quy trình kiểm soát thay đổi (Change Control Process) và được cập nhật chính thức vào tài liệu này trước khi lập trình.")

    # Signature Table
    sig_headers = ["ĐẠI DIỆN ĐƠN VỊ NGHIÊN CỨU & PHÁT TRIỂN", "KIẾN TRÚC SƯ TRƯỞNG & TÁC GIẢ CHÍNH"]
    sig_data = [
        ["\n\n\n\n___________________________________\nBan Giám Đốc R&D — Rikkei Education",
         "\n\n\n\n___________________________________\nNguyễn Công Hưởng\n(Lead Fullstack, Cloud & AI Architect)"]
    ]
    add_table(doc, sig_headers, sig_data, [3.5, 3.5])

    # Output file path
    output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "Tai_Lieu_Dac_Ta_SRS.docx")
    doc.save(output_path)
    print(f"Document generated successfully at: {output_path}")

if __name__ == "__main__":
    build_srs_document()
