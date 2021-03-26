require('dotenv').config();

const tmi = require('tmi.js');

var token;

const client = new tmi.Client({
	options: { debug: true },
	connection: {
		secure: true,
		reconnect: true
	},
	identity: {
		username: process.env.TWITCH_USERNAME,
		password: process.env.TWITCH_AUTH_CODE
	},
	channels: [ process.env.TWITCH_CHANNEL ]
});

client.connect();

client.api({
	url: "https://id.twitch.tv/oauth2/token?client_id=ssj8kz2k3tss1y05ux9zqcpb6m83u0&client_secret=qrjmvlnswxulsuvk94mf4hh5gvzrw3&code=hs4nqnwhh6amr6vecbu1yvjde611zq&grant_type=authorization_code&redirect_uri=https://localhost/",
	method:'POST',
}, function (err, res, body) {
		console.log(body);
});
