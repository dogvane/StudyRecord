document.addEventListener('DOMContentLoaded', function () {
    const featureToggle = document.getElementById('featureToggle');
    const serverAddressInput = document.getElementById('serverAddress');
    const defaultServerAddress = 'http://127.0.0.1:5273/';

    // Load saved settings
    chrome.storage.sync.get(['featureEnabled', 'serverAddress'], function (data) {
        // Set toggle state, default to false (disabled) if not set
        featureToggle.checked = data.featureEnabled === undefined ? false : data.featureEnabled;
        
        // Set server address, use default if not set or empty
        serverAddressInput.value = data.serverAddress || defaultServerAddress;
    });

    // Save feature toggle state
    featureToggle.addEventListener('change', function () {
        chrome.storage.sync.set({ featureEnabled: this.checked }, function() {
            if (chrome.runtime.lastError) {
                console.error('Error setting featureEnabled:', chrome.runtime.lastError);
            }
        });
    });

    // Save server address on input change
    serverAddressInput.addEventListener('input', function () {
        chrome.storage.sync.set({ serverAddress: this.value.trim() }, function() {
            if (chrome.runtime.lastError) {
                console.error('Error setting serverAddress:', chrome.runtime.lastError);
            }
        });
    });

    // Also save server address on blur, in case input event doesn't cover all changes
    // or if user pastes and clicks away.
    serverAddressInput.addEventListener('blur', function () {
        const currentAddress = this.value.trim();
        // If empty after blur, reset to default to ensure it's never stored as empty
        // Or, you might want to allow empty if that's a valid state.
        // For now, let's ensure it's not empty or revert to default.
        if (currentAddress === "") {
            serverAddressInput.value = defaultServerAddress;
             chrome.storage.sync.set({ serverAddress: defaultServerAddress });
        } else {
             chrome.storage.sync.set({ serverAddress: currentAddress });
        }
    });
});