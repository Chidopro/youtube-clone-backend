# 🖨️ Print Quality Screenshot System

## Overview

This system provides **professional print-quality screenshots** optimized for Printify and other print-on-demand services. It captures images at 300+ DPI with lossless quality, ensuring your merchandise looks crisp and professional.

## 🚀 Key Features

### ✅ **Professional Print Quality**
- **300 DPI minimum** (professional print standard)
- **Lossless PNG format** (no compression artifacts)
- **Automatic upscaling** to meet print requirements
- **RGB color space** for accurate color reproduction

### ✅ **Smart Scaling**
- Automatically scales up smaller videos to meet print requirements
- Minimum dimensions: 2400x3000 pixels (8x10 inches at 300 DPI)
- Maintains aspect ratio while ensuring print quality

### ✅ **Advanced Cropping**
- Precise crop area selection
- Minimum crop size enforcement (1200x1200 pixels)
- Maintains print quality even after cropping

### ✅ **Detailed Metadata**
- File size information
- Exact dimensions
- DPI settings
- Quality indicators

## 📡 API Endpoint

### **POST** `/api/capture-print-quality`

**Request Body:**
```json
{
  "video_url": "https://example.com/video.mp4",
  "timestamp": 5.0,
  "crop_area": {
    "x": 0.25,
    "y": 0.25,
    "width": 0.5,
    "height": 0.5
  },
  "print_dpi": 300
}
```

**Response:**
```json
{
  "success": true,
  "screenshot": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "timestamp": 5.0,
  "dimensions": {
    "width": 2400,
    "height": 3000,
    "dpi": 300
  },
  "file_size": 2048576,
  "format": "PNG",
  "quality": "Print Ready"
}
```

## 🛠️ Usage Examples

### 1. **Basic Print Quality Capture**
```python
import requests

response = requests.post("https://your-backend.fly.dev/api/capture-print-quality", json={
    "video_url": "https://example.com/video.mp4",
    "timestamp": 10.0,
    "print_dpi": 300
})

result = response.json()
if result['success']:
    # Save the high-quality image
    base64_data = result['screenshot'].split(',')[1]
    image_data = base64.b64decode(base64_data)
    with open('print_quality.png', 'wb') as f:
        f.write(image_data)
```

### 2. **Cropped Print Quality Capture**
```python
response = requests.post("https://your-backend.fly.dev/api/capture-print-quality", json={
    "video_url": "https://example.com/video.mp4",
    "timestamp": 15.0,
    "crop_area": {
        "x": 0.2,      # 20% from left
        "y": 0.3,      # 30% from top
        "width": 0.6,  # 60% width
        "height": 0.4  # 40% height
    },
    "print_dpi": 300
})
```

### 3. **Ultra High DPI Capture**
```python
response = requests.post("https://your-backend.fly.dev/api/capture-print-quality", json={
    "video_url": "https://example.com/video.mp4",
    "timestamp": 20.0,
    "print_dpi": 600  # Ultra high DPI
})
```

## 🎯 Print Requirements Met

### **Printify Requirements:**
- ✅ **Minimum 150 DPI** (we provide 300+ DPI)
- ✅ **PNG or JPEG format** (we use PNG for lossless quality)
- ✅ **Minimum 1000x1000 pixels** (we provide 2400x3000+ pixels)
- ✅ **RGB color space** (we use RGB24 format)

### **Professional Print Standards:**
- ✅ **300 DPI** for professional printing
- ✅ **Lossless compression** for maximum quality
- ✅ **High bit depth** for color accuracy
- ✅ **Proper aspect ratios** maintained

## 📊 Quality Comparison

| Feature | Standard Screenshot | Print Quality Screenshot |
|---------|-------------------|-------------------------|
| **Resolution** | 640x360 | 2400x3000+ |
| **DPI** | ~72 DPI | 300+ DPI |
| **Format** | JPEG (compressed) | PNG (lossless) |
| **File Size** | ~50KB | ~2MB+ |
| **Print Ready** | ❌ No | ✅ Yes |
| **Processing Time** | ~5 seconds | ~30-60 seconds |

## 🔧 Integration with Your Workflow

### **For Email Orders:**
1. Customer places order with screenshots
2. Use print quality endpoint to get high-res versions
3. Attach high-quality images to fulfillment emails
4. Upload to Printify with confidence

### **For Automated Fulfillment:**
1. Process orders through your system
2. Extract screenshot timestamps and crop areas
3. Generate print-quality images automatically
4. Upload directly to Printify API

### **For Manual Processing:**
1. Use the demo script (`print_quality_demo.py`)
2. Generate high-quality images on demand
3. Save locally for Printify upload
4. Maintain quality control

## 🚨 Important Notes

### **Performance:**
- Print quality captures take **30-60 seconds** (vs 5 seconds for standard)
- Extended timeout of 60 seconds for processing
- Larger file sizes (2MB+ vs 50KB)

### **Storage:**
- Images are base64 encoded in responses
- Consider file size limits for email attachments
- For large volumes, consider cloud storage integration

### **Error Handling:**
- Always check `success` field in response
- Handle timeout errors gracefully
- Provide fallback to standard quality if needed

## 🎨 Best Practices

### **For Merchandise:**
1. **Capture at key moments** - Use timestamps that show the best content
2. **Crop strategically** - Focus on the most important part of the image
3. **Test different DPI settings** - 300 DPI for most items, 600 DPI for detailed designs
4. **Verify dimensions** - Check that final images meet your print requirements

### **For Performance:**
1. **Cache results** - Don't regenerate the same screenshot multiple times
2. **Batch processing** - Process multiple screenshots in parallel
3. **Monitor file sizes** - Large images may need special handling
4. **Error recovery** - Have fallback strategies for failed captures

## 🔗 Related Endpoints

- `/api/capture-screenshot` - Standard quality screenshots
- `/api/capture-multiple-screenshots` - Batch standard captures
- `/api/process-shirt-image` - Image processing for shirt printing
- `/api/video-info` - Get video metadata

## 📞 Support

For issues or questions about the print quality system:
1. Check the logs for detailed error messages
2. Verify video URL accessibility
3. Ensure sufficient server resources for processing
4. Test with smaller videos first

---

**Ready to create professional print-quality merchandise! 🎉**
