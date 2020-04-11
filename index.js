let http = require("https");
const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');

console.log("Starting app");

let spreadsheetID = "1a57y9eCqBWUF9l6QZ2qNjOzONtTlSCuvQEBHfWgYTTU";
let gameUniverseID = "300039023";

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

// The file token.json stores the user's access and refresh toke
const TOKEN_PATH = 'token.json';

// Load client secrets from a local file.
/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback, visits) {
    const {client_secret, client_id, redirect_uris} = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(
        client_id, client_secret, redirect_uris[0]);

    // Check if we have previously stored a token.
    fs.readFile(TOKEN_PATH, (err, token) => {
        if (err) return getNewToken(oAuth2Client, callback);
        oAuth2Client.setCredentials(JSON.parse(token));
        callback(oAuth2Client, visits);
    });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getNewToken(oAuth2Client, callback, visits) {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
    });
    console.log('Authorize this app by visiting this url:', authUrl);
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    rl.question('Enter the code from that page here: ', (code) => {
        rl.close();
        oAuth2Client.getToken(code, (err, token) => {
            if (err) return console.error('Error while trying to retrieve access token', err);
            oAuth2Client.setCredentials(token);
            // Store the token to disk for later program executions
            fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
                if (err) return console.error(err);
                console.log('Token stored to', TOKEN_PATH);
            });
            callback(oAuth2Client, visits);
        });
    });
}

function addLine(auth, visits) {
    const sheets = google.sheets({version: 'v4', auth});
    var date = new Date();
    sheets.spreadsheets.values.get({
        spreadsheetId: spreadsheetID,
        auth: auth,
        range: "Data"
    }, ((err, res) => {
        if(err) return console.error(err);
        let previousRow = +res.data.values.length;
        let currentRow = previousRow + 1;
        sheets.spreadsheets.values.append({
            spreadsheetId: spreadsheetID,
            range: "Data",
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: {
                values: [
                    ["" + date.getDate() + "-" + (+date.getMonth() + 1) + "-" + date.getFullYear() + " " + date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds(),visits,
                        "=A" + (currentRow) + "-A" + (previousRow), "=B" + (currentRow) + "-B" + (previousRow),
                        "=D" + (previousRow + 1) + "/((SECOND(C" + (currentRow) + ")/60)+(MINUTE(C" + (currentRow) + ")))",
                    "=10000000-B" + currentRow, "=Average(E" + (+currentRow - 29) + ":E" + currentRow + ")"]
                ]
            },
            auth: auth
        }, (err, res2) => {
            if(err) return console.error(err);
        });
    }));
}

let repeatedRun = () => {
    let req = http.request({
        host: "games.roblox.com",
        path: "/v1/games?universeIds=" + gameUniverseID,
        method: "GET",
        headers: {
            "Accept": "application/json"
        }
    }, res => {
        if(res.statusCode !== 200) {
            console.error("Err getting Status code" + res.statusCode);
            return;
        }
        let fullJSON = "";

        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            fullJSON = fullJSON + chunk.toString()
        });

        res.on("end", () => {
            let fullJsonParsed = JSON.parse(fullJSON);
            let wantedData = fullJsonParsed.data[0];
            let visits = wantedData["visits"];
            fs.readFile('credentials.json', (err, content) => {
                if (err) return console.log('Error loading client secret file:', err);
                // Authorize a client with credentials, then call the Google Sheets API.
                authorize(JSON.parse(content), addLine, visits);
            });

        });

        res.on("error", err => {
            console.error(err);
        });
    });


    req.on("error", err => {
        console.error(err);
    });
    req.end();
};

let latestRun = new Date().getTime() - 120000;
setInterval(() => {
    if((latestRun + 120000) < new Date().getTime()) {
        latestRun = latestRun + 120000;
        repeatedRun()
    }
}, 500);

console.log("Loop done");