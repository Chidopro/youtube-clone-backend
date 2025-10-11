import React from 'react';
import PrintCropToolDemo from '../../Components/PrintCropTool/PrintCropToolDemo';
import './TestCropTool.css';

const TestCropTool = () => {
    return (
        <div className="test-crop-page">
            <div className="test-header">
                <h1>🧪 Print Crop Tool Test</h1>
                <p>Testing the new standalone crop tool for print-ready screenshots</p>
                <div className="test-info">
                    <h3>What to test:</h3>
                    <ul>
                        <li>✅ Upload a screenshot image</li>
                        <li>✅ Drag the crop box to move it</li>
                        <li>✅ Use corner handles (crosshair cursor) to resize</li>
                        <li>✅ Check print size validation (green checkmarks)</li>
                        <li>✅ Apply crop and download result</li>
                    </ul>
                </div>
            </div>
            
            <PrintCropToolDemo />
            
            <div className="test-footer">
                <p><strong>Note:</strong> This is a test page. Remove the route and import when done testing.</p>
            </div>
        </div>
    );
};

export default TestCropTool;
