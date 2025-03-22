// src/main.tsx
import './createPost.js';
import { Devvit, useState, useWebView, useAsync } from '@devvit/public-api';
import type { DevvitMessage, WebViewMessage } from './message.js';

const GEMINI_API_KEY = 'Your api key'; // Replace with your actual Gemini API key

// TMDb API Key and Configuration
const TMDB_BEARER_TOKEN = 'Your bearer token'
const TMDB_API_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500'; // You can adjust the image size

const POPULAR_MOVIES = [
    'The Godfather',
    'Star Wars',
    'Jurassic Park',
    'Titanic',
    'Avatar',
    'The Matrix',
    'Inception',
    'Toy Story',
    'The Lion King',
    'Finding Nemo',
    'Harry Potter',
    'The Dark Knight',
    'Forrest Gump',
    'The Avengers',
    'Back to the Future'
];

// Constants for points
const INITIAL_POINTS = 5;
const RIDDLE_CREATION_POINTS = 2;
const CORRECT_GUESS_POINTS = 5;
const CREATED_RIDDLE_SOLVED=3;
const HINT_USED_POINTS = -1;

const POINTS_HASH_KEY = "reel_riddle_points"; // Define the leaderboard key
const SOLVED_RIDDLES_KEY = "solved_riddles"; // Key to store solved riddles by user

Devvit.configure({
    redditAPI: true,
    redis: true,
    media: true,
    http: true
});

