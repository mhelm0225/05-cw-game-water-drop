// Variables to control game state
let gameRunning = false; // Keeps track of whether game is active or not
let dropMaker; // Will store our timer that creates drops regularly
let timeRemaining = 30; // Time remaining in seconds
let timerInterval; // Will store our timer that updates the time
let score = 0; // Player's score
const baseTargetScore = 20; // Base score needed for level 1
let currentLevel = 1; // Current game level
let levelThresholds = []; // Array to store score thresholds for each level
let scorePerDrop = 1; // Score added per good drop, increases by 2 per level
let lives = 3; // Player starts with 3 lives
let redDropRate = 0.10; // Fixed rate for red drops, starts at 10% and doubles per level, capped at 70%
let highScore = 0; // Player's highest score achieved
let gameDifficulty = "normal"; // Default difficulty setting
let isEndlessMode = false; // Flag for endless mode
let dropSpeedMultiplier = 1.0; // Multiplier for drop falling speed
let endlessSpeedInterval; // Interval for increasing speed in endless mode

// Arrays of game-end messages
const winningMessages = [
  "Awesome job! You're a water-catching pro!",
  "Splash-tastic! You've mastered the game!",
  "Incredible! You're making waves with that score!",
  "Drip, drop, winner! Amazing performance!",
  "You're fluid with those drops! Great job!"
];

const losingMessages = [
  "Almost there! Try to catch a few more drops next time.",
  "Don't dry out! Keep practicing and you'll improve.",
  "Every drop counts! You'll do better next round.",
  "Stay hydrated and try again for a higher score!",
  "The water is still flowing! Give it another try."
];

// Load high score from localStorage when the script loads
document.addEventListener("DOMContentLoaded", () => {
  highScore = parseInt(localStorage.getItem("highScore")) || 0;
  document.getElementById("high-score").textContent = highScore;
  
  // Initialize sound elements
  initSounds();
});

// Sound management
const sounds = {
  dropSound: null,
  badDropSound: null,
  levelCompleteSound: null,
  gameOverSound: null,
  backgroundMusic: null,
  isMuted: false
};

// Sound toggle functionality
document.getElementById("sound-toggle").addEventListener("click", function() {
  sounds.isMuted = !sounds.isMuted;
  this.textContent = sounds.isMuted ? "🔇" : "🔊";
  this.classList.toggle("muted", sounds.isMuted);
  
  if (sounds.isMuted) {
    // Pause background music if it's playing
    if (sounds.backgroundMusic && !sounds.backgroundMusic.paused) {
      sounds.backgroundMusic.pause();
    }
  } else {
    // Resume background music if game is running
    if (gameRunning && sounds.backgroundMusic) {
      sounds.backgroundMusic.play().catch(e => console.log("Playback prevented by browser policy"));
    }
  }
});

function initSounds() {
  // Get all audio elements
  sounds.dropSound = document.getElementById("drop-sound");
  sounds.badDropSound = document.getElementById("bad-drop-sound");
  sounds.levelCompleteSound = document.getElementById("level-complete-sound");
  sounds.gameOverSound = document.getElementById("game-over-sound");
  sounds.backgroundMusic = document.getElementById("background-music");
  
  // Set volumes
  sounds.dropSound.volume = 0.5;
  sounds.badDropSound.volume = 0.5;
  sounds.levelCompleteSound.volume = 0.7;
  sounds.gameOverSound.volume = 0.7;
  sounds.backgroundMusic.volume = 0.3;
  
  // Add error handling for sound loading
  const audioElements = [
    sounds.dropSound, 
    sounds.badDropSound, 
    sounds.levelCompleteSound, 
    sounds.gameOverSound, 
    sounds.backgroundMusic
  ];
  
  audioElements.forEach(audio => {
    // Add error listener
    audio.addEventListener('error', function(e) {
      console.warn(`Error loading sound file: ${audio.id}`, e);
    });
    
    // Add load listener for debugging
    audio.addEventListener('canplaythrough', function() {
      console.log(`Sound file loaded successfully: ${audio.id}`);
    });
  });
}

