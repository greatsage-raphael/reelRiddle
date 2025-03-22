// src/messages.ts

/** Message from Devvit to the web view. */
// Define the shape of messages sent from Devvit to the web view
// messages.ts
export type DevvitMessage =
    | {
        type: 'initialData';
        data: {
            username: string;
            movies: string[];
            points: number; // ADD THIS
        };
    }
    | {
        type: 'gameState';
        data: {
            currentMovie: string;
            description: string;
            posterURL: string; // Added poster URL
        };
    }
    | {
        type: 'guessResult';
        data: {
            correct: boolean;
            correctMovie?: string;
            points: number; // ADD THIS
        };
    }
    | {
        type: 'riddleCreated';
        data: {
            success: boolean;
            postId: string;
            points: number; // ADD THIS
        };
    }
    | {
        type: 'descriptionGenerated';
        data: {
            movie: string;
            description: string;
            posterURL: string; // added poster url
        };
    }
    | {
        type: 'navigateToScreen';
        data: {
            screen: string;
        };
    }
    | {
        type: 'hintGenerated'; // Add this
        data: {
            hint: string;
            points: number; // ADD THIS
        };
    }
    | { // ADD THIS
        type: 'receiveGuesses';
        data: {
            guesses: { guess: string; count: number }[];
        };
    }
    | { // ADD THIS
        type: 'receiveLeaderboard';
        data: {
            leaderboard: { username: string; points: number }[];
        };
    };
// Define the shape of messages sent from the web view to Devvit
// messages.ts

export type WebViewMessage =
    | {
        type: 'webViewReady';
    }
    | {
        type: 'startGame';
        data: {
            selectedMovie: string;
        };
    }
    | {
        type: 'submitGuess';
        data: {
            guess: string;
        };
    }
    | {
        type: 'generateDescription';
        data: {
            movie: string;
        };
    }
    | {
        type: 'createRiddle';
        data: {
            movie: string;
            description: string;
            posterURL: string;
        };
    }
    | {
        type: 'postCreated';
        data: {
            success: boolean;
        };
    }
    | {
        type: 'requestHint'; // Add this
    }
    | { // ADD THIS
        type: 'requestGuesses';
    }
    | { // ADD THIS
        type: 'requestLeaderboard';
    };