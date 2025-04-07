console.log('Popup script loaded'); // Debugging line to indicate script loading

async function fetchPatternPrompts(patternName) {
    const systemPrompt = await fetch(`https://raw.githubusercontent.com/danielmiessler/fabric/main/patterns/${patternName}/system.md`)
        .then(response => response.text());

    const userPrompt = await fetch(`https://raw.githubusercontent.com/danielmiessler/fabric/main/patterns/${patternName}/user.md`)
        .then(response => response.text());

    return { systemPrompt, userPrompt };
}

// function extractMainContent() {
//     const mainContent = document.querySelector('main').innerText; // Adjust the selector as needed
//     return `The source code of the main part of the web page which the user is interested in is below:\n${mainContent}`;
// }

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
}


// Call populateDropdown when the document is ready
document.addEventListener('DOMContentLoaded', populateDropdown);

document.getElementById('processButton').addEventListener('click', () => {
    //send message to check configuration
    chrome.runtime.sendMessage({ action: 'checkConfig' });

    // Get the active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length === 0) {
            console.error('No active tab found.');
            return;
        }

        // Send the "extractText" action to the background script
        chrome.runtime.sendMessage({ action: 'extractText' }, (response) => {
            if (response && response.text) {
                const extractedText = response.text; // Store the extracted text for later use

                // Now get the user selected pattern name
                const patternSelect = document.getElementById('patternSelect');
                const selectedPattern = patternSelect.value;

                // Get combined prompts
                getPatternPrompts(selectedPattern).then(({ systemPrompt, userPrompt }) => {
                    // Combine the extracted text with the user prompt
                    userPrompt = `${userPrompt}\n\n${extractedText}`; // Combine the prompts with the extracted text

                    console.log('System Prompt:', systemPrompt); // Debugging line to check system prompt
                    console.log('User Prompt:', userPrompt); // Debugging line to check user prompt

                    // Send the text and prompts to the background script
                    chrome.runtime.sendMessage({
                        action: 'sendToLLM',
                        data: {
                            systemPrompt: systemPrompt,
                            UserPrompt: userPrompt
                        }
                    }, (response) => {
                        const resultContainer = document.getElementById('resultContainer');
                        if (response.success) {
                            // console.log('Response from LLM:', response.result); // Debugging line to check LLM response
                            //get the url of the current tab
                            const currentTab = tabs[0];
                            const currentUrl = currentTab.url;
                            console.log('Current URL:', currentUrl); // Debugging line to check current URL

                            // Append the line [Link to the source](<currentUrl>) to the result
                            response.result += `\n\n[Link to the source](${currentUrl})`;

                            if (resultContainer) {
                                resultContainer.textContent = response.result; // Display the result in the result container
                            } else {
                                console.error('Error: resultContainer element not found.');
                            }
                        } else {
                            console.error('Error from LLM:', response.error);
                            resultContainer.textContent = 'Error: ' + response.error; // Display the error in the result container
                        }
                    });
                });

            } else {
                console.error('Failed to extract text or no response received.');
            }
        });
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
