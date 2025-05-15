// Wrap initialization in an IIFE
(function() {
    // Check if already injected
    if (window.youtubeTranscriptExtractorInjected) {
        console.log('YouTube transcript extractor already injected, skipping...');
        return;
    }
    window.youtubeTranscriptExtractorInjected = true;
    console.log('YouTube transcript extractor content script loaded');

    // Function to extract video ID from YouTube URL
    function getYoutubeVideoId(url) {
        const urlObj = new URL(url);
        if (urlObj.hostname === 'www.youtube.com' || urlObj.hostname === 'youtube.com') {
            return urlObj.searchParams.get('v');
        }
        return null;
    }

    // Function to check if video is playable
    async function isVideoPlayable(videoId) {
        try {
            const response = await fetch(`https://www.youtube.com/oembed?url=http://www.youtube.com/watch?v=${videoId}&format=json`);
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    // Function to extract transcript from an open panel
    async function extractTranscriptFromPanel() {
        try {
            // Look for the transcript panel
            const transcriptPanel = document.querySelector('ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-searchable-transcript"]');
            
            if (!transcriptPanel) {
                throw new Error('Transcript panel not found. Please open the transcript panel first.');
            }

            // Look for transcript segments
            const segments = transcriptPanel.querySelectorAll('ytd-transcript-segment-renderer');
            console.log(`Found ${segments.length} transcript segments`);

            if (segments.length === 0) {
                throw new Error('No transcript segments found. Make sure the transcript is loaded.');
            }

            // Extract text from segments
            const transcriptText = Array.from(segments)
                .map(segment => {
                    // Try different selectors for text content
                    const textContent = segment.querySelector('[id="content-text"]')?.textContent ||
                                      segment.querySelector('[id="text"]')?.textContent ||
                                      segment.querySelector('.segment-text')?.textContent ||
                                      segment.querySelector('.ytd-transcript-segment-renderer')?.textContent ||
                                      segment.textContent;

                    return (textContent || '').trim();
                })
                .filter(text => text)
                .join(' ');

            if (!transcriptText) {
                throw new Error('No text content found in transcript segments');
            }

            console.log('Successfully extracted transcript');
            return transcriptText;
        } catch (error) {
            console.error('Error extracting transcript:', error);
            return null;
        }
    }

    // Listen for messages from the background script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'processYouTubeVideo') {
            // Create an async function to handle the processing
            const processVideo = async () => {
                try {
                    const videoId = getYoutubeVideoId(window.location.href);
                    
                    if (!videoId) {
                        return { success: false, error: 'Not a valid YouTube video URL' };
                    }

                    const isPlayable = await isVideoPlayable(videoId);
                    
                    if (!isPlayable) {
                        return { success: false, error: 'Video is not playable' };
                    }

                    const transcript = await extractTranscriptFromPanel();
                    
                    if (!transcript) {
                        return { success: false, error: 'Could not extract transcript. Please make sure the transcript panel is open.' };
                    }

                    return { success: true, transcript };
                } catch (error) {
                    console.error('Error in processVideo:', error);
                    return { success: false, error: error.message };
                }
            };

            // Execute the async function and send response
            processVideo().then(response => {
                if (!response.success) {
                    console.error('Transcript extraction failed:', response.error);
                }
                sendResponse(response);
            });

            return true; // Keep the message channel open
        }
    });
})(); 