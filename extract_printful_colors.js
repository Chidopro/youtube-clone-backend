// Script to extract colors from Printful color picker
// Run this in the browser console on the Printful customization page

function extractPrintfulColors() {
    // Find all color picker buttons
    const colorButtons = document.querySelectorAll('button[data-v-74d45571][aria-label*="color-swatch"]');
    
    const colors = [];
    
    colorButtons.forEach(button => {
        const ariaLabel = button.getAttribute('aria-label');
        const dataTest = button.getAttribute('data-test');
        
        // Extract color name and code from aria-label
        if (ariaLabel) {
            const match = ariaLabel.match(/(.+?)-color-swatch/);
            if (match) {
                const colorName = match[1];
                
                // Extract hex code from data-test attribute
                let hexCode = '';
                if (dataTest && dataTest.includes('color-swatch')) {
                    // Look for hex pattern in data-test or other attributes
                    const hexMatch = dataTest.match(/#[0-9A-Fa-f]{6}/);
                    if (hexMatch) {
                        hexCode = hexMatch[0];
                    }
                }
                
                // If no hex found in data-test, try to get it from computed styles
                if (!hexCode) {
                    const computedStyle = window.getComputedStyle(button);
                    const bgColor = computedStyle.backgroundColor;
                    if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)') {
                        hexCode = rgbToHex(bgColor);
                    }
                }
                
                colors.push({
                    name: colorName,
                    hex: hexCode,
                    element: button
                });
            }
        }
    });
    
    return colors;
}

// Helper function to convert RGB to HEX
function rgbToHex(rgb) {
    const result = rgb.match(/\d+/g);
    if (result && result.length >= 3) {
        const r = parseInt(result[0]);
        const g = parseInt(result[1]);
        const b = parseInt(result[2]);
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }
    return '';
}

// Alternative method - extract from visible text and patterns
function extractColorsAlternative() {
    const colors = [];
    
    // Look for elements with color names in the visible DOM
    const colorElements = document.querySelectorAll('[aria-label*="Black"], [aria-label*="White"], [aria-label*="Navy"], [aria-label*="Grey"], [aria-label*="Purple"], [aria-label*="Heather"]');
    
    colorElements.forEach(element => {
        const ariaLabel = element.getAttribute('aria-label');
        if (ariaLabel) {
            const style = window.getComputedStyle(element);
            const bgColor = style.backgroundColor;
            
            colors.push({
                name: ariaLabel.replace('-color-swatch', '').replace(/"/g, ''),
                backgroundColor: bgColor,
                hex: rgbToHex(bgColor),
                element: element
            });
        }
    });
    
    return colors;
}

// Extract colors from the specific pattern I see in the console
function extractFromConsolePattern() {
    const colors = [
        { name: "Black Heather", code: "#000000" },
        { name: "Black", code: "#000000" },
        { name: "Vintage Black", code: "#151515" },
        { name: "Team Purple", code: "#2f0f40" },
        { name: "Navy", code: "#212642" },
        { name: "Heather Emerald", code: "#1e9c1c" },
        { name: "Cardinal", code: "#890c1e" },
        { name: "Dark Grey", code: "#242929" },
        { name: "Heather Midnight Navy", code: "#383045" }
    ];
    
    return colors;
}

// Main execution
console.log('=== PRINTFUL COLOR EXTRACTOR ===');
console.log('Method 1: Extract from DOM elements');
const extractedColors = extractPrintfulColors();
console.table(extractedColors);

console.log('\nMethod 2: Alternative extraction');
const altColors = extractColorsAlternative();
console.table(altColors);

console.log('\nMethod 3: From console pattern (manual)');
const manualColors = extractFromConsolePattern();
console.table(manualColors);

// Copy to clipboard function
function copyColorsToClipboard(colors) {
    const colorText = colors.map(color => `${color.name}: ${color.hex || color.code || color.backgroundColor}`).join('\n');
    navigator.clipboard.writeText(colorText).then(() => {
        console.log('Colors copied to clipboard!');
    }).catch(() => {
        console.log('Could not copy to clipboard. Here are the colors:');
        console.log(colorText);
    });
}

// Usage:
// copyColorsToClipboard(extractedColors);
// or
// copyColorsToClipboard(manualColors);

console.log('\n=== USAGE ===');
console.log('Run: copyColorsToClipboard(extractedColors) to copy the extracted colors');
console.log('Or: copyColorsToClipboard(manualColors) to copy the manual colors');
