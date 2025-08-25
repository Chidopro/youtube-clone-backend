import React, { useState } from 'react';
import SimpleCropTool from './SimpleCropTool';
import './PrintCropToolDemo.css';

const PrintCropToolDemo = () => {
    const [isCropOpen, setIsCropOpen] = useState(false);
    const [originalImage, setOriginalImage] = useState(null);
    const [croppedImage, setCroppedImage] = useState(null);

    const handleFileSelect = (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                setOriginalImage(e.target.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleCrop = (croppedImageUrl) => {
        setCroppedImage(croppedImageUrl);
        setIsCropOpen(false);
    };

    const handleCancel = () => {
        setIsCropOpen(false);
    };

    return (
        <div className="print-crop-demo">
            <div className="demo-header">
                <h2>Print Crop Tool Demo</h2>
                <p>This is a standalone crop tool designed for print-ready screenshots</p>
            </div>

            <div className="demo-controls">
                <div className="file-upload">
                    <label htmlFor="image-upload" className="upload-btn">
                        Choose Screenshot Image
                    </label>
                    <input
                        id="image-upload"
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        style={{ display: 'none' }}
                    />
                </div>

                {originalImage && (
                    <button 
                        className="crop-btn"
                        onClick={() => setIsCropOpen(true)}
                    >
                        Open Crop Tool
                    </button>
                )}
            </div>

            <div className="demo-images">
                {originalImage && (
                    <div className="image-container">
                        <h3>Original Image</h3>
                        <img src={originalImage} alt="Original" />
                    </div>
                )}

                {croppedImage && (
                    <div className="image-container">
                        <h3>Cropped Image</h3>
                        <img src={croppedImage} alt="Cropped" />
                        <div className="image-info">
                            <p>Preview (scaled down for display)</p>
                            <p>Full size available for download</p>
                        </div>
                        <a 
                            href={croppedImage} 
                            download="cropped-screenshot.png"
                            className="download-btn"
                        >
                            Download Cropped Image
                        </a>
                    </div>
                )}
            </div>

            <SimpleCropTool
                isOpen={isCropOpen}
                image={originalImage}
                onCrop={handleCrop}
                onCancel={handleCancel}
            />
        </div>
    );
};

export default PrintCropToolDemo;
