class ReelRiddleApp {
    constructor() {
        // App state
        this.username = '';
        this.movies = [];
        this.currentMovie = '';
        this.currentDescription = '';
        this.riddleId = '';
        this.generatedDescription = '';
        this.moviePosterURL = ''; // Added for storing poster URL
        this.guesses = []; // Added to store guesses
        this.userPoints = 0; // Add user points

        // DOM elements - Screens
        this.mainMenuScreen = null; // We're removing this screen
        this.gameScreen = document.getElementById('game-screen');
        this.createScreen = document.getElementById('create-screen');
        this.leaderboardScreen = document.getElementById('leaderboard-screen');
        this.helpScreen = document.getElementById('help-screen');
        this.resultScreen = document.getElementById('result-screen');  // Get the result screen
        this.previewScreen = document.getElementById('preview-screen');

        // DOM elements - HContainers
        this.descriptionContainer = document.getElementById('description-container');
        this.resultMessage = document.getElementById('result-message');
        this.movieSuggestions = document.getElementById('movie-suggestions');
        this.resultContent = document.getElementById('result-content'); // Get result content
        this.previewDescriptionEditor = document.getElementById('preview-description-editor');
        this.previewMovieTitle = document.getElementById('preview-movie-title');
        this.guessesList = document.getElementById('guesses-list'); // Added for displaying guesses

        // DOM elements - Inputs
        this.guessInput = document.getElementById('guess-input');
        this.movieInput = document.getElementById('movie-input');

        // User info display
        this.userNameElement = document.getElementById('user-name');
        this.userPointsElement = document.getElementById('user-points');

        // Main menu buttons are removed

        // Game screen buttons
        document.getElementById('submit-guess').addEventListener('click', () => this.submitGuess());
        document.getElementById('reveal-button').addEventListener('click', () => this.showHint());
        document.getElementById('back-to-menu').addEventListener('click', () => this.closeWebView());

        // Attach event listener only if the button exists
        const hintButton = document.getElementById('hint-button');
        if (hintButton) {
            hintButton.addEventListener('click', () => this.requestHint());
        }

        document.getElementById('back-to-menu').addEventListener('click', () => this.closeWebView());

        // Create screen buttons
        const saveRiddleButton = document.getElementById('save-riddle');
        console.log("Save Riddle Button:", saveRiddleButton); // Check if the button element exists
        if (saveRiddleButton) {
            saveRiddleButton.addEventListener('click', () => this.triggerGenerateDescription()); // Changed to trigger
            console.log("Event listener added to save-riddle button"); // Confirm listener attachment
        } else {
            console.warn("save-riddle button not found!");
        }
        document.getElementById('cancel-create').addEventListener('click', () => this.closeWebView());

        // Preview screen buttons
        document.getElementById('post-riddle').addEventListener('click', () => this.saveRiddle());
        document.getElementById('back-to-edit').addEventListener('click', () => this.showScreen(this.createScreen));

        // Back buttons
        document.getElementById('back-from-leaderboard').addEventListener('click', () => this.closeWebView());
        document.getElementById('back-from-help').addEventListener('click', () => this.closeWebView());

        // Result screen buttons
        // These will be created dynamically

        // Guess input enter key
        this.guessInput.addEventListener('keyup', (event) => {
            if (event.key === 'Enter') {
                this.submitGuess();
            }
        });

        // When the Devvit app sends a message with postMessage(), this will be triggered
        addEventListener('message', this.onMessage);

        // This event gets called when the web view is loaded
        addEventListener('load', () => {
            this.populateMovieSuggestions();
            postWebViewMessage({ type: 'webViewReady' });
        });
    }

