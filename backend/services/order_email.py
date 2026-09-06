"""
Order confirmation email builder (admin + customer).

Single source of truth for:
- Admin order notification (screenshot, products, video info, blue/green buttons)
- Customer order confirmation (screenshot, products, video info, blue/green buttons)

Used by: create_checkout_session, success() fallback, Stripe webhook.
Do not edit app.py email HTML; edit this module only.
"""
import json
import logging
from html import escape
from urllib.parse import quote

logger = logging.getLogger(__name__)

PRINT_QUALITY_BASE_URL = "https://screenmerch.fly.dev/print-quality"
EDIT_TOOLS_BASE_URL = "https://screenmerch.com/tools"
# Inline base64 shows IN the email body (e.g. Proton); CID shows as attachment only. Prefer inline when small so body shows the image.
MAX_INLINE_BASE64_LEN = 100000  # Inline in body when under ~100KB; over that use cid (attachment)


def get_item_tool_settings(item):
    if not isinstance(item, dict):
        return {}
    ts = item.get("toolSettings")
    return ts if isinstance(ts, dict) else {}


def get_item_image_orientation(item):
    """Portrait/landscape from the shopper's checkout/Tools choice (defaults to portrait)."""
    ts = get_item_tool_settings(item)
    for raw in (
        ts.get("imageOrientation"),
        item.get("image_orientation") if isinstance(item, dict) else None,
        item.get("imageOrientation") if isinstance(item, dict) else None,
    ):
        val = str(raw or "").strip().lower()
        if val == "landscape":
            return "landscape"
        if val == "portrait":
            return "portrait"
    return "portrait"


def orientation_display_label(orientation):
    return "Landscape" if str(orientation).strip().lower() == "landscape" else "Portrait"


def _flag_on(value):
    return value is True or value == 1 or str(value).strip().lower() in ("true", "1")


def item_has_baked_edits(item):
    """True when Tools already baked a frame/feather/crop into the stored screenshot."""
    if not isinstance(item, dict):
        return False
    if item.get("edited"):
        return True
    ts = get_item_tool_settings(item)
    if _flag_on(ts.get("frameEnabled")):
        return True
    try:
        if float(ts.get("featherEdge") or 0) > 0 or float(ts.get("cornerRadius") or 0) > 0:
            return True
    except (TypeError, ValueError):
        pass
    if _flag_on(ts.get("textEnabled")) and str(ts.get("textContent") or "").strip():
        return True
    orig = str(item.get("original_screenshot") or item.get("originalScreenshot") or "").strip()
    shot = str(_get_item_screenshot(item) or "").strip()
    return bool(orig and shot and orig != shot)


def _num(value, default=0):
    try:
        if value is None or value == "":
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _px_pair(x, y):
    a = round(_num(x), 1)
    b = round(_num(y), 1)
    if a == b:
        return f"{a:g}px"
    return f"{a:g}px H × {b:g}px V"


