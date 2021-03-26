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
	url: "https://id.twitch.tv/oauth2/token?client_id=ssj8kz2k3tss1y05ux9zqcpb6m83u0&client_secret=ejlc4l37humj0h906jof9gew21d4ek&grant_type=client_credentials&scope=user:edit:broadcast+user:edit+bits:read+chat:edit+chat:read+channel:read:redemptions+bits:read+channel:read:subscriptions+moderation:read",
	method:'POST',
}, function (err, res, body) {
		console.log(body);
});
