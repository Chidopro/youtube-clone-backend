-- Keep the original upload for FrameSnag / 300 DPI print; video_url becomes the web playback file.
ALTER TABLE public.videos2
  ADD COLUMN IF NOT EXISTS source_video_url text;