// Function to play a sound
function playSound(sound) {
  if (!sounds.isMuted && sound) {
    // Check if sound is loaded and ready to play
    if (sound.readyState >= 2) {
      // Reset sound to beginning
      sound.currentTime = 0;
      sound.play().catch(e => {
        // Handle autoplay restrictions by showing a play button
        if (e.name === 'NotAllowedError') {
          console.log("Audio play was prevented by browser. User interaction required.");
        } else {
          console.warn("Error playing sound:", e);
        }
      });
    } else {
      // Sound is not loaded yet, add an event listener to play it when ready
      const onCanPlay = () => {
        sound.play().catch(e => console.warn("Error playing sound after load:", e));
        sound.removeEventListener('canplaythrough', onCanPlay);
      };
      
      sound.addEventListener('canplaythrough', onCanPlay);
      
      // Add a timeout in case the sound doesn't load
      setTimeout(() => {
        sound.removeEventListener('canplaythrough', onCanPlay);
      }, 5000);
    }
  }
}

// Calculate score thresholds for each level
function calculateLevelThresholds(maxLevels = 10) {
  levelThresholds = [0]; // Level 0 (doesn't exist) has threshold of 0
  
  let threshold = 0;
  for (let i = 1; i <= maxLevels; i++) {
    // Each level requires baseTargetScore + (level-1)*50 points more than the previous level
    threshold += baseTargetScore + ((i-1) * 50);
    levelThresholds.push(threshold);
  }
  
  return levelThresholds;
}

// Calculate initial thresholds
calculateLevelThresholds();

// Setup near-miss click detection for easier drop collection
setupNearMissDetection();

// Function to update the lives display
function updateLivesDisplay() {
  const livesDisplay = document.getElementById("lives-display");
  livesDisplay.textContent = "❤️".repeat(lives);
}

// Function to create a red flash effect when a life is lost
function flashScreenRed() {
  // Create a flash element
  const flash = document.createElement("div");
  flash.className = "screen-flash";
  document.body.appendChild(flash);
  
  // Remove the flash after animation completes
  setTimeout(() => {
    if (flash.parentNode) {
      flash.parentNode.removeChild(flash);
    }
  }, 300);
}

// Wait for button click to show difficulty menu
document.getElementById("start-btn").addEventListener("click", function() {
  // Initialize audio after user interaction to overcome autoplay restrictions
  initializeAudioAfterUserInteraction();
  showDifficultyMenu();
});

// Function to initialize audio after user interaction
function initializeAudioAfterUserInteraction() {
  // Try to play and immediately pause all sounds to unlock them
  const audioElements = [
    sounds.dropSound, 
    sounds.badDropSound, 
    sounds.levelCompleteSound, 
    sounds.gameOverSound, 
    sounds.backgroundMusic
  ];
  
  audioElements.forEach(audio => {
    if (audio) {
      // Short play/pause to unlock audio
      audio.volume = 0;
      audio.play().then(() => {
        audio.pause();
        audio.currentTime = 0;
        // Reset volume to original values
        if (audio === sounds.dropSound || audio === sounds.badDropSound) {
          audio.volume = 0.5;
        } else if (audio === sounds.levelCompleteSound || audio === sounds.gameOverSound) {
          audio.volume = 0.7;
        } else if (audio === sounds.backgroundMusic) {
          audio.volume = 0.3;
        }
      }).catch(e => {
        console.warn("Could not initialize audio:", e);
      });
    }
  });
}

// Function to show the difficulty selection menu
function showDifficultyMenu() {
  document.getElementById("difficulty-modal").classList.add("show");
  
  // Add click event listener for the close button
  document.getElementById("close-difficulty-btn").addEventListener("click", function() {
    document.getElementById("difficulty-modal").classList.remove("show");
  });
  
  // Add click event listeners for difficulty options
  const difficultyOptions = document.querySelectorAll(".difficulty-option");
  difficultyOptions.forEach(option => {
    option.addEventListener("click", function() {
      // Remove selected class from all options
      difficultyOptions.forEach(opt => opt.classList.remove("selected"));
      // Add selected class to clicked option
      this.classList.add("selected");
      
      // Set the game difficulty
      gameDifficulty = this.getAttribute("data-difficulty");
      
      // Check if endless mode is selected
      isEndlessMode = gameDifficulty === "endless";
      
      // Hide the modal
      document.getElementById("difficulty-modal").classList.remove("show");
      
      // Start the game with the selected difficulty
      startGame();
    });
  });
}