    /**
     * @arg {MessageEvent<DevvitSystemMessage>} ev
     * @return {void}
     */
    onMessage = (ev) => {
        // Reserved type for messages sent via context.ui.webView.postMessage
        if (ev.data.type !== 'devvit-message') return;
        const { message } = ev.data.data;

        switch (message.type) {
            case 'initialData': {
                // Load initial data
                const { username, movies, points } = message.data;
                this.username = username;
                this.movies = movies;
                this.userPoints = points;

                //Update the user info
                this.updateUserInfo();

                // Populate movie suggestions for the create screen
                this.populateMovieSuggestions();
                break;
            }
            case 'gameState': {
                // Load game state
                const { currentMovie, description, posterURL } = message.data;
                this.currentMovie = currentMovie;
                this.currentDescription = description;
                this.moviePosterURL = posterURL;

                // Display the description in the game screen
                this.displayDescription(description);
                this.showScreen(this.gameScreen);
                break;
            }
            case 'guessResult': {
                // Handle guess result
                const { correct, correctMovie, points } = message.data;
                this.userPoints = points;
                this.updateUserInfo();
                this.showGuessResult(correct, correctMovie);
                break;
            }
            case 'riddleCreated': {
                // Handle riddle creation result
                const { success, postId, points } = message.data;
                this.userPoints = points;
                this.updateUserInfo();
                if (success) {
                    this.riddleId = postId;
                    // Optionally display a success message in the webview
                    alert('Riddle created successfully!');
                    this.closeWebView();
                } else {
                    alert('Failed to create riddle.');
                }
                break;
            }
            case 'descriptionGenerated': {
                console.log("Received generateDescription message:", message.data); // Check if message is received
                // Handle generated description
                const { movie, description, posterURL } = message.data; // ADDED posterURL
                this.currentMovie = movie;
                this.generatedDescription = description;
                this.moviePosterURL = posterURL; // Store poster URL

                // Display the movie title and description in the preview screen
                this.previewMovieTitle.textContent = movie;
                this.previewDescriptionEditor.value = description;

                // Set the movie poster
                const posterElement = document.getElementById('preview-movie-poster');
                posterElement.src = this.moviePosterURL || 'default-poster.png'; // Use stored URL

                // Show the preview screen
                this.showScreen(this.previewScreen);
                break;
            }
            case 'navigateToScreen': {
                // Handle navigation to specific screen
                const { screen } = message.data;

                switch (screen) {
                    case 'main':
                        this.closeWebView(); // Instead of showing main menu, close webview
                        break;
                    case 'game':
                        if (this.currentMovie && this.currentDescription) {
                            this.displayDescription(this.currentDescription);
                            this.showScreen(this.gameScreen);
                        } else {
                            this.startGame();
                        }
                        break;
                    case 'create':
                        this.showScreen(this.createScreen);
                        break;
                    case 'leaderboard':
                        this.showLeaderboard();
                        break;
                        case 'results':
                         this.showResultScreen();
                       break;
                    case 'help':
                        this.showScreen(this.helpScreen);
                        break;
                    default:
                        console.log(`Unknown screen: ${screen}`);
                        this.closeWebView();
                        break;
                }
                break;
            }
            case 'postCreated': {
                // Handle a new post is created for the riddle creation
                break;
            }
            case 'hintGenerated': {
                // Handle generated hint
                const { hint, points } = message.data;
                this.userPoints = points;
                this.updateUserInfo();
                this.resultMessage.textContent = `Hint: ${hint}`;
                this.resultMessage.className = '';
                this.resultMessage.classList.remove('hidden');
                break;
            }
            case 'receiveGuesses': {
                // Handle received guesses from Devvit
                console.log("received guesses:", message.data.guesses);
                this.guesses = message.data.guesses;
                this.displayGuesses();
                break;
            }
            case 'receiveLeaderboard': {
                // Handle received leaderboard data
                const { leaderboard } = message.data;
                this.displayLeaderboard(leaderboard);
                break;
            }
            default:
                console.log('Unknown message type:', message.type);
                break;
        }
    };

