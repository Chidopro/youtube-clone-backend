// Simple video debug script to run in browser console
// Copy and paste this entire script into the browser console on the video page

console.log('🎥 Starting video debug...');

// Function to check video element
function checkVideoElement() {
    const videos = document.querySelectorAll('video');
    console.log(`Found ${videos.length} video elements`);
    
    videos.forEach((video, index) => {
        console.log(`\n📺 Video ${index + 1}:`);
        console.log('- Source:', video.src || 'No source');
        console.log('- Current Source:', video.currentSrc || 'No current source');
        console.log('- Ready State:', video.readyState);
        console.log('- Network State:', video.networkState);
        console.log('- Duration:', video.duration);
        console.log('- Error:', video.error);
        
        if (video.src) {
            console.log('✅ Video has source URL');
            
            // Test if the URL is accessible
            fetch(video.src, { method: 'HEAD' })
                .then(response => {
                    console.log(`- HTTP Status: ${response.status}`);
                    console.log('- Headers:', Object.fromEntries(response.headers));
                })
                .catch(error => {
                    console.error(`- Fetch Error: ${error.message}`);
                });
        } else {
            console.log('❌ Video has no source URL');
        }
    });
}

// Function to check React component state
function checkReactState() {
    console.log('\n🔍 Checking React component state...');
    
    // Look for React fiber on video elements
    const videos = document.querySelectorAll('video');
    videos.forEach((video, index) => {
        const fiberKey = Object.keys(video).find(key => key.startsWith('__reactFiber'));
        if (fiberKey) {
            const fiber = video[fiberKey];
            console.log(`Video ${index + 1} React props:`, fiber.memoizedProps);
        }
    });
}

// Function to check localStorage and sessionStorage
function checkStorage() {
    console.log('\n💾 Checking browser storage...');
    
    // Check localStorage
    const localKeys = Object.keys(localStorage);
    const relevantKeys = localKeys.filter(key => 
        key.includes('video') || 
        key.includes('supabase') || 
        key.includes('auth')
    );
    console.log('Relevant localStorage keys:', relevantKeys);
    
    // Check sessionStorage
    const sessionKeys = Object.keys(sessionStorage);
    const relevantSessionKeys = sessionKeys.filter(key => 
        key.includes('video') || 
        key.includes('supabase') || 
        key.includes('auth')
    );
    console.log('Relevant sessionStorage keys:', relevantSessionKeys);
}

// Function to manually test a video URL
function testVideoUrl(url) {
    console.log(`\n🧪 Testing video URL: ${url}`);
    
    const testVideo = document.createElement('video');
    testVideo.style.position = 'fixed';
    testVideo.style.top = '10px';
    testVideo.style.right = '10px';
    testVideo.style.width = '200px';
    testVideo.style.zIndex = '9999';
    testVideo.style.border = '2px solid red';
    testVideo.controls = true;
    
    testVideo.addEventListener('loadedmetadata', () => {
        console.log('✅ Test video loaded metadata');
        console.log('Duration:', testVideo.duration);
    });
    
    testVideo.addEventListener('error', (e) => {
        console.error('❌ Test video error:', e);
        console.error('Error details:', testVideo.error);
    });
    
    testVideo.src = url;
    document.body.appendChild(testVideo);
    
    return testVideo;
}

// Function to get video data from URL
function getVideoIdFromUrl() {
    const url = window.location.href;
    const match = url.match(/\/video\/(\d+)/);
    return match ? match[1] : null;
}

// Function to check Supabase connection
async function checkSupabase() {
    console.log('\n🔗 Checking Supabase connection...');
    
    if (window.supabase) {
        console.log('✅ Supabase client found');
        
        const videoId = getVideoIdFromUrl();
        if (videoId) {
            console.log(`Fetching video data for ID: ${videoId}`);
            
            try {
                const { data, error } = await window.supabase
                    .from('videos2')
                    .select('*')
                    .eq('id', videoId)
                    .single();
                
                if (error) {
                    console.error('❌ Supabase error:', error);
                } else {
                    console.log('✅ Video data from Supabase:', data);
                    
                    if (data.video_url) {
                        console.log('Video URL from database:', data.video_url);
                        
                        // Test this URL
                        return testVideoUrl(data.video_url);
                    } else {
                        console.log('❌ No video_url in database record');
                    }
                }
            } catch (e) {
                console.error('❌ Error querying Supabase:', e);
            }
        } else {
            console.log('❌ Could not extract video ID from URL');
        }
    } else {
        console.log('❌ Supabase client not found on window object');
    }
}

// Main debug function
async function runFullDebug() {
    console.clear();
    console.log('🎥 ScreenMerch Video Debug Tool');
    console.log('================================');
    
    checkVideoElement();
    checkReactState();
    checkStorage();
    await checkSupabase();
    
    console.log('\n🛠️ Debug complete!');
    console.log('\nManual test functions available:');
    console.log('- testVideoUrl("your-video-url-here")');
    console.log('- checkVideoElement()');
    console.log('- checkSupabase()');
}

// Make functions available globally
window.testVideoUrl = testVideoUrl;
window.checkVideoElement = checkVideoElement;
window.checkSupabase = checkSupabase;
window.runFullDebug = runFullDebug;

// Auto-run the debug
runFullDebug();
