const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');
const fs = require('fs');
const xml2js = require('xml2js');
dotenv.config();

const app = express();
const port = 3000;

let accessToken = '';

app.use(express.static('public'));
app.use(express.json());

// Get an access token
const getSpotifyToken = async () => {
  const authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')
    },
    data: 'grant_type=client_credentials',
    method: 'POST'
  };
  try {
    const response = await axios(authOptions);
    accessToken = response.data.access_token;
  } catch (error) {
    console.error('Error getting Spotify token:', error);
  }
};

// Refresh token every hour
getSpotifyToken();
setInterval(getSpotifyToken, 3600 * 1000);

// Function to fetch playlists with pagination
const fetchPlaylists = async (query, limit, offset) => {
  console.log(`Fetching playlists for query: ${query}, limit: ${limit}, offset: ${offset}`);
  const response = await axios.get(`https://api.spotify.com/v1/search`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    },
    params: {
      q: query,
      type: 'playlist',
      limit: limit,
      offset: offset
    }
  });
  console.log(`Fetched playlists: ${response.data.playlists.items}`);
  return response.data.playlists.items;
};

// Route to search for playlists
app.get('/search', async (req, res) => {
  const query = req.query.q;
  if (!query) {
    return res.status(400).json({ error: 'A query is required' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    // 50 is the max number of results per request
    const limit = 50;
    // Decrease this value in case of issues
    const totalResults = 1000;
    // The following values are for testing purposes
    // const limit = 10;
    // const totalResults = 10;
    let allPlaylists = [];

    for (let offset = 0; offset < totalResults; offset += limit) {
      const playlists = await fetchPlaylists(query, limit, offset);
      allPlaylists = allPlaylists.concat(playlists);
      // Stop if there are no more results
      if (playlists.length < limit) {
        break;
      }
      // To avoid hitting rate limits
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log(`Fetched ${allPlaylists.length} playlists`);

    await allPlaylists.reduce(async (previousPromise, playlist) => {
        await previousPromise;
    
        if (!playlist) {
            console.error('Playlist is undefined');
            return Promise.resolve();
        }

        if (playlist.owner.id != 'spotify' && playlist.tracks?.total > 0) {
          // Check if the owner is in the hidden list
          const filePath = 'hidden_owners.xml';
          if (fs.existsSync(filePath)) {
              const xmlData = fs.readFileSync(filePath, 'utf8');
              const result = await xml2js.parseStringPromise(xmlData);
              const hiddenOwners = result.owners.owner || [];
              if (hiddenOwners.includes(playlist.owner.display_name)) {
                  return Promise.resolve();
              }
          }
          try {
              // Fetch playlist details to get the number of followers
              const playlistDetails = await axios.get(`https://api.spotify.com/v1/playlists/${playlist.id}`, {
                  headers: {
                      'Authorization': `Bearer ${accessToken}`
                  }
              });
      
              console.log(`Fetched details for playlist: ${playlist.name}`);

              // Filter out playlists that are not popular enough
              if (playlistDetails.data.followers.total < 200){
                console.log(`Playlist has less than 200 followers, skipping`);
                return Promise.resolve();
              }

              const name = playlist.name || 'Unknown Name';
              const ownerName = playlist.owner?.display_name || 'Unknown Owner';
              const ownerUrl = playlist.owner?.external_urls?.spotify || '#';
              const followers = playlistDetails.data.followers.total || 0;
              const totalTracks = playlist.tracks?.total || 0;
              const url = playlist.external_urls?.spotify || '#';
              const playlistImageUrl = playlist.images?.[0]?.url || '';
              // Get the owner image with the spotify api
              const ownerImageUrl = await axios.get(`https://api.spotify.com/v1/users/${playlist.owner.id}`, {
                headers: {
                  'Authorization': `Bearer ${accessToken}`
                }
              }).then(response => {
                return response.data.images?.[0]?.url || '';
              }).catch(error => {
                console.error(`Failed to fetch owner image for playlist: ${playlist.name}`, error);
                return '';
              });

      
              const detailedPlaylist = {
                name,
                ownerName,
                ownerUrl,
                followers,
                totalTracks,
                url,
                playlistImageUrl,
                ownerImageUrl
              };

              // Send the playlist details to the client
              res.write(`data: ${JSON.stringify(detailedPlaylist)}\n\n`);
      
              // Add a delay to avoid hitting rate limits
              await new Promise(resolve => setTimeout(resolve, 200));
          } catch (error) {
              if (error.response && error.response.status === 429) {
                  const retryAfter = parseInt(error.response.headers['retry-after'], 10) * 1000;
                  console.log(`Rate limited. Retrying after ${retryAfter / 1000} seconds.`);
                  await new Promise(resolve => setTimeout(resolve, retryAfter));
              } else {
                  console.error(`Failed to fetch details for playlist: ${playlist.name}`, error);
              }
          }
        }
    
        return Promise.resolve();
    }, Promise.resolve());

    res.end();
  
  } catch (error) {
    if (error.response && error.response.status === 429) {
      const retryAfter = parseInt(error.response.headers['retry-after'], 10) * 1000;
      console.log(`Rate limited. Retrying after ${retryAfter} milliseconds`);
      await new Promise(resolve => setTimeout(resolve, retryAfter));
    }
    console.error('Error fetching playlists:', error);
    res.status(500).json({ error: 'Error fetching playlists' });
  }
});

// Route to ignore owner
app.post('/hide-owner', async (req, res) => {
  const { ownerName } = req.body;
  if (!ownerName) {
    return res.status(400).json({ error: 'Owner name is required' });
  }

  console.log(`Ignoring owner: ${ownerName}`);

  const filePath = 'hidden_owners.xml';
  let ignoredOwners = [];

  // Read the existing XML file if it exists
  if (fs.existsSync(filePath)) {
    const xmlData = fs.readFileSync(filePath, 'utf8');
    const result = await xml2js.parseStringPromise(xmlData);
    ignoredOwners = result.owners.owner || [];
  }

  // Add the new owner to the list if not already present
  if (!ignoredOwners.includes(ownerName)) {
    ignoredOwners.push(ownerName);
  }

  console.log('Ignored owners:', ignoredOwners);

  // Convert the list back to XML
  const builder = new xml2js.Builder();
  const xml = builder.buildObject({ owners: { owner: ignoredOwners } });

  console.log('Updated hidden_owners.xml');

  // Write the updated XML to the file
  fs.writeFileSync(filePath, xml);

  res.status(200).json({ message: 'Owner ignored successfully' });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});