// Add event listener for the "Play Again" button
document.getElementById("play-again-btn").addEventListener("click", function() {
  // Hide the modal
  document.getElementById("end-game-modal").classList.remove("show");
  // Reset to level 1
  currentLevel = 1;
  // Show difficulty menu again
  showDifficultyMenu();
});

// Add event listener for the "Continue to Next Level" button
document.getElementById("next-level-btn").addEventListener("click", function() {
  // Hide the level complete modal
  document.getElementById("level-complete-modal").classList.remove("show");
  // Increment the level
  currentLevel++;
  // Keep track of the remaining time to add as a bonus to the base time
  const bonusTime = timeRemaining;
  // Add the bonus time to the base 30 seconds for the next level
  timeRemaining = 30 + bonusTime;
  // Start the next level
  startNextLevel();
});

// Add event listener for the "End Game" button
document.getElementById("end-level-btn").addEventListener("click", function() {
  // Hide the level complete modal
  document.getElementById("level-complete-modal").classList.remove("show");
  // End the game with current score
  endGame(true); // Pass true to indicate successful completion
});

// Add near-miss detection for easier collection
function setupNearMissDetection() {
  const gameContainer = document.getElementById("game-container");
  
  // Add click handler to the game container
  gameContainer.addEventListener("click", (event) => {
    if (!gameRunning) return;
    
    // Only process if the click wasn't directly on a drop (those are handled separately)
    if (event.target.classList.contains("water-drop")) return;
    
    // Get all drops in the game
    const drops = document.getElementsByClassName("water-drop");
    
    // Check if any drop is near the click location
    const nearMissThreshold = 40; // pixels
    const clickX = event.clientX;
    const clickY = event.clientY;
    
    for (const drop of drops) {
      if (drop.classList.contains("clicked")) continue;
      
      const rect = drop.getBoundingClientRect();
      const dropCenterX = rect.left + rect.width / 2;
      const dropCenterY = rect.top + rect.height / 2;
      
      // Calculate distance between click and drop center
      const distance = Math.sqrt(
        Math.pow(clickX - dropCenterX, 2) + Math.pow(clickY - dropCenterY, 2)
      );
      
      // If click is close enough, simulate clicking the drop
      if (distance <= nearMissThreshold) {
        drop.click();
        break; // Only trigger one near-miss at a time
      }
    }
  });
}

function startGame() {
  // Prevent multiple games from running at once
  if (gameRunning) return;

  gameRunning = true;
  
  // Start background music
  playSound(sounds.backgroundMusic);
  
  // Set initial game parameters based on difficulty
  switch(gameDifficulty) {
    case "easy":
      timeRemaining = 45; // More time in easy mode
      lives = 5; // More lives in easy mode
      dropSpeedMultiplier = 0.7; // Slower drops in easy mode
      break;
    case "normal":
      timeRemaining = 30; // Standard time
      lives = 3; // Standard lives
      dropSpeedMultiplier = 1.0; // Standard speed
      break;
    case "hard":
      timeRemaining = 30; // Same time as normal
      lives = 3; // Same lives as normal
      dropSpeedMultiplier = 1.5; // Faster drops in hard mode
      break;
    case "endless":
      timeRemaining = 30; // Start with standard time
      lives = 3; // Standard lives
      dropSpeedMultiplier = 1.0; // Start with standard speed
      
      // Set up speed increase interval for endless mode (every 90 seconds)
      endlessSpeedInterval = setInterval(() => {
        // Increase drop speed by 10% every 90 seconds
        dropSpeedMultiplier += 0.1;
        
        // Show a notification of increasing speed
        const speedNotification = document.createElement("div");
        speedNotification.className = "level-announcement";
        speedNotification.textContent = "Speed Increased!";
        speedNotification.style.fontSize = "36px";
        document.getElementById("game-container").appendChild(speedNotification);
        
        // Make it visible
        speedNotification.classList.add("show");
        
        // Remove after animation
        setTimeout(() => {
          speedNotification.classList.remove("show");
          setTimeout(() => speedNotification.remove(), 500);
        }, 2000);
        
      }, 90000); // 90 seconds (1:30)
      break;
  }
  
  document.getElementById("time").textContent = timeRemaining;
  
  // Reset score and game parameters
  score = 0;
  currentLevel = 1;
  scorePerDrop = 1; // Reset score per drop to 1 for level 1
  redDropRate = 0.10; // Reset red drop rate to 10%
  document.getElementById("score").textContent = score;
  document.getElementById("level").textContent = isEndlessMode ? "Endless" : currentLevel;
  updateLivesDisplay(); // Update the lives display
  
  // Only show progress bar if not in endless mode
  if (!isEndlessMode) {
    document.querySelector(".progress-container").style.display = "block";
    updateProgressBar(0);
  } else {
    document.querySelector(".progress-container").style.display = "none";
  }
  
  // Start the countdown timer
  timerInterval = setInterval(updateTimer, 1000);

  // Create new drops every second, adjusted for level and difficulty
  const baseInterval = 1000; // Base interval of 1 second
  let dropInterval;
  
  if (isEndlessMode) {
    // In endless mode, start with standard interval
    dropInterval = Math.max(200, baseInterval / dropSpeedMultiplier);
  } else {
    // In level-based modes, adjust for level and difficulty
    dropInterval = Math.max(200, baseInterval - ((currentLevel - 1) * 150));
    // Apply difficulty multiplier
    dropInterval = Math.max(200, dropInterval / dropSpeedMultiplier);
  }
  
  dropMaker = setInterval(createDrop, dropInterval);
}

