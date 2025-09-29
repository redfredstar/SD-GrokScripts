# 🚀 Grok Prompt Analyzer (Ultimate) - v4.0

The ultimate script for analyzing Grok's hidden video generation prompts, combining all the best features from multiple scripts into one comprehensive solution.

## ✨ Key Features

### 🎯 **Multi-Request Handling**
- **Fixed race conditions** that plagued earlier versions when generating multiple videos rapidly
- Uses `responseId` correlation to properly match requests with responses
- Supports unlimited concurrent video generations without data loss

### 🖼️ **Image Extraction & Display**
- Automatically extracts source image URLs from requests
- Displays source images in the UI with full-size links
- Handles both uploaded images and Grok-generated images
- Shows image thumbnails in history view

### ✏️ **Editable Prompts**
- **All textareas are editable** - modify prompts before copying
- Perfect for "on-the-fly" prompt engineering
- Copy modified versions for immediate reuse

### 🚫 **Content Moderation Detection**
- Detects when content is refused/moderated
- Shows special UI for refused generations with red styling
- Displays only your original prompt for editing and retry
- Tracks refused generations separately in history

### 🔄 **Mode Swapping Integration**
- **Automatically upgrades** video mode from `--mode=normal` to `--mode=extremely-spicy-or-crazy`
- Can be disabled via configuration if needed
- Logs all mode swaps for transparency

### 📚 **Comprehensive History**
- Browse all successful and refused generations
- Click any entry to view full details
- Image thumbnails and metadata for each generation
- Separate views for successful vs refused generations

### 🎨 **Enhanced UI**
- Modern dark theme with professional styling
- Responsive design that works on different screen sizes
- Clear visual distinction between successful and refused generations
- Intuitive navigation between different views

## 🔧 Installation & Usage

### Installation
1. Install a userscript manager like Tampermonkey or Greasemonkey
2. Create a new userscript
3. Copy and paste the entire script content
4. Save and enable the script

### Usage
1. **Navigate to Grok.com** and ensure the script is active
2. **Generate a video** using any image (uploaded or generated)
3. **The script will automatically**:
   - Intercept your request and upgrade the mode (if enabled)
   - Capture the hidden prompt Grok generates
   - Display a popup with your original prompt vs Grok's final prompt
   - Show the source image
   - Allow you to edit and copy prompts

### Configuration
```javascript
// At the top of the script, you can modify:
const MODE_SWAP_ENABLED = true;        // Enable/disable mode swapping
const ORIGINAL_MODE = "--mode=normal"; // Mode to replace
const TARGET_MODE = "--mode=extremely-spicy-or-crazy"; // Replacement mode
```

## 🛠️ How It Works

### Request Interception
1. **Outgoing Request**: Script intercepts POST requests to `/rest/app-chat/conversations/new`
2. **Mode Swap**: If enabled, replaces `--mode=normal` with `--mode=extremely-spicy-or-crazy`
3. **Data Extraction**: Extracts image URL and stores request data with temporary ID

### Response Processing
1. **Initial Response**: Captures the `responseId` from the initial server response
2. **Correlation**: Links the stored request data with the proper `responseId`
3. **Streaming Analysis**: Monitors the streaming response for `progress === 100`
4. **Final Extraction**: Extracts the final prompt and all metadata

### UI Display
- **Success**: Shows side-by-side comparison of your prompt vs Grok's prompt
- **Refusal**: Shows only your prompt with editing capability for retry
- **History**: Browse all generations with thumbnails and metadata

## 🔍 Troubleshooting

### Script Not Working
1. **Check Console**: Open browser dev tools and look for script logs
2. **Verify Installation**: Ensure the script is enabled in your userscript manager
3. **Clear Cache**: Try clearing browser cache and cookies
4. **Check Permissions**: Ensure the script has permission to run on grok.com

### UI Not Appearing
1. **Generate a Video**: The UI only appears after generating a video
2. **Check for Errors**: Look for JavaScript errors in the console
3. **Try Refresh**: Refresh the page and try again

### Mode Swapping Not Working
1. **Check Logs**: Look for "Mode Swapper: Enhanced video mode!" in console
2. **Verify Pattern**: Ensure your prompt contains `--mode=normal`
3. **Disable/Enable**: Try toggling `MODE_SWAP_ENABLED` to test

## 📊 Feature Comparison

| Feature | v2.0 | v3.1 | Ultimate v4.0 |
|---------|------|------|---------------|
| Multi-Request Support | ❌ | ✅ | ✅ |
| Image Extraction | ❌ | ✅ | ✅ |
| Editable Prompts | ❌ | ✅ | ✅ |
| Refusal Handling | ❌ | ✅ | ✅ |
| Mode Swapping | ❌ | ❌ | ✅ |
| History View | ❌ | ✅ | ✅ |
| UI Reliability | ⚠️ | ✅ | ✅ |

## 🎯 Use Cases

### Prompt Engineering
- Analyze how Grok interprets your prompts
- Modify and improve prompts based on Grok's enhancements
- Build prompt libraries for consistent results

### Content Creation
- Understand Grok's creative process
- Fine-tune video generation parameters
- Experiment with different prompt styles

### Research & Analysis
- Study Grok's prompt enhancement patterns
- Track content moderation boundaries
- Build datasets of prompt transformations

## 🆚 Comparison with Other Scripts

### vs. v2.0 (More Compatible)
- **Fixed**: Race conditions with multiple videos
- **Added**: Image display, editable prompts, refusal handling
- **Improved**: UI reliability and error handling

### vs. v3.1 (Multi-Request + Refusal Handling)
- **Added**: Mode swapping integration
- **Enhanced**: UI styling and responsiveness
- **Improved**: Better error handling and logging

### vs. Video Prompt Companion (v7.0)
- **Unified**: All features in one script
- **Better**: Multi-request handling
- **Enhanced**: More comprehensive UI

## 🔮 Future Enhancements

Potential features for future versions:
- Export functionality for prompt libraries
- Advanced prompt diff visualization
- Integration with external prompt databases
- Batch processing capabilities
- Real-time prompt suggestions

## 📝 License & Credits

This script combines and enhances the work from multiple previous versions. Credit goes to the original authors and contributors who built the foundational functionality.

---

**Made with ❤️ for the Grok community**