 # PromoSpot

PromoSpot is a simple Spotify playlist search engine for promotional purposes. The goal of this tool is to provide an easy way to find the best playlists and curators for someone's music, wrapped in a simple and funcitonnal interface.

**Note**: This project is still a work-in-progress. There are still bugs and other small issues to be ironed out.


## Features

PromoSpot searches Playlists, displays useful information about that playlist and its owner, and sorts them according to what you choose in the table headers. By default, playlists will be sorted in decreasing order of listeners per number of tracks.

In addition to the buttons to easily search the owner on Facebook or Google, there is also a way to hide all playlists from
a certain owner by clicking on the **Hide Owner** button. Hidden owners will be stored in an `hidden_owners.xml` file, and
can be easily un-hidden by removing their entry in this file.

More features may come in the future, stay tuned.

## Requirements

- Node.js

## API Access Token Setup

1. Clone this repo.
2. Request an Spotify API Access Token. You can follow the first part of
[this tutorial](https://developer.spotify.com/documentation/web-api/tutorials/getting-started) to do so, but
basically you will need to login to the Spotify Developer Dashboard with your Spotify account, create a new application in **development mode** which is free and should be plenty for personal use. After creating an application and requesting your token, you will be given a client ID and a secret.
3. In the root folder of this repository, simply create a file called `.env`, and put both of these strings inside it formatted like so:

```
SPOTIFY_CLIENT_ID=yourClientIdGoesHere
SPOTIFY_CLIENT_SECRET=yourClientSecretGoesHere
```

## Installing Packages and Launching PromoSpot

1. Install the required Node packages and dependencies: run `npm install` in the repo's root directory. This is only needed
before launching PromoSpot for the first time.
2. Start the web server with `node promospot.js`. The web page's local URL and port will be displayed in the console. Simply go to that address in your Browser and start searching!

## Tips and Tricks

- Reloading the page will unload all search results. To get around this or save the results for later, you can simply do **Ctrl+S** and save the webpage itself. Saving the page in a dedicated folder named with the search terms used is recommended. Note that some functions like the quick search buttons won't work when opening that page later.