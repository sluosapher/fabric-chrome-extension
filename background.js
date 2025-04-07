function checkAndPromptForCredentials() {
  chrome.storage.local.get(['apiKey', 'apiUrl'], (result) => {
    console.log('Stored API credentials:', result); // Debugging line to check stored credentials
    if (!result.apiKey || !result.apiUrl) {
      console.log('API credentials not set. Opening options page for input.');
      chrome.runtime.openOptionsPage(); // Opens the extension's options page
    } else {
      console.log('API credentials are set. Opening popup.');
      chrome.windows.create({
        url: 'popup.html',
        type: 'popup',
        width: 400,
        height: 600
      });
    }
  });
}

// Remove the call from the onInstalled listener
chrome.runtime.onInstalled.addListener(() => {
  console.log('Fabric Extension installed.');
});

// // Add a listener for the extension button click
// chrome.action.onClicked.addListener(() => {
//   console.log('Extension button clicked.');
//   checkAndPromptForCredentials();
// });


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'sendToLLM') {
    const { systemPrompt, UserPrompt } = request.data;
    chrome.storage.local.get(['apiKey', 'apiUrl'], (result) => {
      console.log('Stored API credentials:', result); // Debugging line to check stored credentials
      if (!result.apiKey || !result.apiUrl) {
        sendResponse({ success: false, error: 'API credentials not set.' });
        return;
      }

      fetch(result.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${result.apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: UserPrompt }
          ],
          max_tokens: 150
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
});
