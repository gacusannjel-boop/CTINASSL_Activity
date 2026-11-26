# Sonara — Music Listening Information System

Sonara is a classroom project for a small music-curation team. It has 80 songs across four mood collections and a listening journal for trying out database-backed Create, Read, Update, and Delete.

## How the app works

- [`client/src/tracks.js`](client/src/tracks.js) lists the tracks, groups them into Worlds, and connects them to Spotify.
- [`client/src/JournalPages.jsx`](client/src/JournalPages.jsx) contains the React form and Listening History. The form sends the entry to Express when you save.
- [`server/auth.js`](server/auth.js) handles registration, login, logout, and session lookup. MongoDB stores salted password hashes and expiring sessions.
- [`server/index.js`](server/index.js) validates the entry and reads or writes it in MongoDB. The collection is called `listening_entries`. Each document has an ID, song, artist, date, moods, and an optional reflection.

## Run the MERN demo in VS Code

Install Node.js 22.13+ and start MongoDB. Open the whole Sonara folder in VS Code. Run the commands below in two terminals that start at the project root.

Copy `server/.env.example` to `server/.env`. The sample uses local MongoDB on port 27017, the `sonara` database, and the Express server on port 5050. Change `MONGODB_URI` if your MongoDB runs elsewhere.

Install the server dependencies and start Express in the first terminal.

```sh
cd server
npm ci
npm start
```

Use `npm run dev` in the server directory to restart Express automatically when code changes.

Install the client dependencies, start Vite in the second terminal, and open the URL it prints.

```sh
cd client
npm ci
npm run dev
```

Vite forwards `/api` requests to Express on port 5050. If you change the server port, set `SONARA_API_PORT` to match when starting Vite. Music browsing is public. Register or log in to use the journal. Entries saved before accounts were introduced remain in storage without an owner and are not shown in signed-in accounts.

## Test Journal CRUD

Use a fictional entry for the demo. The Journal accepts today or a future date in Manila time. An existing entry can keep its original date even after that date passes. Sign in and use a new fictional entry to demonstrate each operation.

| Operation | What to try in Sonara | Express request |
| --- | --- | --- |
| Create | Fill in Journal and save the entry | `POST /api/entries` → 201 |
| Read | Refresh Listening History and confirm the entry is still there | `GET /api/entries` → 200 |
| Update | Edit the song, artist, date, moods, or reflection | `PUT /api/entries/:id` → 200 |
| Favorite | Toggle Favorite on the saved entry | `PATCH /api/entries/:id` → 200 |
| Delete | Delete the test entry and confirm it disappears | `DELETE /api/entries/:id` → 200 |

Import [Sonara Journal API](server/Sonara.postman_collection.json) into Postman and run the requests in order with the cookie jar enabled. The collection registers a demo account, logs in, tests CRUD and Favorite, then verifies that logout removes journal access.

Run the client checks from the `client` directory.

```sh
npm run lint
npm run build
```

## Teams submission

- **Activity 1.1** asks for full-desktop screenshots of the actual app. Show the catalog, Journal form, and Listening History with the saved entry.
- **Activity 1.2** asks for full-desktop screenshots of the server code and API testing. Open `server/index.js` in VS Code and run the CRUD requests against `http://127.0.0.1:5050` in Thunder Client, Postman, or Insomnia.

Use each activity’s Teams template and export separate PDFs. Follow the filenames in the Teams posts, ending in `_Activity1.1.pdf` and `_Activity1.2.pdf`. Keep the reports in the local `Submission/` folder.
