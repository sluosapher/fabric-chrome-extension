console.log('Popup script loaded'); // Debugging line to indicate script loading

const PATTERN_BASE_URL = 'https://raw.githubusercontent.com/danielmiessler/fabric/main/patterns';
const GITHUB_API_URL = 'https://api.github.com/repos/danielmiessler/fabric/contents/patterns';

async function fetchPatternPrompts(patternName) {
    const systemPrompt = await fetch(`${PATTERN_BASE_URL}/${patternName}/system.md`)
        .then(response => response.text());

    const userPrompt = await fetch(`${PATTERN_BASE_URL}/${patternName}/user.md`)
        .then(response => response.text());

    return { systemPrompt, userPrompt };
}

async function getPatternPrompts(patternName) {
    const { systemPrompt, userPrompt } = await fetchPatternPrompts(patternName);
    return { systemPrompt, userPrompt};
}

async function fetchPatternNames() {
    const response = await fetch(GITHUB_API_URL);
    const data = await response.json();
    console.log('Fetched pattern data:', data); // Debugging line to check fetched data
    const patternNames = data.map(item => item.name);
    console.log('Pattern names:', patternNames); // Debugging line to check fetched pattern names
    return patternNames
}

// Function to save the selected pattern to local storage
function saveSelectedPattern(pattern) {
    chrome.storage.local.set({ 'selected_pattern': pattern }, () => {
        console.log('Pattern saved:', pattern);
        updateSelectedPatternDisplay(pattern);
    });
}

// Function to update the selected pattern display
function updateSelectedPatternDisplay(pattern) {
    const selectedPatternElement = document.getElementById('selectedPattern');
    if (selectedPatternElement) {
        selectedPatternElement.textContent = pattern || 'None';
    }
}

async function populateDropdown() {
    console.log('Populating dropdown...'); // Debugging line to indicate dropdown population
    const patternNames = await fetchPatternNames();
    const dropdown = document.getElementById('patternSelect'); // Ensure this ID matches the dropdown in your HTML

    // patternNames.forEach(name => {
    //     const option = document.createElement('option');
    //     option.value = name;
    //     option.textContent = name;
    //     dropdown.appendChild(option);
    // });

    await Promise.all(patternNames.map(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        dropdown.appendChild(option);
    }));
    
    // Load the previously selected pattern from storage
    chrome.storage.local.get(['selected_pattern'], (result) => {
        if (result.selected_pattern) {
            dropdown.value = result.selected_pattern;
            updateSelectedPatternDisplay(result.selected_pattern);
        }
    });
    
    // Add event listener to save the selected pattern when it changes
    dropdown.addEventListener('change', (event) => {
        const selectedPattern = event.target.value;
        saveSelectedPattern(selectedPattern);
    });
}

// Call populateDropdown when the document is ready
document.addEventListener('DOMContentLoaded', populateDropdown);

// Function to check if current page is PDF and show/hide page selector
async function checkAndUpdatePDFUI() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length === 0) return;

    try {
        const response = await new Promise((resolve) => {
            chrome.tabs.sendMessage(tabs[0].id, { action: 'checkIsPDF' }, resolve);
        });
        
        const pdfPageSelector = document.getElementById('pdfPageSelector');
        if (response && response.isPDF) {
            pdfPageSelector.style.display = 'block';
        } else {
            pdfPageSelector.style.display = 'none';
        }
    } catch (error) {
        console.error('Error checking PDF status:', error);
    }
}

// Call this when popup opens
document.addEventListener('DOMContentLoaded', async () => {
    await checkAndUpdatePDFUI();
    // ... rest of your existing DOMContentLoaded code ...
});

document.getElementById('processButton').addEventListener('click', async () => {
    // first showing "working..." message
    let resultContainer = document.getElementById('resultContainer');
    if (resultContainer) {
        resultContainer.textContent = 'Working...';
    } else {
        console.error('Error: resultContainer element not found.');
        return;
    }

    // Check configuration
    const configResponse = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'checkConfig' }, resolve);
    });
    console.log('Configuration check response:', configResponse);
    if (!configResponse.success) {
        console.error('Configuration is invalid:', configResponse.error);
        return;
    }

    // Get the active tab
    const tabs = await new Promise((resolve) => {
        chrome.tabs.query({ active: true, currentWindow: true }, resolve);
    });
    if (tabs.length === 0) {
        console.error('No active tab found.');
        return;
    }

    // Get page range if it's a PDF
    const pageInput = document.getElementById('pageInput');
    const pageRange = pageInput && pageInput.style.display !== 'none' ? pageInput.value : '';

    // Send the "extractText" action to the background script
    const extractResponse = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ 
            action: 'extractText',
            pageRange: pageRange
        }, resolve);
    });
    console.log('Extract response:', extractResponse);
    if (!extractResponse || !extractResponse.text) {
        console.error('Failed to extract text or no response received.');
        return;
    }

    const extractedText = extractResponse.text;

    // Get the user-selected pattern name
    const patternSelect = document.getElementById('patternSelect');
    if (!patternSelect) {
        console.error('Pattern select element not found.');
        alert('Please select a pattern from the dropdown.');
        return;
    }
    const selectedPattern = patternSelect.value;

    // Save the selected pattern to local storage
    saveSelectedPattern(selectedPattern);

    // Get combined prompts
    let systemPrompt, userPrompt;
    try {
        const prompts = await getPatternPrompts(selectedPattern);
        systemPrompt = prompts.systemPrompt;
        userPrompt = prompts.userPrompt;
    } catch (error) {
        console.error('Failed to fetch pattern prompts:', error);
        return;
    }
    const combinedUserPrompt = `${userPrompt}\n\n${extractedText}`;

    console.log('System Prompt:', systemPrompt);
    console.log('User Prompt:', combinedUserPrompt);

    // Send the text and prompts to the background script
    const llmResponse = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
            action: 'sendToLLM',
            data: {
                systemPrompt: systemPrompt,
                UserPrompt: combinedUserPrompt,
            },
        }, resolve);
    });

    resultContainer = document.getElementById('resultContainer');

    if (llmResponse && llmResponse.success && llmResponse.result) {
        const currentTab = tabs[0];
        const currentUrl = currentTab.url;
        llmResponse.result += `\n\n[Link to the source](${currentUrl})`;

        if (resultContainer) {
            resultContainer.innerHTML = llmResponse.result.replace(/\n/g, '<br>');
        } else {
            console.error('Error: resultContainer element not found.');
        }
    } else {
        console.error('Error from LLM:', llmResponse?.error || 'Unknown error');
        if (resultContainer) {
            resultContainer.textContent = 'Error: ' + (llmResponse?.error || 'Unknown error');
        }
    }

    // save the llmResponse.result to system clipboard
    navigator.clipboard.writeText(llmResponse.result).then(() => {
        alert('LLM response copied to clipboard!');
        console.log('LLM response copied to clipboard');
    }).catch(err => {
        alert('Failed to copy text to clipboard. PLease try again.');
        console.error('Failed to copy text: ', err);
    });
});

// Handle the "Config" button click
document.getElementById('configButton').addEventListener('click', () => {
    chrome.storage.local.get(['apiKey', 'apiUrl'], (result) => {
        // Open options.html in a new tab
        chrome.tabs.create({ url: 'options.html' }, () => {
            console.log('Options page opened.');

            // Populate the options page with stored credentials
            if (result.apiKey || result.apiUrl) {
                console.log('Stored credentials:', result);
            } else {
                console.log('No credentials found.');
            }
        });
    });
});
