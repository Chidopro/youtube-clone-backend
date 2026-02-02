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

logger = logging.getLogger(__name__)

PRINT_QUALITY_BASE_URL = "https://screenmerch.fly.dev/print-quality"
# Inline base64 shows IN the email body (e.g. Proton); CID shows as attachment only. Prefer inline when small so body shows the image.
MAX_INLINE_BASE64_LEN = 100000  # Inline in body when under ~100KB; over that use cid (attachment)


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


def _screenshot_img_html(screenshot_str, cid=None):
    """Build the single 'Order Screenshot' block. Prefer CID (attachment) so Proton Mail and strict clients display the image."""
    if not screenshot_str or not isinstance(screenshot_str, str) or not screenshot_str.strip():
        return "<p><em>Screenshot available in order details</em></p>"
    # Use CID first when we have an attachment (Proton and many clients strip inline data: images)
    if cid:
        return f"<img src='cid:{cid}' alt='Product Screenshot' style='max-width: 300px; border-radius: 6px; border: 1px solid #ddd;'>"
    if screenshot_str.startswith("data:image") and len(screenshot_str) < MAX_INLINE_BASE64_LEN:
        safe_src = screenshot_str.replace('"', "&quot;")
        return '<img src="' + safe_src + '" alt="Product Screenshot" style="max-width: 300px; border-radius: 6px; border: 1px solid #ddd;">'
    if screenshot_str.startswith("http"):
        return f"<img src='{screenshot_str}' alt='Product Screenshot' style='max-width: 300px; border-radius: 6px; border: 1px solid #ddd;'>"
    return "<p><em>Screenshot available in order details</em></p>"


def _screenshot_attachments(order_id, screenshot_str):
    """Build Resend attachments list: exactly ONE screenshot for this order only. Returns (attachments, cid_or_none)."""
    attachments = []
    cid = None
    if not screenshot_str or not isinstance(screenshot_str, str) or "data:image" not in screenshot_str:
        return (attachments, cid)
    try:
        header, b64_content = screenshot_str.split(",", 1)
        image_format = header.split("/")[1].split(";")[0]
        ext = "jpeg" if image_format.lower() in ("jpg", "jpeg") else image_format
        content_type = f"image/{'jpeg' if image_format.lower() in ('jpg', 'jpeg') else image_format}"
        # Unique filename per order so admin never sees "screenshot.jpeg" from other orders
        safe_id = "".join(c if c.isalnum() or c in "-_" else "_" for c in str(order_id))
        filename = f"screenshot_{safe_id}.{ext}"
        cid = f"screenshot_{order_id}_0"
        attachments.append({
            "filename": filename,
            "content": b64_content,
            "cid": cid,
            "content_type": content_type,
        })
    except Exception as e:
        logger.warning("Failed to build screenshot attachment: %s", e)
    return (attachments, cid)


