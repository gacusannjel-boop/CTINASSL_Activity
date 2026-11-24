# Sonara: A World of Sound
React + Vite + Three.js classroom information system. Four subjective mood collections, 38 unique tracks from the supplied playlist, floating WebGL discs, journal CRUD in browser storage, Spotify playlist embed. Art consists of original procedural disc designs, not official album covers. Background uses the supplied cloud and flourish images. Use fictional journal entries only. No music is hosted or automatically started on disc selection.

## Activity 1.1
From your existing project: `cd client`, back up `src`, extract this ZIP into `client`, run `npm install three`, then `npm run dev`. Do not overwrite `main.jsx`. Use the localhost URL Vite prints. Click a world and use wheel/drag or +/− buttons. Click the canvas and use WASD or arrow keys to move. Search by title, artist, world or mood to arrange matching discs into a grid. The list beneath the scene is a keyboard-accessible alternative. Test create/edit/delete journal records before taking screenshots.

## Activity 1.2
Extract the separate server ZIP at the project root (not client). In `server`, run `npm install`, `cp .env.example .env` and enter your MongoDB Atlas connection string into `.env`. Add only your current IP in Atlas. Keep credentials out of Git and screenshots. Run `npm start`. Update `client/src/mood-config.js` to `export const API = "http://localhost:5000";` and refresh frontend. Use Thunder Client on `http://localhost:5000/api/entries` (GET, POST, PUT /:id, DELETE /:id). Example POST body: {"song":"be original","artist":"TYLER LEWIS","mood":"Calm","afterMood":"Happy","date":"2026-11-24","note":"Fictional class demo"}. Use the returned _id for PUT and DELETE. This API is local-only and has no authentication; not intended for public deployment.

## References
W3Schools React: https://www.w3schools.com/react/
W3Schools CSS 3D transforms: https://www.w3schools.com/css/css3_3dtransforms.asp
W3Schools CSS animations: https://www.w3schools.com/css/css3_animations.asp
W3Schools Node.js MongoDB: https://www.w3schools.com/nodejs/nodejs_mongodb.asp
Three.js: https://threejs.org/docs/
Visual inspiration: https://karma-tracks.com/ and https://www.awwwards.com/sites/karma-worlds
Playlist: https://open.spotify.com/playlist/54RgNONrO5wlwxCcwWfnIh

## Immersive edition
A continuous sticky home scene turns scattered 3D discs into a horizontal lineup as the page scrolls. Click a disc or world label to enter its collection. Featured is a 3D carousel, with a separate interactive full collection. The same edge-to-edge animated sky and floral flourishes extend behind all pages. The Motion button pauses the background animation; it does not freeze the interactive 3D scene. Disc artwork is original SVG art. Individual song playback is deferred; the existing official Spotify playlist embed and search links remain.

Syntax checks passed; WebGL rendering and MongoDB connectivity must be tested on the student's machine.

## Borderless disc edition
All 38 track disc textures and four world textures have individually drawn procedural artwork; the track title and artist are part of the artwork itself. No separate title labels appear under the 3D discs. Scroll the home scene until the discs line up. Other home sections and the journal illustration use interactive WebGL discs too. The accessible track index is a borderless CSS 3D hover layout. The motion toggle pauses ambient WebGL drift and the floral/sky animation. Ordinary input fields remain usable HTML. The official Spotify playlist player remains optional; individual automatic track playback is not implemented yet.

## Cinematic motion edition (latest)
Install `npm install three gsap lenis` in client. The home is a sticky, continuous WebGL scene with camera-space depth changes and smoothed transforms, not separate boxed sections. GSAP handles navigation and menu transitions, Lenis handles inertial page scrolling; collection wheel input is deliberately captured for camera zoom. The header is reduced to the wordmark and three-line menu, and the bottom listening controls float with no bar or border. Gallery and featured index can be toggled. The cloud artwork is reused under a deeper rose/mauve color grade. The API setting is not overwritten by this ZIP; if you need to create it, use `export const API = "";` for local mode. For actual MongoDB integration, see Activity 1.2 above. Audio remains deferred; the playlist embed and Spotify search link are optional and do not auto-play a selected disc. The 3D scenes are custom implementations, not Karma's source code. Normal controls and forms are HTML. GSAP: https://gsap.com/docs/v3/ ; Lenis: https://github.com/darkroomengineering/lenis .
