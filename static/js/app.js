// Function to switch screens
function switchScreen(screenId) {
    // Hide all screens
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.add('hidden');
    });
    
    // Show target screen
    document.getElementById(screenId).classList.remove('hidden');
}

// Limits button click handler
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded');
    
    const limitsButton = document.getElementById('limits_button');
    console.log('limits_button found:', limitsButton);

    if (limitsButton) {
        limitsButton.addEventListener('click', function() {
            switchScreen('screen-limits');
        });
    }
});