def build_admin_order_email(order_id, order_data, cart, order_number, total_amount, screenshot_timestamp_override=None):
    """
    Build admin order notification HTML and optional attachments.
    Returns (html_body, attachments) where attachments is a list of dicts for Resend.
    """
    screenshot, ts = get_order_screenshot(order_data, cart)
    if screenshot_timestamp_override is not None:
        ts = str(screenshot_timestamp_override)

    # If screenshot is an HTTP(S) URL, fetch it so we can attach it (email clients often block external images; 300 DPI tools need the image)
    if screenshot and isinstance(screenshot, str) and screenshot.strip().startswith(("http://", "https://")):
        fetched = _fetch_image_as_base64(screenshot)
        if fetched:
            screenshot = fetched
            logger.info("Fetched screenshot from URL for admin email attachment")

    # Attachments: exactly one screenshot for this order only (no lingering images from other orders)
    attachments, cid = _screenshot_attachments(order_id, screenshot)
    attachments = attachments[:1]  # Cap to one so email never has more than this order's screenshot
    # Prefer inline in body so Proton shows image IN the email: use small/compressed base64 when possible, cid only when too large
    screenshot_for_body = screenshot
    if cid and len(screenshot) >= MAX_INLINE_BASE64_LEN:
        compressed = _compress_for_inline(screenshot, max_bytes=95000)
        if compressed and len(compressed) < MAX_INLINE_BASE64_LEN:
            screenshot_for_body = compressed
            cid = None  # use inline so body shows the image
    use_cid_in_body = cid is not None and len(screenshot_for_body) >= MAX_INLINE_BASE64_LEN
    image_tag = _screenshot_img_html(screenshot_for_body, cid=cid if use_cid_in_body else None)

    print_url = f"{PRINT_QUALITY_BASE_URL}?order_id={order_id}"
    html = f"<h1>🛍️ New ScreenMerch Order #{order_number}</h1>"
    html += f"<p><strong>Order ID:</strong> {order_id}</p>"
    html += f"<p><strong>Items:</strong> {len(cart)}</p>"
    html += f"<p><strong>Total Value:</strong> ${total_amount:.2f}</p>"
    html += "<br>"
    html += "<h2>🛍️ Products</h2>"
    html += f"<div style='border: 1px solid #ddd; padding: 15px; margin-bottom: 20px; border-radius: 8px;'><p style='margin-top:0;'><strong>📸 Order Screenshot</strong></p>{image_tag}</div>"
    for item in cart:
        product_name = item.get("product", "N/A")
        color = (item.get("variants") or {}).get("color", "N/A")
        size = (item.get("variants") or {}).get("size", "N/A")
        note = item.get("note", "None")
        price = item.get("price", 0)
        html += f"""
            <div style='border: 1px solid #ddd; padding: 15px; margin-bottom: 20px; border-radius: 8px;'>
                <h2>{product_name}</h2>
                <p><strong>Color:</strong> {color}</p>
                <p><strong>Size:</strong> {size}</p>
                <p><strong>Note:</strong> {note}</p>
                <p><strong>Price:</strong> ${price:.2f}</p>
            </div>
        """
    html += "<hr>"
    html += "<h2>📹 Video Information</h2>"
    html += f"<p><strong>Video Title:</strong> {order_data.get('video_title', 'Unknown Video')}</p>"
    html += f"<p><strong>Creator:</strong> {order_data.get('creator_name', 'Unknown Creator')}</p>"
    video_url = order_data.get('video_url') or ''
    if video_url and str(video_url).strip().startswith('http'):
        html += f"<p><strong>Video URL:</strong> <a href=\"{video_url}\">View video</a></p>"
    html += f"<p><strong>Screenshot Timestamp:</strong> {ts}</p>"
    html += "<br>"
    html += f"""
        <hr>
        <h2>🚀 Order Management & Print Quality</h2>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
            <tr>
                <td align="center">
                    <table cellpadding="0" cellspacing="0">
                        <tr>
                            <td style="padding: 10px;">
                                <a href="{print_url}" style="background: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">View Order Details</a>
                            </td>
                            <td style="padding: 10px;">
                                <a href="{print_url}" style="background: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Generate Print Quality Images</a>
                            </td>
                        </tr>
                        <tr>
                            <td colspan="2" style="padding: 10px; text-align: center;">
                                <a href="https://screenmerch.fly.dev/admin/orders" style="background: #6c757d; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">📊 View All Orders</a>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>📝 Quick Instructions:</h3>
            <ol>
                <li><strong>View Order Details:</strong> Click the blue button to see order info and tools.</li>
                <li><strong>Generate Print Quality Images:</strong> Click the green button for 300 DPI, feather edge, corner radius, and frame — no login required.</li>
                <li><strong>Timestamp:</strong> The screenshot timestamp is shown above and will be used in the print quality tool</li>
            </ol>
        </div>
        <hr>
        <p><small>This is an automated notification from ScreenMerch</small></p>
    """
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
    # Order screenshot first under Products (same spot as admin email – red box area)
    if screenshot and isinstance(screenshot, str) and screenshot.strip():
        if "data:image" in screenshot and len(screenshot) < MAX_INLINE_BASE64_LEN:
            safe_src = screenshot.replace('"', "&quot;")
            html += '<div style="border: 1px solid #ddd; padding: 15px; margin-bottom: 20px; border-radius: 8px;"><p style="margin-top:0;"><strong>📸 Order Screenshot</strong></p><img src="' + safe_src + '" alt="Product Screenshot" style="max-width: 300px; border-radius: 6px; border: 1px solid #ddd;"></div>'
        elif screenshot.startswith("http") or screenshot.startswith("https"):
            html += f'<div style="border: 1px solid #ddd; padding: 15px; margin-bottom: 20px; border-radius: 8px;"><p style="margin-top:0;"><strong>📸 Order Screenshot</strong></p><img src="{screenshot}" alt="Product Screenshot" style="max-width: 300px; border-radius: 6px; border: 1px solid #ddd;"></div>'
    else:
        html += '<div style="border: 1px solid #ddd; padding: 15px; margin-bottom: 20px; border-radius: 8px;"><p style="margin-top:0;"><strong>📸 Order Screenshot</strong></p><p><em>Screenshot available in order details</em></p></div>'
    for item in cart:
        product_name = item.get("product", "N/A")
        color = (item.get("variants") or {}).get("color", "N/A")
        size = (item.get("variants") or {}).get("size", "N/A")
        price = item.get("price", 0)
        note = item.get("note", "")
        note_p = f'<p><strong>Note:</strong> {note}</p>' if note else ''
        html += f"""
        <div style="border: 1px solid #ddd; padding: 15px; margin-bottom: 15px; border-radius: 8px;">
            <h3 style="margin-top: 0; color: #333;">{product_name}</h3>
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
    # Blue View Order Details + green Generate Print Quality Images
    print_url = f"{PRINT_QUALITY_BASE_URL}?order_id={order_id}"
    html += f"""
        <div style="margin: 25px 0; padding: 20px 0; border-top: 1px solid #ddd;">
            <p style="margin-bottom: 15px;"><strong>Next steps:</strong></p>
            <p style="margin: 10px 0;">
                <a href="{print_url}" style="background: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; margin-right: 10px;">View Order Details</a>
                <a href="{print_url}" style="background: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Generate Print Quality Images</a>
            </p>
            <p style="color: #666; font-size: 14px;">Use the green button to create 300 DPI images for your order (no login required).</p>
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
