#!/usr/bin/env python3
"""
Fix Video URL Issue in Frontend
"""

def fix_video_url_issue():
    """Fix the video URL issue in the frontend"""
    
    # Read the Video.jsx file
    with open('frontend/src/Pages/Video/Video.jsx', 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Replace the video URL logic to use videoData instead of videoElement.src
    old_code = '''      // First try server-side screenshot capture
      const currentTime = videoElement.currentTime || 0;
      const videoUrl = videoElement.src;
      
      console.log(`Attempting server-side screenshot capture at ${currentTime}s from ${videoUrl}`);'''
    
    new_code = '''      // First try server-side screenshot capture
      const currentTime = videoElement.currentTime || 0;
      // Use videoData.video_url instead of videoElement.src to get the actual video file
      const videoUrl = videoData?.video_url || videoElement.src;
      
      console.log(`Attempting server-side screenshot capture at ${currentTime}s from ${videoUrl}`);'''
    
    content = content.replace(old_code, new_code)
    
    # Write back to file
    with open('frontend/src/Pages/Video/Video.jsx', 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("✅ Fixed video URL issue in frontend")

if __name__ == "__main__":
    fix_video_url_issue()