function startNextLevel() {
  // Prevent multiple games from running at once
  if (gameRunning) return;

  gameRunning = true;
  
  // Special handling for Sudden Death level (level 11)
  if (currentLevel === 11) {
    // Sudden Death level: 1 life, no timer, double score
    lives = 1;
    updateLivesDisplay();
    clearInterval(timerInterval); // No timer
    document.getElementById("time").textContent = "∞"; // Infinite time
    scorePerDrop = (1 + ((currentLevel - 1) * 2)) * 2; // Double score
  } else {
    // Regular level progression
    // The timeRemaining variable now contains the base 30 seconds plus the bonus time
    // from the previous level (set in the next-level-btn click handler)
    document.getElementById("time").textContent = timeRemaining;
    
    // Lives are carried over from the previous level, no changes needed here
    updateLivesDisplay(); // Update the lives display
    
    // Set the red drop rate based on the current level
    // 10% at level 1, increases by 10% per level until 70% at level 7
    if (currentLevel <= 7) {
      redDropRate = 0.10 * currentLevel; // 10%, 20%, 30%, 40%, 50%, 60%, 70%
    } else {
      redDropRate = 0.70; // Cap at 70% for level 8 and beyond
    }
    
    // Increase score per drop by 2 for each level
    scorePerDrop = 1 + ((currentLevel - 1) * 2);
  }
  
  // Update level display
  document.getElementById("level").textContent = currentLevel === 11 ? "Sudden Death" : currentLevel;
  
  // Keep the current score
  document.getElementById("score").textContent = score;
  
  // Show level announcement
  showLevelAnnouncement();
  
  // Update progress bar for this level
  updateProgressBar(score);
  
  // Start the countdown timer
  timerInterval = setInterval(updateTimer, 1000);

  // Create new drops with increasing frequency based on level
  // More aggressive decrease in interval for faster spawn rate
  let dropInterval = Math.max(200, 1000 - ((currentLevel - 1) * 150));
  
  // Apply difficulty multiplier
  dropInterval = Math.max(200, dropInterval / dropSpeedMultiplier);
  
  dropMaker = setInterval(createDrop, dropInterval);
  
  // Show a level announcement
  showLevelAnnouncement();
}

