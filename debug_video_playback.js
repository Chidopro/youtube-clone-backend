// Debug script for video playback issues
// Run this in the browser console on the video page

function debugVideoPlayback() {
    console.log('🎥 Video Playback Debugger');
    console.log('='.repeat(50));
    
    // Find video elements
    const videos = document.querySelectorAll('video');
    console.log(`Found ${videos.length} video elements`);
    
    videos.forEach((video, index) => {
        console.log(`\n📹 Video ${index + 1}:`);
        console.log('- Source:', video.src);
        console.log('- Current Time:', video.currentTime);
        console.log('- Duration:', video.duration);
        console.log('- Ready State:', video.readyState);
        console.log('- Network State:', video.networkState);
        console.log('- Error:', video.error);
        console.log('- Paused:', video.paused);
        console.log('- Ended:', video.ended);
        
        // Check if source is accessible
        if (video.src) {
            fetch(video.src, { method: 'HEAD' })
                .then(response => {
                    console.log(`- HTTP Status: ${response.status}`);
                    console.log('- Content-Type:', response.headers.get('content-type'));
                    console.log('- Content-Length:', response.headers.get('content-length'));
                    console.log('- Access-Control-Allow-Origin:', response.headers.get('access-control-allow-origin'));
                })
                .catch(error => {
                    console.error(`- Fetch Error: ${error.message}`);
                });
        }
        
        // Add event listeners for debugging
        const events = ['loadstart', 'durationchange', 'loadedmetadata', 'loadeddata', 'canplay', 'canplaythrough', 'error', 'stalled', 'suspend'];
        events.forEach(eventType => {
            video.addEventListener(eventType, (e) => {
                console.log(`📺 Video ${index + 1} Event: ${eventType}`, e);
            });
        });
    });
    
    // Check for video data in page
    console.log('\n🔍 Checking for video data in page...');
    
    // Look for React components with video data
    const reactRoot = document.querySelector('#root');
    if (reactRoot && reactRoot._reactInternalFiber) {
        console.log('React app detected');
    }
    
    // Check localStorage for video data
    const keys = Object.keys(localStorage);
    const videoKeys = keys.filter(key => key.includes('video') || key.includes('supabase'));
    console.log('Video-related localStorage keys:', videoKeys);
    
    // Check for Supabase client
    if (window.supabase) {
        console.log('✅ Supabase client found');
    } else {
        console.log('❌ Supabase client not found');
    }
}

function testVideoUrl(url) {
    console.log(`🧪 Testing video URL: ${url}`);
    
    const video = document.createElement('video');
    video.src = url;
    video.crossOrigin = 'anonymous';
    
    video.addEventListener('loadedmetadata', () => {
        console.log('✅ Video metadata loaded successfully');
        console.log('- Duration:', video.duration);
        console.log('- Video Width:', video.videoWidth);
        console.log('- Video Height:', video.videoHeight);
    });
    
    video.addEventListener('error', (e) => {
        console.error('❌ Video loading error:', e);
        console.error('- Error code:', video.error?.code);
        console.error('- Error message:', video.error?.message);
    });
    
    video.addEventListener('canplay', () => {
        console.log('✅ Video can play');
    });
    
    video.load();
    
    return video;
}

function fixVideoPlayback() {
    console.log('🔧 Attempting to fix video playback...');
    
    const videos = document.querySelectorAll('video');
    videos.forEach((video, index) => {
        console.log(`Fixing video ${index + 1}...`);
        
        // Reset video element
        video.load();
        
        // Add error handling
        video.addEventListener('error', (e) => {
            console.error(`Video ${index + 1} error:`, e);
            
            // Try to reload with different settings
            setTimeout(() => {
                video.crossOrigin = 'anonymous';
                video.load();
            }, 1000);
        });
        
        // Force play attempt
        video.addEventListener('canplay', () => {
            console.log(`Video ${index + 1} is ready to play`);
        });
    });
}

// Auto-run debug
debugVideoPlayback();

// Export functions for manual use
window.debugVideoPlayback = debugVideoPlayback;
window.testVideoUrl = testVideoUrl;
window.fixVideoPlayback = fixVideoPlayback;

console.log('\n🎮 Available debug functions:');
console.log('- debugVideoPlayback() - Run full diagnostic');
console.log('- testVideoUrl(url) - Test a specific video URL');
console.log('- fixVideoPlayback() - Attempt to fix video issues');
