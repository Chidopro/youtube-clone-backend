// Emergency video fix - run this in the browser console
// This will manually query the database and set the video source

async function emergencyVideoFix() {
    console.log('🚨 Emergency Video Fix Started');
    
    // Get video ID from URL
    const url = window.location.href;
    const videoIdMatch = url.match(/\/video\/.*\/(\w+)/);
    
    if (!videoIdMatch) {
        console.log('❌ Could not extract video ID from URL');
        return;
    }
    
    const videoId = videoIdMatch[1];
    console.log('🆔 Video ID:', videoId);
    
    // Check if Supabase is available
    if (!window.supabase && !window.__SUPABASE__) {
        console.log('❌ Supabase not available on window object');
        
        // Try to access from React component
        const videoElement = document.querySelector('video');
        if (videoElement) {
            const reactKey = Object.keys(videoElement).find(key => key.startsWith('__reactFiber'));
            if (reactKey) {
                console.log('🔍 Found React fiber, trying to access component data');
            }
        }
        return;
    }
    
    // Get Supabase instance
    const supabase = window.supabase || window.__SUPABASE__;
    
    try {
        console.log('🔍 Querying database for video...');
        
        // Query the database
        const { data, error } = await supabase
            .from('videos2')
            .select('*')
            .eq('id', videoId)
            .single();
        
        if (error) {
            console.error('❌ Database error:', error);
            return;
        }
        
        if (!data) {
            console.log('❌ No video data found');
            return;
        }
        
        console.log('✅ Video data found:', data);
        console.log('🔗 Video URL from DB:', data.video_url);
        
        // Find and update video element
        const videoElement = document.querySelector('video');
        if (videoElement) {
            console.log('🎬 Updating video source...');
            videoElement.src = data.video_url;
            videoElement.load(); // Force reload
            
            // Add event listeners for debugging
            videoElement.addEventListener('loadedmetadata', () => {
                console.log('✅ Video metadata loaded successfully!');
                console.log('Duration:', videoElement.duration);
            });
            
            videoElement.addEventListener('error', (e) => {
                console.error('❌ Video loading error:', e);
                console.error('Error details:', videoElement.error);
            });
            
            videoElement.addEventListener('canplay', () => {
                console.log('✅ Video can play!');
            });
            
            console.log('🎯 Video source updated, attempting to load...');
        } else {
            console.log('❌ No video element found on page');
        }
        
    } catch (e) {
        console.error('❌ Emergency fix error:', e);
    }
}

// Make function available and run it
window.emergencyVideoFix = emergencyVideoFix;
emergencyVideoFix();
