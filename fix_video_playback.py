#!/usr/bin/env python3
"""
Video Playback Fix Script
This script helps diagnose and fix video playback issues in ScreenMerch
"""

import json
import os
import requests
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize Supabase
supabase_url = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL")
supabase_key = os.getenv("VITE_SUPABASE_ANON_KEY") or os.getenv("SUPABASE_ANON_KEY")

if not supabase_url or not supabase_key:
    print("❌ Missing Supabase credentials")
    exit(1)

supabase: Client = create_client(supabase_url, supabase_key)

def check_video_accessibility():
    """Check if uploaded videos are accessible"""
    print("🔍 Checking video accessibility...")
    
    try:
        # Get recent videos from database
        response = supabase.table('videos2').select('*').order('created_at', desc=True).limit(5).execute()
        videos = response.data
        
        if not videos:
            print("📝 No videos found in database")
            return
        
        print(f"✅ Found {len(videos)} recent videos")
        
        for video in videos:
            print(f"\n📹 Checking video: {video.get('title', 'Untitled')}")
            video_url = video.get('video_url')
            
            if not video_url:
                print("   ❌ No video URL found")
                continue
            
            print(f"   🔗 URL: {video_url}")
            
            # Test HTTP access
            try:
                response = requests.head(video_url, timeout=10)
                print(f"   📊 HTTP Status: {response.status_code}")
                
                if response.status_code == 200:
                    print("   ✅ Video URL is accessible")
                    
                    # Check headers
                    content_type = response.headers.get('content-type', '')
                    content_length = response.headers.get('content-length', '')
                    
                    print(f"   📋 Content-Type: {content_type}")
                    if content_length:
                        size_mb = int(content_length) / (1024 * 1024)
                        print(f"   💾 Size: {size_mb:.2f} MB")
                    
                    # Check if it's a video type
                    if 'video' in content_type:
                        print("   ✅ Valid video content type")
                    else:
                        print(f"   ⚠️ Unexpected content type: {content_type}")
                        
                else:
                    print(f"   ❌ HTTP Error: {response.status_code}")
                    
            except requests.exceptions.RequestException as e:
                print(f"   ❌ Network Error: {e}")
                
    except Exception as e:
        print(f"❌ Database Error: {e}")

def check_supabase_storage():
    """Check Supabase storage configuration"""
    print("\n🗄️ Checking Supabase storage...")
    
    try:
        # List buckets
        buckets = supabase.storage.list_buckets()
        print(f"✅ Found {len(buckets)} storage buckets")
        
        for bucket in buckets:
            bucket_name = bucket.get('name')
            print(f"   📁 Bucket: {bucket_name}")
            
            if bucket_name == 'videos2':
                print("   ✅ videos2 bucket found")
                
                # Check bucket policy
                try:
                    # List some files in the bucket
                    files = supabase.storage.from_('videos2').list()
                    print(f"   📂 Files in bucket: {len(files)}")
                    
                    # Test public access
                    if files:
                        first_file = files[0]
                        file_path = first_file.get('name')
                        public_url = supabase.storage.from_('videos2').get_public_url(file_path)
                        print(f"   🔗 Public URL format: {public_url}")
                        
                except Exception as e:
                    print(f"   ❌ Bucket access error: {e}")
                    
    except Exception as e:
        print(f"❌ Storage check error: {e}")

def fix_video_urls():
    """Fix video URLs that might be malformed"""
    print("\n🔧 Fixing video URLs...")
    
    try:
        # Get videos with potentially problematic URLs
        response = supabase.table('videos2').select('*').execute()
        videos = response.data
        
        fixed_count = 0
        for video in videos:
            video_id = video.get('id')
            video_url = video.get('video_url', '')
            
            # Check if URL needs fixing
            if video_url and not video_url.startswith('http'):
                print(f"🔧 Fixing URL for video {video_id}")
                
                # Construct proper Supabase URL
                if video_url.startswith('/'):
                    video_url = video_url[1:]  # Remove leading slash
                
                new_url = f"{supabase_url}/storage/v1/object/public/videos2/{video_url}"
                
                # Update in database
                update_response = supabase.table('videos2').update({
                    'video_url': new_url
                }).eq('id', video_id).execute()
                
                if update_response.data:
                    print(f"   ✅ Updated video {video_id}")
                    fixed_count += 1
                else:
                    print(f"   ❌ Failed to update video {video_id}")
        
        print(f"\n✅ Fixed {fixed_count} video URLs")
        
    except Exception as e:
        print(f"❌ Error fixing URLs: {e}")

