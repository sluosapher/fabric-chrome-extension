// This function is called when the extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
  console.log('Fabric Extension installed.');
});

// Helper function to check if URL is YouTube
function isYouTubeUrl(url) {
  return url.includes('youtube.com/watch');
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'sendToLLM') {
    const { systemPrompt, UserPrompt } = request.data;
    chrome.storage.local.get(['apiKey', 'apiUrl', 'modelName'], (result) => {
      console.log('Stored API configurations:', result); // Debugging line to check stored credentials
      if (!result.apiKey || !result.apiUrl || !result.modelName) {
        sendResponse({ success: false, error: 'API configurations not set.' });
        return;
      }

      fetch(result.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${result.apiKey}`
        },
        body: JSON.stringify({
          model: result.modelName,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: UserPrompt }
          ],
          max_tokens: 300,
        })
      })
      .then(response => response.json())
      .then(data => {
        console.log('LLM response:', data); // Debugging line to check LLM response
        const message = data.choices[0].message.content;
        console.log('LLM message:', message); // Debugging line to check LLM message
        sendResponse({ success: true, result: message });
      })
      .catch(error => {
        console.error('Error:', error);
        sendResponse({ success: false, error: error.message });
      });
    });

    return true; // Indicates that the response will be sent asynchronously
  }

  if (request.action === 'checkConfig') {
    chrome.storage.local.get(['apiKey', 'apiUrl', 'modelName'], (result) => {
        console.log('Stored API configurations:', result); // Debugging line to check stored credentials
        if (!result.apiKey || !result.apiUrl || !result.modelName) {
            console.log('API configurations not set. Opening options page for input.');
            chrome.runtime.openOptionsPage(); // Opens the extension's options page
            sendResponse({ success: false, error: 'API configurations not set.' }); // Send response
        } else {
            sendResponse({ success: true }); // Send response
        }
    });
    return true; // Indicates that the response will be sent asynchronously
  }

  if (request.action === 'extractText') {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs.length > 0) {
        const currentTab = tabs[0];
        console.log('Current URL:', currentTab.url);

        if (isYouTubeUrl(currentTab.url)) {
          console.log('YouTube URL detected, injecting content script...');
          
          try {
            // First, check if our content script is already injected
            await chrome.scripting.executeScript({
              target: { tabId: currentTab.id },
              func: () => {
                return window.youtubeTranscriptExtractorInjected === true;
              }
            });

            // Inject the content script if not already injected
            await chrome.scripting.executeScript({
              target: { tabId: currentTab.id },
              files: ['youtube-content.js']
            });

            console.log('YouTube content script injected successfully');

            // Send message to content script
            chrome.tabs.sendMessage(currentTab.id, { 
              action: 'processYouTubeVideo'
            }, (response) => {
              console.log('Response from YouTube content script:', response);
              if (response && response.success) {
                sendResponse({ success: true, text: response.transcript });
              } else {
                sendResponse({ 
                  success: false, 
                  error: response?.error || 'Failed to process YouTube video'
                });
              }
            });
          } catch (error) {
            console.error('Error handling YouTube video:', error);
            sendResponse({ success: false, error: error.message });
          }
        } else {
          // Handle non-YouTube content as before
          chrome.tabs.sendMessage(currentTab.id, { 
            action: 'extractText',
            pageRange: request.pageRange 
          }, (response) => {
            sendResponse(response);
          });
        }
      } else {
        sendResponse({ error: 'No active tab found' });
      }
    });
    return true; // Indicates that the response will be sent asynchronously
  }
});