// Add a custom post type to Devvit
Devvit.addCustomPostType({
    name: 'Reel Riddle',
    height: 'tall',
    render: (context) => {

        const screenWidth = context.dimensions?.width || 600;
    const isMobile = screenWidth < 300; // Define mobile breakpoint
    
    // Adjust button sizes based on screen width
    const buttonWidth = isMobile ? "90%" : "300px";
    const largeButtonWidth = isMobile ? "90%" : "400px";

        const { data: username } = useAsync(() =>
            context.reddit.getCurrentUser().then((user) => user?.username ?? "Guest")
        );

        const { data: avatarUrl } = useAsync(async () => {
            const user = await context.reddit.getCurrentUser();
            if (!user) return null;

            const url = await user.getSnoovatarUrl();
            return url || null;
        });

        const [currentRiddle, setCurrentRiddle] = useState<{ movie: string; description: string; posterURL: string; createdBy: string; creatorAvatar: string } | null>(null);
        const [initialScreen, setInitialScreen] = useState<string>('main');
        const [isSolvedScreen, setIsSolvedScreen] = useState<boolean>(false); // State for solved screen

        const { data: riddleData, loading: initialRiddleLoading } = useAsync(async () => {
            const currentMovie = await context.redis.get(`currentMovie_${context.postId}`);

            if (!currentMovie) return null;

            // Check if the riddle is solved by the user
            const solvedKey = `${SOLVED_RIDDLES_KEY}:${context.postId}:${username}`;
            const isRiddleSolved = await context.redis.get(solvedKey) === 'true';
            setIsSolvedScreen(isRiddleSolved); // Set state based on solved status


            // Make parallel requests for all the data you need
            const [description, posterURL, createdBy, creatorAvatar] = await Promise.all([
              context.redis.get(`movie_desc_${currentMovie}`),
              context.redis.get(`movie_poster_${currentMovie}`),
              context.redis.get(`riddle_creator_${currentMovie}`),
              context.redis.get(`riddle_creator_avatar_${currentMovie}`)
            ]);

            return {
              movie: currentMovie,
              description: description || '',
              posterURL: posterURL || 'default-poster.png',
              createdBy: createdBy || 'Guest',
              creatorAvatar: creatorAvatar || 'default_avatar.png'
            };
          }, {
            finally: (data) => {
                if (data) {
                    setCurrentRiddle(data);
                }
            }
        });

        // New useAsync hook to fetch solved status
        useAsync(async () => {
            if (currentRiddle && username) {
                const solvedKey = `${SOLVED_RIDDLES_KEY}:${context.postId}:${username}`;
                const isRiddleSolved = await context.redis.get(solvedKey) === 'true';
                return isRiddleSolved; // Return the boolean value
            }
            return false; // Default to not solved if no riddle or username yet
        }, {
            depends: { currentRiddle, username }, // Depend on currentRiddle and username
            finally: (data) => {
                setIsSolvedScreen(Boolean(data)); // Update isSolvedScreen in finally block
                console.log(`[useAsync - Solved Check] Riddle Solved Status for ${context.postId} by ${username}: ${Boolean(data)}`); // Debug log
            }
        });


        const [riddles] = useState(async () => {
            const savedRiddles = await context.redis.get(`riddles_${context.postId}`);
            return savedRiddles ? JSON.parse(savedRiddles) : [];
        });

        async function getUserPoints(username: string): Promise<number> {
            const pointsStr = await context.redis.hGet(POINTS_HASH_KEY, username);
            const points = pointsStr ? parseInt(pointsStr, 10) : INITIAL_POINTS;

            if (!pointsStr) {
                await context.redis.hSet(POINTS_HASH_KEY, { [username]: points.toString() });
            }

            return points;
        }

        async function updateUserPoints(username: string, pointsChange: number): Promise<number> {
            const currentPoints = await getUserPoints(username);
            const newPoints = currentPoints + pointsChange;
            await context.redis.hSet(POINTS_HASH_KEY, { [username]: newPoints.toString() });
            return newPoints;
        }

        async function getLeaderboard(): Promise<{ username: string; points: number }[]> {
            const pointsHash = await context.redis.hGetAll(POINTS_HASH_KEY);

            if (!pointsHash) {
                return [];
            }

            const leaderboardData = Object.entries(pointsHash).map(([username, scoreStr]) => ({
                username,
                points: parseInt(scoreStr, 10),
            }));

            leaderboardData.sort((a, b) => b.points - a.points);
            return leaderboardData;
        }

        async function generateMovieDescription(movie: string) {
            try {
                const prompt = `Create a spoiler-free, riddle-like synopsis for a movie.
      Be detailed but mysterious, don't mention the movie name itself , character names, actors, or major plot points.
      Make it interesting but cryptic enough that a movie fan would need to think about it.
      Keep it to 2-3 paragraphs.
      Do not add any introductions and just start with the synopsis.
      Here's an example:
Movie Title: The Shawshank Redemption
Synopsis:
A man wrongly convicted finds himself in a bleak and unforgiving environment. Hope becomes his currency as he navigates the harsh realities of his confinement, forming unexpected bonds along the way.  His spirit remains unbroken, fueling a quiet determination that transcends the prison walls.

This is a tale of enduring friendship, unwavering hope, and the resilience of the human spirit against all odds.  It whispers of redemption found in the most unlikely of places, where the soul can soar even when the body is caged.  Is it a dream, or is there another way out?

Through the passage of time and countless trials, he plans his escape.  The slow, persistent chipping away at the facade of his confinement, a symbol of the long, arduous journey toward freedom. His quiet rebellion inspires others to question their own captivity.
      Movie Title: ${movie}
        Synopsis:`;

                const response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            contents: [
                                {
                                    parts: [
                                        { text: prompt }
                                    ]
                                }
                            ],
                            tools: [
                                {
                                    "google_search": {}
                                }
                            ],
                            generationConfig: {
                                temperature: 0.8,
                                maxOutputTokens: 800,
                            },
                        }),
                    }
                );

                if (!response.ok) {
                    throw new Error(`Gemini API error: ${response.status}`);
                }

                const data = await response.json();

                let description = "A mysterious tale unfolds on the silver screen. Can you guess what it is?";
                if (data.candidates && data.candidates.length > 0 && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts.length > 0) {
                    description = data.candidates[0].content.parts[0].text;
                }

                console.log('Gemini API response:', description);
                return description;

            } catch (error) {
                console.error('Error generating movie description:', error);
                return "A mysterious tale unfolds on the silver screen. Can you guess what it is?";
            }
        }

        async function generateMovieHint(movie: string) {
            try {
                const prompt = `Create a one-sentence hint for a movie.
Be subtle and thought-provoking, avoiding direct references to the title, character names, actors, or major plot points.
The hint should resemble a riddle that challenges the reader to think deeply about the film’s essence.

Here's an example:
Movie Title: The Shawshank Redemption  
Hint: In a place where freedom is a distant dream, a quiet man carves his own destiny, one chip at a time.

Movie Title: ${movie}  
Hint:`;

                const response = await fetch(
                    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' +
                    GEMINI_API_KEY,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            contents: [
                                {
                                    parts: [
                                        { text: prompt },
                                    ],
                                },
                            ],
                            tools: [
                                {
                                    "google_search": {}
                                }
                            ],
                            generationConfig: {
                                temperature: 0.7,
                                maxOutputTokens: 100,
                            },
                        }),
                    }
                );

                if (!response.ok) {
                    throw new Error(`Gemini API error: ${response.status}`);
                }

                const data = await response.json();
                console.log('Gemini API response (hint):', data.candidates[0].content.parts[0].text);
                return data.candidates[0].content.parts[0].text;
            } catch (error) {
                console.error('Error generating movie hint:', error);
                return 'This film involves something intriguing.';
            }
        }

        async function fetchMoviePoster(context: Devvit.Context, movie: string): Promise<string> {
            try {
              console.log("fetchMoviePoster called for:", movie);

              // Construct the TMDb search URL
              const searchUrl = `${TMDB_API_URL}/search/movie?query=${encodeURIComponent(movie)}&include_adult=false&language=en-US&page=1`;

              const options = {
                method: 'GET',
                headers: {
                  accept: 'application/json',
                  Authorization: `Bearer ${TMDB_BEARER_TOKEN}`,
                },
              };

              const response = await fetch(searchUrl, options);
              if (!response.ok) {
                throw new Error(`TMDb API error: ${response.status}`);
              }

              const data = await response.json();

              if (data.results && data.results.length > 0) {
                const movieResult = data.results[0];
                if (movieResult.poster_path) {
                  const posterURL = `${TMDB_IMAGE_BASE_URL}${movieResult.poster_path}`;

                  // Upload the image to Reddit's media hosting
                  const mediaAsset = await context.media.upload({
                    url: posterURL,
                    type: 'image'
                  });

                  console.log("Image uploaded to Reddit:", mediaAsset.mediaUrl);
                  return mediaAsset.mediaUrl;
                }
              }

              // Return a default image if no poster found
              return "default-poster.png"
            } catch (error) {
              console.error('Error fetching movie poster:', error);
              return "default-poster.png"
            }
          }


        const webView = useWebView<WebViewMessage, DevvitMessage>({
            url: 'page.html',
            async onMessage(message, webView) {
                switch (message.type) {
                    case 'webViewReady': {
                        const userPoints = await getUserPoints(username!);
                        webView.postMessage({
                            type: 'initialData',
                            data: {
                                username: username!,
                                movies: POPULAR_MOVIES,
                                points: userPoints,
                            },
                        });

                        if (initialScreen !== 'main') {
                            webView.postMessage({
                                type: 'navigateToScreen',
                                data: {
                                    screen: initialScreen
                                }
                            });
                        } else if (currentRiddle) {
                            webView.postMessage({
                                type: 'gameState',
                                data: {
                                    currentMovie: currentRiddle.movie,
                                    description: currentRiddle.description,
                                    posterURL: currentRiddle.posterURL,
                                },
                            });
                        }
                        break;
                    }
                    case 'submitGuess': {
                        const guess = message.data.guess;
                        const currentMovie = await context.redis.get(`currentMovie_${context.postId}`);
                        const isCorrect = guess.toLowerCase() === (currentMovie || '').toLowerCase();

                        const guessKey = `guesses:${context.postId}`;
                        await context.redis.hIncrBy(guessKey, guess, 1);
                        let newPoints = await getUserPoints(username!);

                        // Get user's guess count and hint usage
                        const userGuessesKey = `user_guesses:${context.postId}:${username}`;
                        const userHintsKey = `user_hints:${context.postId}:${username}`;
                        let guessCountStr = await context.redis.get(userGuessesKey) || '0';
                        let hintsUsedStr = await context.redis.get(userHintsKey) || '0';

                        let guessCount = parseInt(guessCountStr, 10);
                        let hintsUsed = parseInt(hintsUsedStr, 10);

                        guessCount++;

                        if (isCorrect) {
                            newPoints = await updateUserPoints(username!, CORRECT_GUESS_POINTS);

                            // Mark riddle as solved for the user
                            const solvedKey = `${SOLVED_RIDDLES_KEY}:${context.postId}:${username}`;
                            await context.redis.set(solvedKey, 'true');
                            setIsSolvedScreen(true); // Update state to show solved screen

                            let commentText = "";
                            if (guessCount === 1 && hintsUsed === 0) {
                                commentText = "I solved it on my first guess with no hints!";
                            } else if (hintsUsed > 0) {
                                commentText = `I solved it after ${guessCount} ${guessCount === 1 ? 'guess' : 'guesses'} with ${hintsUsed} ${hintsUsed === 1 ? 'hint' : 'hints'}!`;
                            } else {
                                commentText = `I solved it after ${guessCount} ${guessCount === 1 ? 'guess' : 'guesses'} with no hints!`;
                            }


                            const currentUser = await context.reddit.getCurrentUser();

                            await context.reddit.submitComment({
                                id: context.postId!,
                                text: commentText,
                            });

                            context.ui.showToast({
                                text: 'Congratulations! You guessed correctly and have earned 5xp!',
                                appearance: 'success'
                            });

                            context.reddit.sendPrivateMessage({
                                to: username!,
                                subject: "Movie Guessed Correctly!",
                                text: `Congratulations! You correctly guessed the movie "${currentMovie}" and earned 5 XP! Your current total is ${newPoints} points.`
                            });

                            let solvedPoints = await getUserPoints(currentRiddle?.createdBy!);
                            solvedPoints = await updateUserPoints(currentRiddle?.createdBy!, CREATED_RIDDLE_SOLVED);

                            context.reddit.sendPrivateMessage({
                                to: currentRiddle?.createdBy!,
                                subject: `${currentRiddle?.createdBy} ${currentMovie} was guessed Correctly!`,
                                text: `${currentRiddle?.createdBy} your riddle has been solved by ${username!} and you earned 3 XP! Your current total is ${solvedPoints} points. The movie was "${currentMovie}". Check in to create more riddles and solve others`
                            });
                        }


                        webView.postMessage({
                            type: 'guessResult',
                            data: {
                                correct: isCorrect,
                                correctMovie: isCorrect ? undefined : currentMovie,
                                points: newPoints,
                            },
                        });
                        break;
                    }
                    case 'generateDescription': {
                        const movieTitle = message.data.movie;

                        try {
                            // Fetch movie poster
                            const moviePosterURL = await fetchMoviePoster(context, movieTitle);

                            console.log('Movie poster URL:', moviePosterURL);


                            // Generate description for preview
                            const description = await generateMovieDescription(movieTitle);

                            // Send the description and poster URL back to the webview for preview/editing
                            webView.postMessage({
                                type: 'descriptionGenerated',
                                data: {
                                    movie: movieTitle,
                                    description: description,
                                    posterURL: moviePosterURL,
                                },
                            });
                        } catch (error) {
                            console.error('Error during description generation:', error);
                            context.ui.showToast({ text: 'Failed to generate description. Please try again.' });
                        }
                        break;
                    }
                    case 'createRiddle': {
                        const riddleMovie = message.data.movie;
                        const riddleDescription = message.data.description;
                        const moviePosterURL = message.data.posterURL;

                        const subreddit = await context.reddit.getCurrentSubreddit();

                        // First create the post with a simple loading state
                        const post = await context.reddit.submitPost({
                            title: `Reel Riddle: Can you guess this movie?`,
                            subredditName: subreddit.name,
                            preview: (
                                <vstack height="100%" width="100%" alignment="middle center">
                                    <image
                                        url="loading.gif"
                                        imageWidth={600}
                                        imageHeight={600}
                                        height="100%"
                                        width="100%"
                                        resizeMode="cover"
                                    />
                                </vstack>
                            ),
                        });

                        // Prepare the riddle data
                        const newRiddle = {
                            movie: riddleMovie,
                            description: riddleDescription,
                            posterURL: moviePosterURL,
                            createdBy: username,
                            creatorAvatar: avatarUrl,
                            timestamp: Date.now(),
                            postId: post.id
                        };


                        // Store all data in Redis using the new post's ID
                        const storeOperations = [
                            // Store the current movie for this specific post
                            context.redis.set(`currentMovie_${post.id}`, riddleMovie),

                            // Store all the movie details
                            context.redis.set(`movie_desc_${riddleMovie}`, riddleDescription),
                            context.redis.set(`movie_poster_${riddleMovie}`, moviePosterURL),
                            context.redis.set(`riddle_creator_${riddleMovie}`, username || 'Guest'),
                            context.redis.set(`riddle_creator_avatar_${riddleMovie}`, avatarUrl || 'default_avatar.png'),

                            // Update the riddles collection
                            context.redis.get(`riddles_${context.postId}`).then(existingRiddles => {
                                const allRiddles = existingRiddles ? JSON.parse(existingRiddles) : [];
                                allRiddles.push(newRiddle);
                                return context.redis.set(`riddles_${context.postId}`, JSON.stringify(allRiddles));
                            }),

                            // Also store this as a standalone riddle
                            context.redis.set(`post_data_${post.id}`, JSON.stringify(newRiddle))
                        ];

                        // Wait for all Redis operations to complete
                        await Promise.all(storeOperations);

                        // Update the post preview with custom content
                        await post.setCustomPostPreview(() => (
                            <vstack height="100%" width="100%" alignment="middle center">
     <image
       url="loading.gif"
       imageWidth={600}
       imageHeight={600}
       height="100%"
       width="100%"
       resizeMode="cover"
     />
   </vstack>

                        ));

                        // Update user points
                        const newPoints = await updateUserPoints(username!, RIDDLE_CREATION_POINTS);

                        // Notify the webview that the riddle was created
                        webView.postMessage({
                            type: 'riddleCreated',
                            data: {
                                success: true,
                                postId: post.id,
                                points: newPoints,
                            }
                        });

                        // Show success message
                        context.ui.showToast({ text: 'Riddle created and posted successfully!' });

                        // Only navigate after all operations are complete
                        context.ui.navigateTo(post);
                        break;
                    }
                    case 'requestHint': {
                        const currentMovie = await context.redis.get(`currentMovie_${context.postId}`);
                        let newPoints = await getUserPoints(username!);

                        if (currentMovie) {
                            try {
                                newPoints = await updateUserPoints(username!, HINT_USED_POINTS);
                                const hint = await generateMovieHint(currentMovie);
                                webView.postMessage({
                                    type: 'hintGenerated',
                                    data: {
                                        hint: hint,
                                        points: newPoints,
                                    },
                                });
                            } catch (error) {
                                console.error('Error generating hint:', error);
                                webView.postMessage({
                                    type: 'hintGenerated',
                                    data: {
                                        hint: 'Sorry, I am unable to generate a hint at this time.',
                                        points: newPoints,
                                    },
                                });
                            }
                        } else {
                            console.warn('No current movie to generate hint for.');
                            webView.postMessage({
                                type: 'hintGenerated',
                                data: {
                                    hint: 'No movie loaded. Start a game first!',
                                    points: newPoints,
                                },
                            });
                        }
                        break;
                    }

                    case 'requestGuesses': {
                        const postId = context.postId;
                        const guessKey = `guesses:${postId}`;

                        console.log('Fetching guesses from Redis:', guessKey);

                        try {
                            const guesses = await context.redis.hGetAll(guessKey);
                            const guessesArray = Object.entries(guesses).map(([guess, count]) => ({
                                guess: guess,
                                count: parseInt(count, 10),
                            }));

                            guessesArray.sort((a, b) => b.count - a.count);
                            console.log("Guesses retrieved from Redis:", guessesArray);

                            webView.postMessage({
                                type: 'receiveGuesses',
                                data: {
                                    guesses: guessesArray,
                                },
                            });
                        } catch (error) {
                            console.error('Error fetching guesses from Redis:', error);
                            webView.postMessage({
                                type: 'receiveGuesses',
                                data: {
                                    guesses: [],
                                },
                            });
                        }
                        break;
                    }

                    case 'requestLeaderboard': {
                        try {
                            const leaderboardData = await getLeaderboard();

                            webView.postMessage({
                                type: 'receiveLeaderboard',
                                data: {
                                    leaderboard: leaderboardData,
                                },
                            });
                        } catch (error) {
                            console.error('Error fetching leaderboard:', error);
                            webView.postMessage({
                                type: 'receiveLeaderboard',
                                data: {
                                    leaderboard: [],
                                },
                            });
                        }
                        break;
                    }
                }
            },
            onUnmount() {
                setInitialScreen('main');
                context.ui.showToast({ text: 'Reel Riddle closed!' });
            },
        });

        const openWebViewWithScreen = (screen: string) => {
            setInitialScreen(screen);
            webView.mount();
        };

        return (
            <vstack grow padding="small">
                {initialRiddleLoading ? (
                    <zstack grow alignment="middle center">
                        <image
                            url="loading.gif"
                            imageWidth={200}
                            imageHeight={200}
                            resizeMode="fit"
                        />
                    </zstack>
                ) : isSolvedScreen && currentRiddle ? ( // Display solved screen if isSolvedScreen is true and riddle is loaded
                    <zstack grow gap='small'>
                        <image
                            url="results.png" // Replace with your solved screen background image
                            imageWidth={1024}
                            imageHeight={768}
                            height="100%"
                            width="100%"
                            resizeMode="cover"
                        />
                        <vstack
                            height="100%"
                            width="100%"
                            padding="small"
                            alignment="center"
                            gap='small'
                        >
                            <hstack alignment="middle center" width="100%">
                                    {avatarUrl && (
                                        <image
                                            url={avatarUrl}
                                            imageWidth={50}
                                            imageHeight={50}
                                        />
                                    )}
                                    <text weight="bold" color='white'>You Solved the Reel Riddle</text>
                                </hstack>
                            <text size="xlarge" weight="bold" color="#ffffff">The movie was: {currentRiddle.movie}</text>
                            {currentRiddle.posterURL && (
                                <image
                                    url={currentRiddle.posterURL}
                                    imageWidth={200}
                                    imageHeight={300}
                                />
                            )}
                            <hstack alignment="middle center" width="100%" gap='none'>
                            
<zstack width="300px" height="60px" onPress={async () => {
  try {
    // Get the current subreddit name
    const subreddit = await context.reddit.getCurrentSubreddit();
    
    // Get multiple posts (e.g., 20 posts)
    const posts = await context.reddit
      .getHotPosts({
        subredditName: subreddit.name,
        limit: 20
      })
      .all();
    
    // Check if we got any posts
    if (posts && posts.length > 0) {
      // Select a random post from the array
      const randomIndex = Math.floor(Math.random() * posts.length);
      const randomPost = posts[randomIndex];
      
      // Navigate to the random post
      context.ui.navigateTo(randomPost);
    } else {
      context.ui.showToast('No posts found');
    }
  } catch (error) {
    console.error('Error navigating to random post:', error);
    context.ui.showToast('Error finding random post');
  }
}}>
  <image
    url="button.png"
    imageWidth={300}
    imageHeight={60}
    width="100%"
    height="100%"
    resizeMode="fit"
  />
  <vstack alignment="middle center" width="100%" height="100%">
    <text weight="bold" color="#4f0000">Play Again</text>
  </vstack>
</zstack>

                            <spacer width="-20px" /> 

                            <zstack width="300px" height="60px"  onPress={() => openWebViewWithScreen('results')}>
                                <image
                                    url="button.png" // Use the same button style as other buttons for consistency
                                    imageWidth={300}
                                    imageHeight={60}
                                    width="100%"
                                    height="100%"
                                    resizeMode="fit"
                                />
                                <vstack alignment="middle center" width="100%" height="100%">
                                    <text weight="bold" color="#4f0000">See Results</text>
                                </vstack>
                            </zstack>
                            </hstack>
                            <spacer grow />
                        </vstack>
                    </zstack>

                ) : currentRiddle ? ( // Original riddle screen if not solved
                    <zstack grow>
                        <image
                            url="game.png"
                            imageWidth={1024}
                            imageHeight={768}
                            height="100%"
                            width="100%"
                            resizeMode="cover"
                        />
                        <vstack
                            height="100%"
                            width="100%"
                            padding="large"
                            gap='small'
                        >
                            <spacer grow />
                            <vstack
                                gap="medium"
                                alignment="center"
                                width="100%"
                                padding='large'
                            >
                                <text size="xxlarge" weight="bold" color="#ffffff">Can you guess this movie?</text>
                                <text
                                    size="large"
                                    maxHeight="100px"
                                    overflow="ellipsis"
                                    wrap
                                    color="#ffffff"
                                >
                                    {currentRiddle.description}
                                </text>
                                <zstack width="200px" height="90px" onPress={() => webView.mount()}>
                                    <image
                                        url="play_button.gif"
                                        imageWidth={200}
                                        imageHeight={90}
                                        width="100%"
                                        height="100%"
                                        resizeMode="fit"
                                    />
                                    <vstack alignment="middle center" width="100%" height="100%">
                                        <text weight="bold" color="#4f0000">Guess</text>
                                    </vstack>
                                </zstack>
                                <hstack alignment="middle center" width="100%">
                                    <text weight="bold" color="#ffffff">Created By: {currentRiddle.createdBy}</text>
                                    {currentRiddle.creatorAvatar && (
                                        <image
                                            url={currentRiddle.creatorAvatar}
                                            imageWidth={50}
                                            imageHeight={50}
                                        />
                                    )}
                                </hstack>
                            </vstack>
                        </vstack>
                    </zstack>
                ) : ( // Default screen
                    <zstack grow>
                        <image
                            url="default.gif"
                            imageWidth={1024}
                            imageHeight={768}
                            height="100%"
                            width="100%"
                            resizeMode="cover"
                        />
                        <vstack
                            height="100%"
                            width="100%"
                            padding="large"
                        >
                            <spacer grow />
                            <vstack
                                gap="small"
                                alignment="center"
                                width="100%"
                            >
                                <zstack width="300px" height="60px" onPress={() => openWebViewWithScreen('create')}>
                                    <image
                                        url="button.png"
                                        imageWidth={300}
                                        imageHeight={60}
                                        width="100%"
                                        height="100%"
                                        resizeMode="fit"
                                    />
                                    <vstack alignment="middle center" width="100%" height="100%">
                                        <text weight="bold" color="#4f0000">Create</text>
                                    </vstack>
                                </zstack>

                                <zstack width="300px" height="60px" onPress={() => openWebViewWithScreen('leaderboard')}>
                                    <image
                                        url="button.png"
                                        imageWidth={300}
                                        imageHeight={60}
                                        width="100%"
                                        height="100%"
                                        resizeMode="fit"
                                    />
                                    <vstack alignment="middle center" width="100%" height="100%">
                                        <text weight="bold" color="#4f0000">Leaderboard</text>
                                    </vstack>
                                </zstack>

                                <zstack width="400px" height="60px" onPress={() => openWebViewWithScreen('help')}>
                                    <image
                                        url="button.png"
                                        imageWidth={400}
                                        imageHeight={60}
                                        width="100%"
                                        height="100%"
                                        resizeMode="fit"
                                    />
                                    <vstack alignment="middle center" width="100%" height="100%">
                                        <text weight="bold" color="#4f0000">How to Play</text>
                                    </vstack>
                                </zstack>
                            </vstack>
                        </vstack>
                    </zstack>
                )}
            </vstack>
        );
    },
});

export default Devvit;