    /**
     * Show a specific screen and hide all others
     * @param {HTMLElement} screenToShow The screen element to display
     */
    showScreen(screenToShow) {
        // No need to hide main menu since it's removed
        // Hide all other screens
        this.gameScreen.classList.add('hidden');
        this.createScreen.classList.add('hidden');
        this.leaderboardScreen.classList.add('hidden');
        this.helpScreen.classList.add('hidden');
        this.resultScreen.classList.add('hidden');
        this.previewScreen.classList.add('hidden');

        // Hide loading indicator when switching screens
        document.getElementById('loading-indicator').classList.add('hidden');

        // Show the requested screen
        screenToShow.classList.remove('hidden');

        // Clear specific elements based on which screen is shown
        if (screenToShow === this.gameScreen) {
            this.resultMessage.classList.add('hidden');
            this.guessInput.value = '';
        } else if (screenToShow === this.createScreen) {
            // Don't clear the movie input if coming back from preview screen
            if (!this.currentMovie) {
                this.movieInput.value = '';
            } else {
                this.movieInput.value = this.currentMovie;
            }
        }
    }

    /**
+     * Show the result screen and request guesses
+     */
   showResultScreen() {
            // First show the result screen
            this.showScreen(this.resultScreen);
    
           // Then request the guesses to populate the screen
            postWebViewMessage({
               type: 'requestGuesses'
            });
        }

    /**
     * Close the WebView and return to the main Devvit UI
     */
    closeWebView() {
        postWebViewMessage({
            type: 'closeWebView'
        });
    }

    /**
     * Populate movie suggestions for the datalist
     */
    populateMovieSuggestions() {
        this.movieSuggestions.innerHTML = '';
        this.movies.forEach(movie => {
            const option = document.createElement('option');
            option.value = movie;
            this.movieSuggestions.appendChild(option);
        });
    }

    /**
     * Start a new game
     */
    startGame() {
        // Choose a random movie if we're starting a fresh game
        const randomIndex = Math.floor(Math.random() * this.movies.length);
        const selectedMovie = this.movies[randomIndex];

        postWebViewMessage({
            type: 'startGame',
            data: {
                selectedMovie
            }
        });
    }

    /**
     * Display the movie description in the game screen
     * @param {string} description The movie description to display
     */
    displayDescription(description) {
        this.descriptionContainer.innerHTML = '';

        // Split the description into paragraphs
        const paragraphs = description.split('\n\n');

        paragraphs.forEach(paragraph => {
            if (paragraph.trim()) {
                const p = document.createElement('p');
                p.textContent = paragraph.trim();
                this.descriptionContainer.appendChild(p);
            }
        });
    }

    /**
     * Submit a guess for the current movie
     */
    submitGuess() {
        const guess = this.guessInput.value.trim();
        if (!guess) return;

        postWebViewMessage({
            type: 'submitGuess',
            data: {
                guess
            }
        });
    }

    /**
     * Request a hint for the current movie
     */
    requestHint() {
        // Show a loading message
        this.resultMessage.textContent = "Generating hint...";
        this.resultMessage.className = '';
        this.resultMessage.classList.remove('hidden');

        postWebViewMessage({
            type: 'requestHint',
        });
    }

    /**
     * Show a hint for the current movie
     */
    showHint() {
        // Simple hint: show the first letter of each word
        const words = this.currentMovie.split(' ');
        const hint = words.map(word => word[0] + '...').join(' ');

        this.resultMessage.textContent = `Hint: ${hint}`;
        this.resultMessage.className = '';
        this.resultMessage.classList.remove('hidden');
    }

