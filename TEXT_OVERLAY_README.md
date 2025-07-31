# 🎨 Image Text Overlay System

A comprehensive image text overlay system that allows you to add stylish text overlays to images with multiple effects and customization options.

## ✨ Features

### 🎯 Core Features
- **Multiple Text Styles**: Modern, Vintage, Bold, Elegant, Fun, Minimal
- **Flexible Positioning**: Center, Top, Bottom, Top-Left, Top-Right, Bottom-Left, Bottom-Right
- **Advanced Effects**: Shadow, Glow, Background, Rotation, Opacity
- **Color Customization**: Text color, stroke color, background color
- **Multiple Text Elements**: Add multiple text overlays to a single image
- **Real-time Preview**: Preview text overlays before applying

### 🎨 Visual Effects
- **Shadow Effect**: Adds realistic drop shadows to text
- **Glow Effect**: Creates a glowing halo around text
- **Background Effect**: Adds semi-transparent background behind text
- **Rotation**: Rotate text at any angle (-45° to +45°)
- **Opacity Control**: Adjust text transparency (0-100%)
- **Stroke/Outline**: Customizable text stroke width and color

### 📱 User Interface
- **Interactive Demo**: Beautiful web interface for testing
- **Drag & Drop**: Easy image upload with drag and drop support
- **Real-time Controls**: Live preview of all customization options
- **Style Presets**: Quick selection of predefined styles
- **Responsive Design**: Works on desktop and mobile devices

## 🚀 Quick Start

### 1. Start the Server
```bash
python app.py
```

### 2. Access the Demo
Visit: `http://localhost:5000/text-overlay-demo`

### 3. Test the API
```bash
python test_text_overlay.py
```

## 📡 API Endpoints

### 1. Add Single Text Overlay
**POST** `/api/image/add-text-overlay`

Add a single text overlay to an image.

**Request Body:**
```json
{
  "image_data": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "text": "Your Text Here",
  "position": "center",
  "font_size": 48,
  "font_color": [255, 255, 255],
  "stroke_color": [0, 0, 0],
  "stroke_width": 2,
  "style": "modern",
  "opacity": 1.0,
  "rotation": 0,
  "shadow": false,
  "glow": false,
  "background": false,
  "background_color": [0, 0, 0],
  "background_opacity": 0.7
}
```

**Response:**
```json
{
  "success": true,
  "image_data": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "message": "Text overlay added successfully"
}
```

### 2. Add Multiple Text Overlays
**POST** `/api/image/add-multiple-text-overlays`

Add multiple text overlays to an image.

**Request Body:**
```json
{
  "image_data": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "text_elements": [
    {
      "text": "TOP TEXT",
      "position": "top",
      "style": "bold",
      "font_size": 36,
      "font_color": [255, 255, 255],
      "stroke_color": [0, 0, 0],
      "stroke_width": 3
    },
    {
      "text": "BOTTOM TEXT",
      "position": "bottom",
      "style": "modern",
      "font_size": 32,
      "font_color": [255, 215, 0],
      "stroke_color": [139, 69, 19],
      "stroke_width": 2
    }
  ]
}
```

### 3. Get Available Styles
**GET** `/api/image/text-styles`

Get available text styles and configurations.

**Response:**
```json
{
  "success": true,
  "styles": {
    "available_styles": ["modern", "vintage", "bold", "elegant", "fun", "minimal"],
    "positions": ["top", "center", "bottom", "top-left", "top-right", "bottom-left", "bottom-right"],
    "effects": ["shadow", "glow", "background", "rotation", "opacity"],
    "preset_styles": {
      "modern": {
        "font_size": 48,
        "font_color": [255, 255, 255],
        "stroke_color": [0, 0, 0],
        "stroke_width": 2,
        "shadow": true,
        "glow": false
      }
    }
  }
}
```

### 4. Preview Text Overlay
**POST** `/api/image/preview-text-overlay`

Generate a preview of text overlay on a sample image.

**Request Body:**
```json
{
  "text": "Preview Text",
  "style": "modern",
  "position": "center"
}
```

## 🎨 Style Presets

### Modern
- Font Size: 48px
- Color: White text with black stroke
- Effects: Shadow enabled
- Best for: Clean, professional look

### Vintage
- Font Size: 56px
- Color: Gold text with brown stroke
- Effects: Shadow enabled
- Best for: Retro, classic designs

