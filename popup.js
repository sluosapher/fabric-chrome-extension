console.log('Popup script loaded'); // Debugging line to indicate script loading

async function fetchPatternPrompts(patternName) {
    const systemPrompt = await fetch(`https://raw.githubusercontent.com/danielmiessler/fabric/main/patterns/${patternName}/system.md`)
        .then(response => response.text());

    const userPrompt = await fetch(`https://raw.githubusercontent.com/danielmiessler/fabric/main/patterns/${patternName}/user.md`)
        .then(response => response.text());

    return { systemPrompt, userPrompt };
}

async function getPatternPrompts(patternName) {
    const { systemPrompt, userPrompt } = await fetchPatternPrompts(patternName);
    return { systemPrompt, userPrompt};
}

async function fetchPatternNames() {
    const response = await fetch('https://api.github.com/repos/danielmiessler/fabric/contents/patterns');
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

    patternNames.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        dropdown.appendChild(option);
    });
    
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

document.getElementById('processButton').addEventListener('click', async () => {
    // Check configuration
    const configResponse = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'checkConfig' }, resolve);
    });
    console.log('Configuration check response:', configResponse); // Debugging line to check configuration response
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

    // Send the "extractText" action to the background script
    const extractResponse = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'extractText' }, resolve);
    });
    console.log('Extract response:', extractResponse); // Debugging line to check extract response
    if (!extractResponse || !extractResponse.text) {
        console.error('Failed to extract text or no response received.');
        return;
    }

    const extractedText = extractResponse.text;

    // Get the user-selected pattern name
    const patternSelect = document.getElementById('patternSelect');
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

    const resultContainer = document.getElementById('resultContainer');
    if (llmResponse && llmResponse.success) {
        const currentTab = tabs[0];
        const currentUrl = currentTab.url;
        llmResponse.result += `\n\n[Link to the source](${currentUrl})`;

        if (resultContainer) {
            resultContainer.textContent = llmResponse.result;
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
        // prompt the user that the text has been copied to clipboard with an alert
        alert('LLM response copied to clipboard!');
        console.log('LLM response copied to clipboard');
    }).catch(err => {
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