function showLevelCompleteModal() {
  // Pause the game
  pauseGame();
  
  // Play level complete sound
  playSound(sounds.levelCompleteSound);
  
  // Update the level score display
  document.getElementById("level-score").textContent = score;
  
  // Get the points needed for the next level
  const nextLevel = currentLevel + 1;
  const pointsForNextLevel = levelThresholds[nextLevel] - levelThresholds[nextLevel - 1];
  
  // Update the modal to show the next level's requirement, remaining time bonus, and score per drop
  const levelCompleteModal = document.getElementById("level-complete-modal");
  const messageElement = levelCompleteModal.querySelector("p:nth-child(3)");
  const nextLevelScorePerDrop = 1 + ((nextLevel - 1) * 2);
  
  // Calculate the next level's red drop rate based on the level
  // 10% at level 1, increases by 10% per level until 70% at level 7
  let nextRedDropRate;
  if (nextLevel <= 7) {
    nextRedDropRate = 0.10 * nextLevel; // 10%, 20%, 30%, 40%, 50%, 60%, 70%
  } else {
    nextRedDropRate = 0.70; // Cap at 70% for level 8 and beyond
  }
  const nextBadDropChance = Math.round(nextRedDropRate * 100);
  
  // Add a warning if red drop rate is increasing
  const redDropWarning = nextLevel <= 7 ? 
    `<span style="color: #F5402C;">Warning:</span> Red drop rate increases to <strong>${nextBadDropChance}%</strong>!<br>` : '';
  
  messageElement.innerHTML = `Next level will require <strong>${pointsForNextLevel}</strong> points to complete! <br>
    You'll get the base 30 seconds PLUS your remaining <strong>${timeRemaining}</strong> seconds as bonus time! <br>
    Each drop will now be worth <strong>${nextLevelScorePerDrop}</strong> points! <br>
    ${redDropWarning}
    You'll see red drops <strong>${nextBadDropChance}%</strong> of the time in the next level!`;
  
  // Show the modal
  levelCompleteModal.classList.add("show");
}

function showLevelAnnouncement() {
  // Skip in endless mode
  if (isEndlessMode) {
    return;
  }
  
  // Update the level number in the announcement
  document.getElementById("announcement-level").textContent = currentLevel;
  
  // Show the announcement
  const announcement = document.getElementById("level-announcement");
  announcement.classList.add("show");
  
  // Remove the announcement after animation completes
  setTimeout(() => {
    announcement.classList.remove("show");
  }, 2000);
}

function updateTimer() {
  // Decrease the time remaining
  timeRemaining--;
  
  // Update the timer display
  document.getElementById("time").textContent = timeRemaining;
  
  // Check if time is up
  if (timeRemaining <= 0) {
    endGame();
  }
}

// Function to update the progress bar
function updateProgressBar(currentScore) {
  // Skip in endless mode
  if (isEndlessMode) {
    return;
  }
  
  const progressBar = document.getElementById("score-progress");
  
  // Get current level threshold and next level threshold
  const currentLevelThreshold = levelThresholds[currentLevel - 1];
  const nextLevelThreshold = levelThresholds[currentLevel];
  
  // Calculate the points needed to complete this level
  const pointsForThisLevel = nextLevelThreshold - currentLevelThreshold;
  
  // Calculate progress within the current level
  const levelProgress = currentScore - currentLevelThreshold;
  const levelPercentage = (levelProgress / pointsForThisLevel) * 100;
  
  // Cap the percentage at 100%
  const percentage = Math.min(levelPercentage, 100);
  
  // Update the width of the progress bar
  progressBar.style.width = percentage + "%";
  
  // Change color when complete
  if (percentage >= 100) {
    progressBar.style.background = "linear-gradient(to right, #FFC907, #4FCB53)"; // Yellow to green
    
    // Show level complete modal if we just reached this level's target score
    // and we haven't already shown it for this level
    if (score >= nextLevelThreshold && gameRunning) {
      showLevelCompleteModal();
    }
  }
}

// Function to create splash effect when drops are clicked
function createSplash(drop, color) {
  const splash = document.createElement("div");
  splash.className = "splash";
  
  // Position splash at the drop's location
  const dropRect = drop.getBoundingClientRect();
  const containerRect = document.getElementById("game-container").getBoundingClientRect();
  
  splash.style.left = (dropRect.left - containerRect.left + dropRect.width / 2) + "px";
  splash.style.top = (dropRect.top - containerRect.top + dropRect.height / 2) + "px";
  splash.style.backgroundColor = color;
  
  // Add splash to the game container
  document.getElementById("game-container").appendChild(splash);
  
  // Remove splash after animation completes
  setTimeout(() => {
    if (splash.parentNode) {
      splash.parentNode.removeChild(splash);
    }
  }, 300);
}