### Bold
- Font Size: 64px
- Color: White text with black stroke
- Effects: Thick stroke (4px)
- Best for: High-impact, attention-grabbing text

### Elegant
- Font Size: 42px
- Color: White text with gray stroke
- Effects: Glow enabled
- Best for: Sophisticated, refined designs

### Fun
- Font Size: 52px
- Color: Pink text with yellow stroke
- Effects: Shadow and glow enabled
- Best for: Playful, energetic designs

### Minimal
- Font Size: 36px
- Color: White text with black stroke
- Effects: No special effects
- Best for: Clean, simple designs

## 📍 Position Options

- **center**: Centered on the image
- **top**: Top center of the image
- **bottom**: Bottom center of the image
- **top-left**: Top left corner
- **top-right**: Top right corner
- **bottom-left**: Bottom left corner
- **bottom-right**: Bottom right corner

## 🎭 Effects

### Shadow Effect
Adds a realistic drop shadow to text:
```json
{
  "shadow": true
}
```

### Glow Effect
Creates a glowing halo around text:
```json
{
  "glow": true
}
```

### Background Effect
Adds a semi-transparent background behind text:
```json
{
  "background": true,
  "background_color": [0, 0, 0],
  "background_opacity": 0.7
}
```

### Rotation
Rotate text at any angle:
```json
{
  "rotation": 15
}
```

### Opacity
Control text transparency:
```json
{
  "opacity": 0.8
}
```

## 💻 Usage Examples

### Python Example
```python
import requests

# Add text overlay
payload = {
    "image_data": "data:image/png;base64,...",
    "text": "Hello World",
    "style": "modern",
    "position": "center"
}

response = requests.post(
    "http://localhost:5000/api/image/add-text-overlay",
    json=payload
)

if response.status_code == 200:
    result = response.json()
    if result["success"]:
        print("Text overlay added successfully!")
        # result["image_data"] contains the processed image
```

### JavaScript Example
```javascript
// Add text overlay
const payload = {
    image_data: "data:image/png;base64,...",
    text: "Hello World",
    style: "modern",
    position: "center"
};

fetch('/api/image/add-text-overlay', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload)
})
.then(response => response.json())
.then(data => {
    if (data.success) {
        console.log('Text overlay added successfully!');
        // data.image_data contains the processed image
    }
});
```

## 🧪 Testing

Run the comprehensive test suite:

```bash
python test_text_overlay.py
```

This will test:
- Single text overlays with all styles
- Multiple text overlays
- Advanced effects (rotation, shadow, glow, background)
- API endpoints
- Preview functionality

## 🔧 Technical Details

### Dependencies
- **Pillow**: Image processing and manipulation
- **Flask**: Web framework for API endpoints
- **Python 3.7+**: Required for type hints and modern features

### Image Formats
- **Input**: PNG, JPG, JPEG, GIF
- **Output**: PNG (with transparency support)

### Performance
- **Processing Time**: Typically < 1 second for standard images
- **Memory Usage**: Optimized for large images
- **Concurrent Requests**: Thread-safe implementation

### Security
- **Input Validation**: All parameters are validated
- **File Size Limits**: Configurable limits to prevent abuse
- **CORS Support**: Cross-origin requests supported

## 🎯 Use Cases

### Social Media
- Add captions to photos
- Create memes with custom text
- Design Instagram stories

### Marketing
- Add branding to product images
- Create promotional graphics
- Design advertisements

### Content Creation
- Add titles to YouTube thumbnails
- Create blog post featured images
- Design infographics

### Personal Projects
- Add watermarks to photos
- Create greeting cards
- Design invitations

## 🚀 Future Enhancements

- [ ] **More Fonts**: Additional font families and styles
- [ ] **Text Effects**: 3D text, gradient text, animated text
- [ ] **Batch Processing**: Process multiple images at once
- [ ] **Template System**: Save and reuse text overlay configurations
- [ ] **AI Suggestions**: Smart text placement and style recommendations
- [ ] **Video Support**: Add text overlays to video frames
- [ ] **Mobile App**: Native mobile application
- [ ] **Cloud Storage**: Direct integration with cloud storage services

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

If you encounter any issues or have questions:

1. Check the test suite: `python test_text_overlay.py`
2. Review the API documentation above
3. Check the demo page: `http://localhost:5000/text-overlay-demo`
4. Open an issue on GitHub

---

**Happy Text Overlaying! 🎨✨** 