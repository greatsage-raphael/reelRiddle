import './createPost.js';

import { Devvit, useState, useWebView } from '@devvit/public-api';

Devvit.configure({
  redditAPI: true,
  redis: true,
  http: true
});

// Add menu item to create a new Reel Riddle post
Devvit.addMenuItem({
  label: 'Create New Reel Riddle Game',
  location: 'subreddit',
  onPress: async (_event, context) => {
    const { reddit, ui } = context;
    const subreddit = await reddit.getCurrentSubreddit();
    const post = await reddit.submitPost({
      title: 'Reel Riddle - Movie Guessing Game',
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
    await post.sticky();
    
    ui.showToast({ text: 'Created Reel Riddle game!' });
    ui.navigateTo(post);
  },
});


export default Devvit;