function pauseGame() {
  // Just pause the game without ending it
  clearInterval(dropMaker);
  clearInterval(timerInterval);
  gameRunning = false;
}

function endGame(levelCompleted = false, noLivesRemaining = false) {
  // Stop the game
  gameRunning = false;
  
  // Stop the background music
  if (sounds.backgroundMusic) {
    sounds.backgroundMusic.pause();
    sounds.backgroundMusic.currentTime = 0;
  }
  
  // Play game over sound
  playSound(sounds.gameOverSound);
  
  // Clear all intervals
  clearInterval(dropMaker);
  clearInterval(timerInterval);
  
  // Also clear endless mode speed increase interval if it exists
  if (endlessSpeedInterval) {
    clearInterval(endlessSpeedInterval);
    endlessSpeedInterval = null;
  }
  
  // Check if the current score is a new high score
  if (score > highScore) {
    highScore = score;
    localStorage.setItem("highScore", highScore);
    document.getElementById("high-score").textContent = highScore;
  }
  
  // Remove all drops
  const drops = document.getElementsByClassName("water-drop");
  while(drops.length > 0) {
    drops[0].remove();
  }
  
  // Get final score
  const finalScore = score;
  
  // Handle game ending
  if (levelCompleted) {
    // The player chose to end after completing a level
    const message = `Congratulations! You reached level ${currentLevel} with ${finalScore} points!`;
    
    // Update the modal content for a successful game completion
    document.getElementById("final-score").textContent = finalScore;
    document.getElementById("end-game-message").textContent = message;
    document.getElementById("end-game-message").style.color = "#4FCB53"; // Green for success
  } else {
    // The game ended because time ran out or player lost all lives
    
    // Custom message for no lives remaining
    if (noLivesRemaining) {
      const noLivesMessage = "You've run out of lives! Be careful with those red drops next time.";
      document.getElementById("final-score").textContent = finalScore;
      document.getElementById("end-game-message").textContent = noLivesMessage;
      document.getElementById("end-game-message").style.color = "#F5402C"; // Red for failure
    } else {
      // Regular time out ending
      // Determine if the player won based on score threshold (20 points)
      const isWinner = finalScore >= 20;
      
      // Select appropriate message array
      const messageArray = isWinner ? winningMessages : losingMessages;
      
      // Get a random message from the array
      const randomIndex = Math.floor(Math.random() * messageArray.length);
      const randomMessage = messageArray[randomIndex];
      
      // Update the modal content
      document.getElementById("final-score").textContent = finalScore;
      document.getElementById("end-game-message").textContent = randomMessage;
      
      // Change message color based on win/lose
      document.getElementById("end-game-message").style.color = isWinner ? "#4FCB53" : "#F5402C";
    }
  }
  
  // Show the game over modal
  document.getElementById("end-game-modal").classList.add("show");
  
  // Reset for a new game
  currentLevel = 1;
  document.getElementById("time").textContent = "30";
}

