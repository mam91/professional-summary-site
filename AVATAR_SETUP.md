# How to Add Your Profile Picture

Your AI assistant avatar is now set up to display your photo! Follow these simple steps:

## Quick Setup

1. **Prepare your photo:**
   - Use a square image (e.g., 400x400px or larger)
   - Make sure it's a clear headshot
   - Supported formats: JPG, PNG, WebP

2. **Add your photo to the project:**
   - Place your photo in the `public` folder
   - Name it `avatar.jpg` (or `avatar.png`)
   - Replace the placeholder file at: `/public/avatar.jpg`

3. **If using a different filename:**
   - Edit `employment.json`
   - Update the `"avatar"` field:
     ```json
     "avatar": "/your-photo-name.jpg"
     ```

## Example

```bash
# Option 1: Copy your photo to the public folder
cp ~/Desktop/my-photo.jpg public/avatar.jpg

# Option 2: Use a different name
cp ~/Desktop/my-photo.png public/profile-pic.png
# Then update employment.json: "avatar": "/profile-pic.png"
```

## Current Settings

The avatar will:
- Display as a **circular image** (32x32px)
- Have a **green border** to match the AI theme
- Show on **all AI messages**
- Auto-fit your image using `object-cover`

## Tips

✅ **Best practices:**
- Use a professional headshot
- Ensure good lighting and contrast
- Square aspect ratio works best
- File size under 500KB is ideal

❌ **Avoid:**
- Blurry or low-resolution images
- Images with lots of background
- Very large file sizes (slow loading)

## Testing

After adding your photo, refresh your browser. Your face should now appear next to all AI responses! 🎉

---

**Note:** The user's avatar (blue "U" circle) will remain as-is. Only the AI assistant shows your photo.