def generate_test_video_html():
    """Generate HTML file to test video playback"""
    print("\n🧪 Generating test video HTML...")
    
    try:
        # Get a recent video
        response = supabase.table('videos2').select('*').order('created_at', desc=True).limit(1).execute()
        videos = response.data
        
        if not videos:
            print("❌ No videos found for testing")
            return
        
        video = videos[0]
        video_url = video.get('video_url')
        title = video.get('title', 'Test Video')
        
        html_content = f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Video Playback Test - {title}</title>
    <style>
        body {{
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }}
        video {{
            width: 100%;
            max-width: 600px;
            height: auto;
            border: 1px solid #ccc;
        }}
        .info {{
            margin: 20px 0;
            padding: 10px;
            background: #f5f5f5;
            border-radius: 5px;
        }}
        .error {{
            color: red;
            font-weight: bold;
        }}
        .success {{
            color: green;
            font-weight: bold;
        }}
    </style>
</head>
<body>
    <h1>Video Playback Test</h1>
    <h2>{title}</h2>
    
    <div class="info">
        <strong>Video URL:</strong> {video_url}
    </div>
    
    <video controls crossorigin="anonymous">
        <source src="{video_url}" type="video/mp4">
        Your browser does not support the video tag.
    </video>
    
    <div id="status" class="info">
        <strong>Status:</strong> <span id="status-text">Loading...</span>
    </div>
    
    <script>
        const video = document.querySelector('video');
        const statusText = document.getElementById('status-text');
        
        video.addEventListener('loadedmetadata', () => {{
            statusText.textContent = 'Video metadata loaded successfully';
            statusText.className = 'success';
            console.log('Video duration:', video.duration);
            console.log('Video dimensions:', video.videoWidth, 'x', video.videoHeight);
        }});
        
        video.addEventListener('canplay', () => {{
            statusText.textContent = 'Video can play';
            statusText.className = 'success';
        }});
        
        video.addEventListener('error', (e) => {{
            statusText.textContent = 'Video loading failed: ' + (video.error ? video.error.message : 'Unknown error');
            statusText.className = 'error';
            console.error('Video error:', e);
        }});
        
        video.addEventListener('loadstart', () => {{
            console.log('Video load started');
        }});
        
        video.addEventListener('progress', () => {{
            console.log('Video loading progress');
        }});
        
        // Test URL accessibility
        fetch('{video_url}', {{ method: 'HEAD' }})
            .then(response => {{
                console.log('HTTP Status:', response.status);
                console.log('Content-Type:', response.headers.get('content-type'));
                console.log('Content-Length:', response.headers.get('content-length'));
            }})
            .catch(error => {{
                console.error('Fetch error:', error);
            }});
    </script>
</body>
</html>
        """
        
        with open('video_test.html', 'w') as f:
            f.write(html_content)
        
        print("✅ Generated video_test.html")
        print("📂 Open video_test.html in your browser to test video playback")
        
    except Exception as e:
        print(f"❌ Error generating test HTML: {e}")

def main():
    """Main function"""
    print("🎥 ScreenMerch Video Playback Troubleshooter")
    print("=" * 50)
    
    check_supabase_storage()
    check_video_accessibility()
    
    print("\n" + "=" * 50)
    
    fix_choice = input("🔧 Do you want to attempt to fix video URLs? (y/N): ").strip().lower()
    if fix_choice == 'y':
        fix_video_urls()
    
    test_choice = input("🧪 Do you want to generate a test HTML file? (y/N): ").strip().lower()
    if test_choice == 'y':
        generate_test_video_html()
    
    print("\n✅ Troubleshooting complete!")
    print("\n📋 Summary of fixes applied:")
    print("1. ✅ Fixed PlayVideo component to use actual video URLs")
    print("2. ✅ Updated Content Security Policy to allow video sources")
    print("3. ✅ Added video file types to allowed extensions")
    print("4. ✅ Increased file size limit for videos")
    
    print("\n🔄 Next steps:")
    print("1. Restart your backend server")
    print("2. Clear browser cache")
    print("3. Try uploading and playing a new video")
    print("4. Use the debug script (debug_video_playback.js) in browser console")

if __name__ == "__main__":
    main()