function createDrop() {
  // Create a new div element that will be our water drop
  const drop = document.createElement("div");
  drop.className = "water-drop";
  
  // Randomly determine if this will be a regular or bad drop
  // Using fixed rate that doubles with each level, capped at 70%
  // The rate is set in startGame() and startNextLevel() functions
  const isBadDrop = Math.random() < redDropRate;
  if (isBadDrop) {
    drop.classList.add("bad-drop");
  }

  // Make drops different sizes for visual variety
  const baseWidth = 30;  // Base width for raindrop shape
  const baseHeight = 50; // Base height for raindrop shape
  const sizeMultiplier = Math.random() * 0.4 + 0.8;  // 0.8 to 1.2 multiplier
  
  drop.style.width = `${baseWidth * sizeMultiplier}px`;
  drop.style.height = `${baseHeight * sizeMultiplier}px`;

  // Add slight rotation variation
  const rotationVariation = Math.random() * 20 - 10; // -10 to +10 degrees
  drop.style.transform = `rotate(${15 + rotationVariation}deg)`;

  // Position the drop randomly across the game width
  const gameWidth = document.getElementById("game-container").offsetWidth;
  const xPosition = Math.random() * (gameWidth - 30);
  drop.style.left = xPosition + "px";

  // Vary the fall speed based on level and difficulty
  let baseDuration;
  
  if (isEndlessMode) {
    // In endless mode, use a fixed base duration affected by the increasing speed multiplier
    baseDuration = 4.5 / dropSpeedMultiplier;
  } else {
    // In level modes, speed based on level and difficulty multiplier
    baseDuration = Math.max(1.5, (4.5 - (currentLevel * 0.5)) / dropSpeedMultiplier);
  }
  
  // Make bad drops fall faster than good drops
  let fallDuration;
  if (isBadDrop) {
    // Bad drops fall 20% faster than good drops
    fallDuration = (Math.random() * 0.8 + 0.8 * baseDuration);
  } else {
    fallDuration = (Math.random() * 1 + baseDuration);
  }
  
  drop.style.animationDuration = `${fallDuration}s`;

  // Add the new drop to the game screen
  document.getElementById("game-container").appendChild(drop);
  
  // Add click handler to collect drops
  drop.addEventListener("click", () => {
    // Flag as clicked to prevent double-clicks and show visual feedback
    if (drop.classList.contains("clicked")) return;
    drop.classList.add("clicked");
    
    // Make the drop visually indicate it's been clicked
    drop.style.opacity = "0.5";
    drop.style.transform = "rotate(15deg) scale(1.5)";
    
    if (drop.classList.contains("bad-drop")) {
      // Play bad drop sound
      playSound(sounds.badDropSound);
      
      // Decrease lives when bad drop is clicked
      lives--;
      updateLivesDisplay();
      
      // Check if player has lost all lives
      if (lives <= 0) {
        // End the game due to no lives remaining
        endGame(false, true);
        return;
      }
      
      // Add splash effect for bad drops (larger and more dramatic)
      createSplash(drop, "rgba(245, 64, 44, 0.9)");
      
      // Add a screen flash effect to indicate life lost
      flashScreenRed();
    } else {
      // Play good drop sound
      playSound(sounds.dropSound);
      
      // Increase score when good drop is clicked
      score += scorePerDrop;
      
      // In endless mode, increase time for each caught drop
      if (isEndlessMode && !drop.classList.contains("bad-drop")) {
        timeRemaining += 2; // Add 2 seconds for each good drop
        document.getElementById("time").textContent = timeRemaining;
        
        // Visual indicator for time bonus
        const timeBonus = document.createElement("div");
        timeBonus.className = "time-bonus";
        timeBonus.textContent = "+2s";
        timeBonus.style.position = "absolute";
        timeBonus.style.color = "#4FCB53";
        timeBonus.style.fontWeight = "bold";
        timeBonus.style.zIndex = "100";
        
        // Position it near the drop
        const dropRect = drop.getBoundingClientRect();
        const containerRect = document.getElementById("game-container").getBoundingClientRect();
        timeBonus.style.left = (dropRect.left - containerRect.left) + "px";
        timeBonus.style.top = (dropRect.top - containerRect.top - 20) + "px";
        
        // Add animation
        timeBonus.style.animation = "fadeUpAndOut 1s forwards";
        
        // Add to the container
        document.getElementById("game-container").appendChild(timeBonus);
        
        // Remove after animation
        setTimeout(() => timeBonus.remove(), 1000);
      }
      
      // Add splash effect for good drops
      createSplash(drop, "rgba(46, 157, 247, 0.7)");
    }
    
    // Update score display
    document.getElementById("score").textContent = score;
    
    // Update the progress bar based on current score (only if not in endless mode)
    if (!isEndlessMode) {
      updateProgressBar(score);
    }
    
    // Remove the drop after a short delay, giving players visual feedback
    // and making it feel more responsive even with near-misses
    setTimeout(() => {
      if (drop.parentNode) {
        drop.remove();
      }
    }, 100);
  });

  // Remove drops that reach the bottom (weren't clicked)
  drop.addEventListener("animationend", () => {
    drop.remove(); // Clean up drops that weren't caught
  });
}