def item_edit_log(item):
    """Structured edit recipe from toolSettings.editLog or flat toolSettings."""
    ts = get_item_tool_settings(item)
    log = ts.get("editLog") if isinstance(ts.get("editLog"), dict) else {}
    src = log or ts
    feather = _num(src.get("featherPercent", src.get("featherEdge")))
    corner = _num(src.get("cornerRadiusPercent", src.get("cornerRadius")))
    text_on = _flag_on(src.get("textEnabled")) and str(src.get("textContent") or "").strip()
    fit = str(src.get("printAreaFit") or "").strip()
    orientation = str(src.get("imageOrientation") or get_item_image_orientation(item) or "portrait").lower()
    has_entries = bool(
        feather > 0
        or corner > 0
        or _flag_on(src.get("frameEnabled"))
        or _flag_on(src.get("blackAndWhite"))
        or _flag_on(src.get("featherFadeEnabled"))
        or text_on
        or orientation == "landscape"
        or (fit and fit != "none")
    )
    if not has_entries:
        return None
    return {
        "imageWidth": int(_num(src.get("imageWidth"))),
        "imageHeight": int(_num(src.get("imageHeight"))),
        "printWidth": int(_num(src.get("printWidth"))),
        "printHeight": int(_num(src.get("printHeight"))),
        "featherPercent": feather,
        "featherPxX": _num(src.get("featherPxX")),
        "featherPxY": _num(src.get("featherPxY")),
        "featherPrintPxX": _num(src.get("featherPrintPxX")),
        "featherPrintPxY": _num(src.get("featherPrintPxY")),
        "cornerRadiusPercent": corner,
        "cornerRadiusPx": _num(src.get("cornerRadiusPx")),
        "cornerRadiusPrintPx": _num(src.get("cornerRadiusPrintPx")),
        "frameEnabled": _flag_on(src.get("frameEnabled")),
        "frameColor": str(src.get("frameColor") or "#FF0000"),
        "frameWidthPx": _num(src.get("frameWidthPx", src.get("frameWidth"))),
        "frameWidthPrintPx": _num(src.get("frameWidthPrintPx")),
        "doubleFrame": _flag_on(src.get("doubleFrame")),
        "blackAndWhite": _flag_on(src.get("blackAndWhite")),
        "featherFadeEnabled": _flag_on(src.get("featherFadeEnabled")),
        "featherFadeColor": "black" if str(src.get("featherFadeColor") or "").strip().lower() == "black" else "white",
        "textEnabled": bool(text_on),
        "textContent": str(src.get("textContent") or "").strip(),
        "textFont": str(src.get("textFont") or "Arial"),
        "textColor": str(src.get("textColor") or "#000000"),
        "textSize": _num(src.get("textSize"), 24),
        "textOffsetX": _num(src.get("textOffsetX"), 50),
        "textOffsetY": _num(src.get("textOffsetY"), 50),
        "printAreaFit": fit or "none",
        "imageOrientation": "landscape" if orientation == "landscape" else "portrait",
        "imageOffsetX": _num(src.get("imageOffsetX", src.get("offsetX"))),
        "imageOffsetY": _num(src.get("imageOffsetY", src.get("offsetY"))),
        "screenshotScale": _num(src.get("screenshotScale"), 100),
        "selectedProductName": str(src.get("selectedProductName") or ""),
    }


def format_item_edit_log_rows(log):
    if not log:
        return []
    rows = []
    img_w, img_h = log.get("imageWidth") or 0, log.get("imageHeight") or 0
    if img_w and img_h:
        rows.append(("Edited image", f"{int(img_w)} × {int(img_h)} px"))
    print_w, print_h = log.get("printWidth") or 0, log.get("printHeight") or 0
    if print_w and print_h:
        rows.append(("300 DPI target", f"{int(print_w)} × {int(print_h)} px"))
    rows.append(("Orientation", "Landscape" if log.get("imageOrientation") == "landscape" else "Portrait"))
    if log.get("selectedProductName"):
        rows.append(("Product", str(log.get("selectedProductName"))))
    fit = str(log.get("printAreaFit") or "")
    if fit and fit != "none":
        rows.append(("Fit", "Product specific" if fit == "product" else fit))
    scale = _num(log.get("screenshotScale"), 100)
    if scale and scale != 100:
        rows.append(("Screenshot size", f"{scale:g}%"))
    ox, oy = _num(log.get("imageOffsetX")), _num(log.get("imageOffsetY"))
    if ox or oy:
        rows.append(("Offset", f"H {ox:g}% · V {oy:g}%"))
    feather = _num(log.get("featherPercent"))
    if feather > 0:
        baked = _px_pair(log.get("featherPxX"), log.get("featherPxY"))
        print_px = ""
        if _num(log.get("featherPrintPxX")) or _num(log.get("featherPrintPxY")):
            print_px = f" → 300 DPI {_px_pair(log.get('featherPrintPxX'), log.get('featherPrintPxY'))}"
        fade = ""
        if log.get("featherFadeEnabled"):
            fade = " · fade black" if str(log.get("featherFadeColor") or "").strip().lower() == "black" else " · fade white"
        rows.append(("Feather", f"{feather:g}% ({baked}{print_px}){fade}"))
    corner = _num(log.get("cornerRadiusPercent"))
    if corner > 0:
        baked_px = round(_num(log.get("cornerRadiusPx")), 1)
        print_corner = round(_num(log.get("cornerRadiusPrintPx")), 1)
        circle = " · circle" if corner >= 100 else ""
        print_bit = f" → 300 DPI {print_corner:g}px" if print_corner else ""
        rows.append(("Corner", f"{corner:g}% ({baked_px:g}px{print_bit}){circle}"))
    if log.get("frameEnabled"):
        print_frame = ""
        if _num(log.get("frameWidthPrintPx")):
            print_frame = f" → 300 DPI {round(_num(log.get('frameWidthPrintPx')), 1):g}px"
        dbl = " · double" if log.get("doubleFrame") else ""
        rows.append((
            "Frame",
            f"{round(_num(log.get('frameWidthPx')), 1):g}px {log.get('frameColor') or ''}{print_frame}{dbl}".strip(),
        ))
    if log.get("blackAndWhite"):
        rows.append(("Color", "Black and white"))
    if log.get("textEnabled") and log.get("textContent"):
        snippet = str(log.get("textContent"))
        if len(snippet) > 60:
            snippet = snippet[:57] + "..."
        rows.append((
            "Text",
            f'"{snippet}" · {log.get("textFont") or "Arial"} · {log.get("textColor") or "#000"} · {int(_num(log.get("textSize"), 24))}px',
        ))
    return rows