    /**
     * Show the result of a guess
     * @param {boolean} correct Whether the guess was correct
     * @param {string} correctMovie The correct movie title (if guess was incorrect)
     */
    showGuessResult(correct, correctMovie) {
        this.resultMessage.classList.remove('hidden');

        if (correct) {
            this.resultMessage.textContent = 'Correct! You guessed it!';
            this.resultMessage.className = 'correct';

            // Show result screen after a short delay
            setTimeout(() => {
                // Clear the result content.  Important!
                this.resultContent.innerHTML = '';

                // Dynamically create elements and append them to resultContent
                const h2 = document.createElement('h2');
                h2.textContent = 'Congratulations!';
                this.resultContent.appendChild(h2);

                const p = document.createElement('p');
                p.innerHTML = `You correctly guessed: <strong>${this.currentMovie}</strong>`;
                this.resultContent.appendChild(p);

                const moviePosterContainer = document.createElement('div');
                moviePosterContainer.className = 'movie-poster-container';
                const img = document.createElement('img');
                img.src = this.moviePosterURL || 'default-poster.png';
                img.alt = 'Movie Poster';
                img.style.maxWidth = '200px';
                img.style.maxHeight = '300px';
                moviePosterContainer.appendChild(img);
                this.resultContent.appendChild(moviePosterContainer);

                const descriptionQuoteDiv = document.createElement('div');
                descriptionQuoteDiv.className = 'description-quote';
                const descriptionQuoteP = document.createElement('p');
                descriptionQuoteP.innerHTML = `<em>"${this.currentDescription.split('\n')[0]}..."</em>`;
                descriptionQuoteDiv.appendChild(descriptionQuoteP);
                this.resultContent.appendChild(descriptionQuoteDiv);

                const buttonRowDiv = document.createElement('div');
                buttonRowDiv.className = 'button-row';

                const playAgainButton = document.createElement('button');
                playAgainButton.id = 'play-again';
                playAgainButton.className = 'primary-button';
                playAgainButton.textContent = 'Play Again';
                buttonRowDiv.appendChild(playAgainButton);

                const createRiddleButton = document.createElement('button');
                createRiddleButton.id = 'create-riddle-button';
                createRiddleButton.className = 'secondary-button';
                createRiddleButton.textContent = 'Create Riddle';
                buttonRowDiv.appendChild(createRiddleButton);

                const exitToMenuButton = document.createElement('button');
                exitToMenuButton.id = 'exit-to-menu';
                exitToMenuButton.className = 'text-button';
                exitToMenuButton.textContent = 'Back to Menu';
                buttonRowDiv.appendChild(exitToMenuButton);

                this.resultContent.appendChild(buttonRowDiv);

                // Request guesses after displaying the result
                console.log("Requesting guesses");

                // Show the result screen FIRST to ensure it's in the DOM
                this.showScreen(this.resultScreen); // THIS IS MOVED HERE

                //Then, call the request, to ensure the DOM exists at the time it returns the result
                postWebViewMessage({ type: 'requestGuesses' });

                // Add event listeners to the dynamically created buttons AFTER the element is added to the page
                document.getElementById('play-again').addEventListener('click', () => this.startGame());
                document.getElementById('create-riddle-button').addEventListener('click', () => this.goToCreateScreen());
                document.getElementById('exit-to-menu').addEventListener('click', () => this.closeWebView());

            }, 1500);
        } else {
            this.resultMessage.textContent = `Incorrect. Try again!`;
            this.resultMessage.className = 'incorrect';
        }
    }

    /**
     * Navigates to the create screen, prepopulating the movie title.
     */
    goToCreateScreen() {
        // Set the movie title in the create screen input field
        this.movieInput.value = this.currentMovie;

        // Set the generated description in the create screen input field
        this.previewDescriptionEditor.value = this.currentDescription;

        //Show the create screen
        this.showScreen(this.createScreen);
    }

    /**
     * Triggers the description generation process in main.tsx
     */
    triggerGenerateDescription() {
        const movie = this.movieInput.value.trim();

        if (!movie) {
            alert('Please enter a movie title');
            return;
        }

        // Hide create screen
        this.createScreen.classList.add('hidden');

        // Show loading indicator
        document.getElementById('loading-indicator').classList.remove('hidden');

        console.log("Sending generateDescription message for:", movie);
        postWebViewMessage({
            type: 'generateDescription',
            data: {
                movie: movie // Just send the movie title
            }
        });
        console.log("generateDescription() finished - message sent");
        // Hide loading indicator on error
        //document.getElementById('loading-indicator').classList.add('hidden');
    }

