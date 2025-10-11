# Print Crop Tool

A standalone crop tool component designed specifically for creating print-ready screenshots. This component is separate from your existing CropModal to avoid build conflicts.

## Features

- **Basic crop box** with corner resize handles
- **Crosshair cursor** when hovering over resize handles
- **Print size validation** - shows if crop meets common print size requirements
- **Real-time feedback** - green checkmarks for print-ready sizes
- **Drag to move** - click and drag inside the crop area to reposition
- **Responsive design** - works on desktop and mobile

## Print Size Requirements

The tool checks against these print sizes (at 300 DPI):
- **4x6**: 1200×1800 pixels
- **5x7**: 1500×2100 pixels  
- **8x10**: 2400×3000 pixels
- **11x14**: 3300×4200 pixels

## Usage

### Basic Implementation

```jsx
import PrintCropTool from './Components/PrintCropTool/PrintCropTool';

function YourComponent() {
    const [isCropOpen, setIsCropOpen] = useState(false);
    const [image, setImage] = useState(null);

    const handleCrop = (croppedImageUrl) => {
        // Handle the cropped image
        console.log('Cropped image:', croppedImageUrl);
        setIsCropOpen(false);
    };

    const handleCancel = () => {
        setIsCropOpen(false);
    };

    return (
        <div>
            <button onClick={() => setIsCropOpen(true)}>
                Open Crop Tool
            </button>

            <PrintCropTool
                isOpen={isCropOpen}
                image={image}
                onCrop={handleCrop}
                onCancel={handleCancel}
            />
        </div>
    );
}
```

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `isOpen` | boolean | Yes | Controls whether the crop modal is visible |
| `image` | string | Yes | The image URL to crop (data URL or external URL) |
| `onCrop` | function | Yes | Callback function called with the cropped image data URL |
| `onCancel` | function | Yes | Callback function called when user cancels cropping |

## Integration with Screenshot Video Window

To integrate this with your screenshot video window, you can:

1. **Replace the existing crop tool** (if you want to switch completely):
   ```jsx
   // Replace CropModal import with:
   import PrintCropTool from './Components/PrintCropTool/PrintCropTool';
   ```

2. **Add as an alternative option** (keep both):
   ```jsx
   const [cropToolType, setCropToolType] = useState('original'); // or 'print'

   // In your render:
   {cropToolType === 'print' ? (
       <PrintCropTool
           isOpen={isCropOpen}
           image={image}
           onCrop={handleCrop}
           onCancel={handleCancel}
       />
   ) : (
       <CropModal
           isOpen={isCropOpen}
           image={image}
           onCrop={handleCrop}
           onCancel={handleCancel}
       />
   )}
   ```

## Testing

You can test the component using the included demo:

```jsx
import PrintCropToolDemo from './Components/PrintCropTool/PrintCropToolDemo';

// Add to your app for testing
<PrintCropToolDemo />
```

## File Structure

```
frontend/src/Components/PrintCropTool/
├── PrintCropTool.jsx          # Main component
├── PrintCropTool.css          # Component styles
├── PrintCropToolDemo.jsx      # Demo component
├── PrintCropToolDemo.css      # Demo styles
└── README.md                  # This file
```

## Benefits

- **No build conflicts** - Completely separate from existing CropModal
- **Print-focused** - Designed specifically for print requirements
- **Simple interface** - Clean, intuitive UI
- **Crosshair cursors** - Clear visual feedback for resize handles
- **Print validation** - Real-time feedback on print readiness

## Future Enhancements

You can easily extend this component with:
- Custom print size requirements
- Aspect ratio presets
- Zoom functionality
- Rotation tools
- Multiple crop areas

The component is designed to be modular and extensible while maintaining simplicity.