def format_item_edit_log_html(item):
    """HTML block so admin can replay Tools after generating 300 DPI from the original."""
    log = item_edit_log(item)
    rows = format_item_edit_log_rows(log)
    if not rows:
        return ""
    lines = [
        "<div style='margin:10px 0 0 0;padding:10px;background:#fff7ed;border:1px solid #fd7e14;border-radius:6px;'>",
        "<p style='margin:0 0 6px 0;font-weight:bold;color:#c2410c;'>Edit log — generate 300 DPI from the original, then replicate:</p>",
    ]
    for label, value in rows:
        lines.append(
            f"<p style='margin:0 0 4px 0;font-size:13px;line-height:1.4;'><strong>{escape(str(label))}:</strong> {escape(str(value))}</p>"
        )
    lines.append("</div>")
    return "".join(lines)



def orientation_layout_aspect(orientation):
    """Match print-quality cover-crop: shirt chest vs wide landscape band."""
    if str(orientation).strip().lower() == "landscape":
        return 1.5
    return 11.5 / 13.8


def _cover_crop_pil_image(img, aspect):
    w, h = img.size
    if w <= 0 or h <= 0 or not aspect or aspect <= 0:
        return img
    current = w / float(h)
    if abs(current - aspect) < 0.03:
        return img
    if current > aspect:
        new_w = max(1, int(round(h * aspect)))
        x = max(0, (w - new_w) // 2)
        return img.crop((x, 0, x + new_w, h))
    new_h = max(1, int(round(w / aspect)))
    y = max(0, (h - new_h) // 2)
    return img.crop((0, y, w, y + new_h))


def layout_screenshot_for_orientation(screenshot, orientation):
    """Cover-crop a data-URL or fetched image so email/order previews match the chosen layout."""
    if not screenshot or not isinstance(screenshot, str) or not screenshot.strip():
        return screenshot
    img_data = screenshot.strip()
    if img_data.startswith(("http://", "https://")):
        fetched = _fetch_image_as_base64(img_data)
        if not fetched:
            return screenshot
        img_data = fetched
    if "data:image" not in img_data or "," not in img_data:
        return screenshot
    try:
        import base64
        from io import BytesIO
        from PIL import Image
        header, b64 = img_data.split(",", 1)
        raw = base64.b64decode(b64)
        img = Image.open(BytesIO(raw))
        if img.mode not in ("RGB", "RGBA"):
            img = img.convert("RGBA") if "A" in (img.mode or "") else img.convert("RGB")
        cropped = _cover_crop_pil_image(img, orientation_layout_aspect(orientation))
        out = BytesIO()
        if cropped.mode == "RGBA":
            cropped.save(out, "PNG", optimize=True)
            mime = "image/png"
        else:
            cropped = cropped.convert("RGB")
            cropped.save(out, "JPEG", quality=85, optimize=True)
            mime = "image/jpeg"
        encoded = base64.b64encode(out.getvalue()).decode("ascii")
        return f"data:{mime};base64,{encoded}"
    except Exception as e:
        logger.warning("Failed to layout screenshot for %s: %s", orientation, e)
        return screenshot


def _fetch_image_as_base64(url, timeout=10):
    """Fetch image from HTTP(S) URL and return as data:image/...;base64,... or None on failure."""
    if not url or not isinstance(url, str) or not url.strip().startswith(("http://", "https://")):
        return None
    try:
        import requests
        resp = requests.get(url, timeout=timeout)
        resp.raise_for_status()
        content_type = (resp.headers.get("Content-Type") or "").split(";")[0].strip().lower()
        if not content_type.startswith("image/"):
            content_type = "image/png"
        b64 = __import__("base64").b64encode(resp.content).decode("ascii")
        return f"data:{content_type};base64,{b64}"
    except Exception as e:
        logger.warning("Failed to fetch screenshot URL for email attachment: %s", e)
        return None


def _compress_for_inline(data_url, max_bytes=95000, max_width=600):
    """Compress base64 image to fit under max_bytes so it can be inlined in email body (e.g. Proton). Returns data:image/jpeg;base64,... or None."""
    if not data_url or "data:image" not in data_url or "," not in data_url:
        return None
    try:
        import base64
        from io import BytesIO
        header, b64 = data_url.split(",", 1)
        raw = base64.b64decode(b64)
        from PIL import Image
        img = Image.open(BytesIO(raw)).convert("RGB")
        w, h = img.size
        if w > max_width:
            ratio = max_width / w
            img = img.resize((max_width, int(h * ratio)), Image.Resampling.LANCZOS)
        out = BytesIO()
        quality = 85
        while quality >= 50:
            out.seek(0)
            out.truncate(0)
            img.save(out, "JPEG", quality=quality, optimize=True)
            if out.tell() <= max_bytes:
                break
            quality -= 10
        b64_out = base64.b64encode(out.getvalue()).decode("ascii")
        return f"data:image/jpeg;base64,{b64_out}"
    except Exception as e:
        logger.warning("Failed to compress screenshot for inline: %s", e)
        return None


def get_order_screenshot(order_data, cart):
    """Get screenshot and timestamp from order-level or cart items.
    Uses selected_screenshot first so the user's chosen image (thumbnail or captured frame) is shown.
    Falls back to thumbnail / any cart item image so the email always shows an image when available.
    """
    order_data = order_data or {}
    cart = cart or []
    if isinstance(cart, str):
        try:
            cart = json.loads(cart) if cart.strip() else []
        except Exception:
            cart = []
    if not isinstance(cart, list):
        cart = []
    screenshot = (
        order_data.get("selected_screenshot")
        or order_data.get("thumbnail")
        or order_data.get("screenshot")
        or ""
    )
    if not screenshot and cart and isinstance(cart[0], dict):
        first = cart[0]
        screenshot = (
            first.get("selected_screenshot")
            or first.get("screenshot")
            or first.get("img")
            or first.get("thumbnail")
            or ""
        )
    # Fallback: scan all cart items for any image (same logic that made thumbnail show before)
    if not screenshot and cart:
        for item in cart:
            if not isinstance(item, dict):
                continue
            candidate = (
                item.get("selected_screenshot")
                or item.get("screenshot")
                or item.get("img")
                or item.get("thumbnail")
                or ""
            )
            if candidate and isinstance(candidate, str) and candidate.strip():
                screenshot = candidate
                break
    # Last resort: order-level thumbnail (e.g. video thumbnail stored at order level)
    if not screenshot:
        screenshot = order_data.get("thumbnail") or order_data.get("screenshot") or ""
    # Final fallback: only check known screenshot keys (avoid picking wrong image from other fields)
    known_keys = ("selected_screenshot", "screenshot", "img", "thumbnail")
    if not (screenshot and str(screenshot).strip()):
        for d in [order_data] + [x for x in cart if isinstance(x, dict)]:
            for key in known_keys:
                v = (d or {}).get(key)
                if isinstance(v, str) and v.strip() and (
                    v.strip().startswith("data:image") or v.strip().startswith(("http://", "https://"))
                ):
                    screenshot = v
                    break
            if screenshot:
                break
    ts = (
        order_data.get("screenshot_timestamp")
        or order_data.get("timestamp")
        or (cart[0].get("timestamp") if cart and isinstance(cart[0], dict) else None)
        or "Not provided"
    )
    if ts is not None:
        ts = str(ts)
    else:
        ts = "Not provided"
    return (screenshot or "", ts)


def _screenshot_img_html(screenshot_str, cid=None, orientation="portrait"):
    """Build the screenshot img tag. Size follows the shopper's portrait/landscape choice."""
    if not screenshot_str or not isinstance(screenshot_str, str) or not screenshot_str.strip():
        return "<p><em>Screenshot available in order details</em></p>"
    layout = "landscape" if str(orientation).strip().lower() == "landscape" else "portrait"
    if layout == "landscape":
        size_style = "max-width: 320px; width: 320px; height: auto;"
    else:
        size_style = "max-width: 210px; width: 210px; height: auto;"
    style = f"{size_style} border-radius: 6px; border: 1px solid #ddd; display: block;"
    if cid:
        return f"<img src='cid:{cid}' alt='Product Screenshot' style='{style}'>"
    if screenshot_str.startswith("data:image") and len(screenshot_str) < MAX_INLINE_BASE64_LEN:
        safe_src = screenshot_str.replace('"', "&quot;")
        return f'<img src="{safe_src}" alt="Product Screenshot" style="{style}">'
    if screenshot_str.startswith("http"):
        return f"<img src='{screenshot_str}' alt='Product Screenshot' style='{style}'>"
    return "<p><em>Screenshot available in order details</em></p>"


def _screenshot_attachments(order_id, screenshot_str, index=0):
    """Build Resend attachments list for one screenshot. Returns (attachments, cid_or_none)."""
    attachments = []
    cid = None
    if not screenshot_str or not isinstance(screenshot_str, str) or "data:image" not in screenshot_str:
        return (attachments, cid)
    try:
        header, b64_content = screenshot_str.split(",", 1)
        image_format = header.split("/")[1].split(";")[0]
        ext = "jpeg" if image_format.lower() in ("jpg", "jpeg") else image_format
        content_type = f"image/{'jpeg' if image_format.lower() in ('jpg', 'jpeg') else image_format}"
        safe_id = "".join(c if c.isalnum() or c in "-_" else "_" for c in str(order_id))
        filename = f"screenshot_{safe_id}_{index}.{ext}"
        cid = f"screenshot_{order_id}_{index}"
        attachments.append({
            "filename": filename,
            "content": b64_content,
            "cid": cid,
            "content_type": content_type,
        })
    except Exception as e:
        logger.warning("Failed to build screenshot attachment: %s", e)
    return (attachments, cid)


def _get_item_screenshot(item, fallback=None):
    """Get screenshot from a cart item (selected_screenshot, screenshot, img, thumbnail)."""
    if not item or not isinstance(item, dict):
        return fallback or ""
    return (
        item.get("selected_screenshot")
        or item.get("screenshot")
        or item.get("img")
        or item.get("thumbnail")
        or ""
    ) or (fallback or "")


def build_admin_order_email(order_id, order_data, cart, order_number, total_amount, screenshot_timestamp_override=None):
    """
    Build admin order notification HTML and optional attachments.
    Shows one screenshot per product in the email body. Returns (html_body, attachments).
    """
    order_screenshot, ts = get_order_screenshot(order_data, cart)
    if screenshot_timestamp_override is not None:
        ts = str(screenshot_timestamp_override)

    # Fetch URL screenshots to base64 for email
    def _ensure_base64(img):
        if not img or not isinstance(img, str) or not img.strip():
            return img
        if img.strip().startswith(("http://", "https://")):
            return _fetch_image_as_base64(img) or img
        return img

    # Build per-product screenshot HTML and optional attachments (first screenshot as main attachment for compatibility)
    attachments = []
    print_url = f"{PRINT_QUALITY_BASE_URL}?order_id={order_id}"
    edit_tools_url = f"{EDIT_TOOLS_BASE_URL}?order_id={order_id}"
    admin_orders_url = "https://screenmerch.fly.dev/admin/orders"
    # After login, land on full customer/order detail (not the HTML table which ignores ?order_id=)
    order_details_path = f"/admin/order/{order_id}"
    order_details_url = (
        f"https://screenmerch.fly.dev/admin/login?next={quote(order_details_path, safe='')}"
    )

    # Tools block FIRST (immediately after title) so it is never clipped or missing in any client
    html = f"<h1>🛍️ New ScreenMerch Order #{order_number}</h1>"
    html += "<!-- ORDER TOOLS BLOCK - keep at top -->"
    html += f"<p><strong>Open order &amp; tools (no login):</strong> <a href=\"{print_url}\">{print_url}</a></p>"
    html += f"<p style=\"margin: 12px 0 6px 0; font-size: 14px;\"><strong>Quick links:</strong> "
    html += f"<a href=\"{print_url}\">Generate 300 DPI</a> &middot; "
    html += f"<a href=\"{edit_tools_url}\">Edit Tools</a> &middot; "
    html += f"<a href=\"{order_details_url}\">Order Details</a> &middot; "
    html += f"<a href=\"{admin_orders_url}\">View All Orders</a></p>"
    html += f"<p style=\"margin: 16px 0 8px 0;\"><strong>Quick actions:</strong></p>"
    html += f"""<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 8px 0;"><tr>
<td style="padding: 4px 6px 4px 0;"><a href="{print_url}" style="background:#28a745;color:white;padding:10px 16px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block;">Generate 300 DPI Image</a></td>
<td style="padding: 4px 6px;"><a href="{edit_tools_url}" style="background:#fd7e14;color:white;padding:10px 16px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block;">Edit Tools</a></td>
<td style="padding: 4px 6px;"><a href="{order_details_url}" style="background:#17a2b8;color:white;padding:10px 16px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block;">Order Details</a></td>
<td style="padding: 4px 6px;"><a href="{admin_orders_url}" style="background:#6c757d;color:white;padding:10px 16px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block;">View All Orders</a></td>
</tr></table>"""
    html += "<p style=\"margin: 12px 0 0 0; font-size: 13px; color: #555;\">Green = 300 DPI. Orange = Edit Tools. Teal = this order. Gray = admin.</p>"
    html += "<hr style=\"margin: 16px 0;\">"
    html += f"<p><strong>Order ID:</strong> {order_id}</p>"
    html += f"<p><strong>Items:</strong> {len(cart)}</p>"
    html += f"<p><strong>Total Value:</strong> ${total_amount:.2f}</p>"
    html += "<hr style=\"margin: 16px 0;\">"
    html += "<h2>🛍️ Products</h2>"

    fallback_screenshot = order_screenshot
    if fallback_screenshot and isinstance(fallback_screenshot, str) and fallback_screenshot.strip().startswith(("http://", "https://")):
        fallback_screenshot = _fetch_image_as_base64(fallback_screenshot) or fallback_screenshot

    for idx, item in enumerate(cart):
        product_name = item.get("product", "N/A")
        color = (item.get("variants") or {}).get("color", "N/A")
        size = (item.get("variants") or {}).get("size", "N/A")
        note = item.get("note", "None")
        price = item.get("price", 0)
        tool_settings = get_item_tool_settings(item)
        image_orientation = get_item_image_orientation(item)
        orient_label = orientation_display_label(image_orientation)
        text_enabled = tool_settings.get("textEnabled", False) and (tool_settings.get("textContent") or "").strip()
        text_line = ""
        if text_enabled:
            tc = (tool_settings.get("textContent") or "").strip()[:50]
            if len((tool_settings.get("textContent") or "").strip()) > 50:
                tc += "..."
            text_line = f"<p><strong>Text:</strong> {escape(tc)} (font: {escape(str(tool_settings.get('textFont', 'Arial')))}, color: {escape(str(tool_settings.get('textColor', '#000000')))}, size: {tool_settings.get('textSize', 24)}px)</p>"
        edit_log_html = format_item_edit_log_html(item)
        # Per-product screenshot (item's selected_screenshot or fallback to order/first)
        item_img = _get_item_screenshot(item, fallback=fallback_screenshot)
        item_img = _ensure_base64(item_img)
        # Framed/edited screenshots already match the Tools print box. Cover-cropping
        # again clips the left/right border and makes vertical thickness look thinner.
        if not item_has_baked_edits(item):
            item_img = layout_screenshot_for_orientation(item_img, image_orientation)
        # Compress for inline so each product's screenshot shows in body
        screenshot_for_body = item_img
        if item_img and isinstance(item_img, str) and "data:image" in item_img:
            for max_bytes, max_width in [(95000, 600), (80000, 500), (60000, 400), (45000, 320), (35000, 280)]:
                compressed = _compress_for_inline(item_img, max_bytes=max_bytes, max_width=max_width)
                if compressed and len(compressed) < MAX_INLINE_BASE64_LEN:
                    screenshot_for_body = compressed
                    break
        product_img_tag = _screenshot_img_html(screenshot_for_body, cid=None, orientation=image_orientation)
        # One attachment for first product only (so email has at least one attachment for clients that strip inline)
        if idx == 0 and item_img and "data:image" in str(item_img):
            atts, _ = _screenshot_attachments(order_id, item_img, index=0)
            if atts:
                attachments.extend(atts[:1])
        html += f"""
            <div style='border: 1px solid #ddd; padding: 15px; margin-bottom: 20px; border-radius: 8px;'>
                <p style='margin-top:0;'><strong>📸 {product_name} — Screenshot</strong></p>
                {product_img_tag}
                <p><strong>Image:</strong> {orient_label}</p>
                {text_line}
                {edit_log_html}
                <p><strong>Color:</strong> {color}</p>
                <p><strong>Size:</strong> {size}</p>
                <p><strong>Note:</strong> {note}</p>
                <p><strong>Price:</strong> ${price:.2f}</p>
            </div>
        """
        # Next item's fallback can be this item's image if we only had one so far
        if item_img and not fallback_screenshot:
            fallback_screenshot = item_img
    html += "<hr>"
    html += "<h2>📹 Video Information</h2>"
    html += f"<p><strong>Video Title:</strong> {order_data.get('video_title', 'Unknown Video')}</p>"
    html += f"<p><strong>Creator:</strong> {order_data.get('creator_name', 'Unknown Creator')}</p>"
    video_url = order_data.get('video_url') or ''
    if video_url and str(video_url).strip().startswith('http'):
        html += f"<p><strong>Video URL:</strong> <a href=\"{video_url}\">View video</a></p>"
    html += f"<p><strong>Screenshot Timestamp:</strong> {ts}</p>"
    html += "<hr style=\"margin: 16px 0;\">"
    html += "<p style=\"margin: 0; font-size: 12px; color: #666;\">This is an automated notification from ScreenMerch.</p>"
    # Cap to one attachment so email size stays reasonable; body already shows all product screenshots inline
    attachments = attachments[:1]
    return (html, attachments)


def build_customer_order_email(order_id, order_data, cart, order_number, total_amount, shipping_cost=0, shipping_address=None):
    """Build customer order confirmation HTML (no attachments)."""
    screenshot, ts = get_order_screenshot(order_data, cart)
    subtotal = total_amount - shipping_cost

    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #333;">🎉 Thank You for Your Order!</h1>
        <p>Hi there,</p>
        <p>We've received your order and are getting it ready for you!</p>
        
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="margin-top: 0; color: #333;">Order Details</h2>
            <p><strong>Order Number:</strong> #{order_number}</p>
            <p><strong>Order ID:</strong> {order_id}</p>
            <p><strong>Items:</strong> {len(cart)}</p>
            <p><strong>Subtotal:</strong> ${subtotal:.2f}</p>
            <p><strong>Shipping:</strong> ${shipping_cost:.2f}</p>
            <p><strong style="font-size: 18px;">Total:</strong> <strong style="font-size: 18px; color: #007bff;">${total_amount:.2f}</strong></p>
        </div>
    """
    html += """
        <h2 style="color: #333;">🛍️ Products</h2>
    """
    first_orientation = get_item_image_orientation(cart[0]) if cart else "portrait"
    # Order screenshot first under Products (same spot as admin email – red box area)
    if screenshot and isinstance(screenshot, str) and screenshot.strip():
        first_item = cart[0] if cart and isinstance(cart[0], dict) else {}
        laid_out = screenshot
        if laid_out.strip().startswith(("http://", "https://")):
            laid_out = _fetch_image_as_base64(laid_out) or laid_out
        if not item_has_baked_edits(first_item):
            laid_out = layout_screenshot_for_orientation(laid_out, first_orientation)
        if laid_out and isinstance(laid_out, str) and "data:image" in laid_out and len(laid_out) >= MAX_INLINE_BASE64_LEN:
            for max_bytes, max_width in [(95000, 600), (80000, 500), (60000, 400), (45000, 320), (35000, 280)]:
                compressed = _compress_for_inline(laid_out, max_bytes=max_bytes, max_width=max_width)
                if compressed and len(compressed) < MAX_INLINE_BASE64_LEN:
                    laid_out = compressed
                    break
        product_img_tag = _screenshot_img_html(laid_out, cid=None, orientation=first_orientation)
        html += f'<div style="border: 1px solid #ddd; padding: 15px; margin-bottom: 20px; border-radius: 8px;"><p style="margin-top:0;"><strong>📸 Order Screenshot</strong></p>{product_img_tag}</div>'
    else:
        html += '<div style="border: 1px solid #ddd; padding: 15px; margin-bottom: 20px; border-radius: 8px;"><p style="margin-top:0;"><strong>📸 Order Screenshot</strong></p><p><em>Screenshot available in order details</em></p></div>'
    for item in cart:
        product_name = item.get("product", "N/A")
        color = (item.get("variants") or {}).get("color", "N/A")
        size = (item.get("variants") or {}).get("size", "N/A")
        price = item.get("price", 0)
        note = item.get("note", "")
        tool_settings = get_item_tool_settings(item)
        image_orientation = get_item_image_orientation(item)
        orient_label = orientation_display_label(image_orientation)
        text_enabled = tool_settings.get("textEnabled", False) and (tool_settings.get("textContent") or "").strip()
        text_p = ""
        if text_enabled:
            tc = (tool_settings.get("textContent") or "").strip()[:50]
            if len((tool_settings.get("textContent") or "").strip()) > 50:
                tc += "..."
            text_p = f'<p><strong>Text:</strong> {tc} (font: {tool_settings.get("textFont", "Arial")}, size: {tool_settings.get("textSize", 24)}px)</p>'
        note_p = f'<p><strong>Note:</strong> {note}</p>' if note else ''
        html += f"""
        <div style="border: 1px solid #ddd; padding: 15px; margin-bottom: 15px; border-radius: 8px;">
            <h3 style="margin-top: 0; color: #333;">{product_name}</h3>
            <p><strong>Image:</strong> {orient_label}</p>
            {text_p}
            <p><strong>Color:</strong> {color}</p>
            <p><strong>Size:</strong> {size}</p>
            <p><strong>Price:</strong> ${price:.2f}</p>
            {note_p}
        </div>
        """
    # Video information
    video_title = order_data.get("video_title") or "Unknown Video"
    creator = order_data.get("creator_name") or "Unknown Creator"
    video_url = order_data.get("video_url") or ""
    video_url_line = f'<p><strong>Video URL:</strong> <a href="{video_url}">View video</a></p>' if (video_url and str(video_url).startswith("http")) else ""
    html += f"""
        <div style="background: #e7f3ff; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #333;">📹 Video Information</h3>
            <p><strong>Video Title:</strong> {video_title}</p>
            <p><strong>Creator:</strong> {creator}</p>
            <p><strong>Screenshot Timestamp:</strong> {ts}</p>
            {video_url_line}
        </div>
    """
    # Open Print & Image Tools (no login) + Generate 300 DPI
    print_url = f"{PRINT_QUALITY_BASE_URL}?order_id={order_id}"
    html += f"""
        <div style="margin: 25px 0; padding: 20px 0; border-top: 1px solid #ddd;">
            <p style="margin-bottom: 15px;"><strong>Next steps:</strong></p>
            <p style="margin: 10px 0;">
                <a href="{print_url}" style="background: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; margin-right: 10px;">Open Print & Image Tools (no login)</a>
                <a href="{print_url}" style="background: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Generate 300 DPI Image</a>
            </p>
            <p style="color: #666; font-size: 14px;">Use either button to open your order and create 300 DPI images — no login required.</p>
        </div>
    """
    if shipping_address:
        name = shipping_address.get("name", "")
        line1 = shipping_address.get("line1", "")
        line2 = shipping_address.get("line2", "")
        city = shipping_address.get("city", "")
        state = shipping_address.get("state", "")
        postal = shipping_address.get("postal_code", "")
        country = shipping_address.get("country", "")
        line2_br = line2 + "<br>" if line2 else ""
        html += f"""
        <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #333;">📦 Shipping Address</h3>
            <p>{name}<br>{line1}<br>{line2_br}{city}, {state} {postal}<br>{country}</p>
        </div>
        """
    html += """
        <p style="margin-top: 30px;">We'll send you another email when your order ships!</p>
        <p>If you have any questions, please don't hesitate to reach out to us.</p>
        <p>Best regards,<br>The ScreenMerch Team</p>
        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
        <p style="color: #666; font-size: 12px;">This is an automated confirmation email. Please do not reply to this email.</p>
    </div>
    """
    return html


def resend_attachments_from_builder(attachments):
    """Convert builder attachments to Resend API format (contentId, contentType)."""
    out = []
    for att in attachments:
        r = {"filename": att.get("filename", "screenshot.png"), "content": att.get("content", "")}
        if att.get("content_type"):
            r["contentType"] = att["content_type"]
        if att.get("cid"):
            r["contentId"] = att["cid"]
        out.append(r)
    return out