    /**
     * Save the created riddle
     */
    saveRiddle() {
        const editedDescription = this.previewDescriptionEditor.value.trim();

        if (!editedDescription) {
            alert('Description cannot be empty');
            return;
        }

        // Send the final riddle data to Devvit
        postWebViewMessage({
            type: 'createRiddle',
            data: {
                movie: this.currentMovie,
                description: editedDescription,
                posterURL: this.moviePosterURL,
            }
        });
    }
    /**
     * Display the list of guesses in the result screen
     */
    /**
     * Display the list of guesses in the result screen
     */
    // Make sure to call this correctly
    displayGuesses() {
        console.log("Displaying guesses...");

        if (!this.guessesList) {
            console.error("ERROR: guessesList is null or undefined in displayGuesses()!");
            return;
        }

        const guessesListElement = document.getElementById('guesses-list');
        if (!guessesListElement) {
            console.error("ERROR: No element with ID 'guesses-list' found in the DOM!");
            return;
        }

        this.guessesList.innerHTML = '';

        if (this.guesses.length === 0) {
            this.guessesList.innerHTML = '<p>No guesses yet.</p>';
            return;
        }

        // 1. Calculate Total Guesses
        let totalGuesses = 0;
        this.guesses.forEach(guess => {
            totalGuesses += guess.count;
        });

        const list = document.createElement('ol');
        this.guesses.forEach((guess, index) => {
            const listItem = document.createElement('li');
            listItem.className = "guesses";

            // 2. Calculate Percentage Width based on total guess count
            const percentageWidth = (guess.count / totalGuesses) * 100;

            const progressBar = document.createElement('div');
            progressBar.className = 'progress-bar';
            progressBar.style.width = `${percentageWidth}%`;

            const guessTextSpan = document.createElement('span');
            guessTextSpan.className = 'guess-text';
            guessTextSpan.textContent = `${index + 1}. ${guess.guess}`;

            const guessCountSpan = document.createElement('span');
            guessCountSpan.className = 'guess-count';
            guessCountSpan.textContent = ` (${guess.count} guesses)`;

            listItem.appendChild(progressBar); // Add progress bar first
            listItem.appendChild(guessTextSpan);
            listItem.appendChild(guessCountSpan);

            if (guess.guess === this.currentMovie) {
                listItem.classList.add('correct-guess');
            }

            list.appendChild(listItem);
            console.log("Appended list item to list:", list);
        });

        this.guessesList.appendChild(list);
        console.log("Appended list to guessesList:", this.guessesList);
        console.log("Guesses List HTML:", this.guessesList.innerHTML);
    }

    /**
     * Show the leaderboard screen
     */
    showLeaderboard() {
        this.showScreen(this.leaderboardScreen);

        // Request the leaderboard data from Devvit
        postWebViewMessage({ type: 'requestLeaderboard' });
    }

    /**
     * Display the leaderboard data in the leaderboard screen
     * @param {Array<{ username: string, points: number }>} leaderboard The leaderboard data
     */
    displayLeaderboard(leaderboard) {
        const leaderboardList = document.getElementById('leaderboard-list');
        leaderboardList.innerHTML = '';

        if (leaderboard.length === 0) {
            leaderboardList.innerHTML = '<p>No scores yet!</p>';
            return;
        }

        const ol = document.createElement('ol');
        leaderboard.forEach((entry, index) => {
            const li = document.createElement('li');
            li.textContent = `${index + 1}. ${entry.username} - ${entry.points} points`;
            ol.appendChild(li);
        });

        leaderboardList.appendChild(ol);
    }

    /**
     * Updates the user name and points in the header
     */
    updateUserInfo() {
        this.userNameElement.textContent = `User: ${this.username}`;
        this.userPointsElement.textContent = `Points: ${this.userPoints}`;
    }
}

/**
 * Post a message from the web view to Devvit
 * @param {WebViewMessage} message Message to send to Devvit
 */
function postWebViewMessage(message) {
    // The parent window is the Devvit app
    window.parent.postMessage(message, '*');
}

// Initialize the app
const app = new ReelRiddleApp();