const { ApiClient, HelixStream } = require('twitch');
const { RefreshableAuthProvider, StaticAuthProvider, ClientCredentialsAuthProvider } = require('twitch-auth');
const { ChatClient } = require('twitch-chat-client');
const { PubSubClient } = require('twitch-pubsub-client');
const { PubSubRedemptionMessage } = require('twitch-pubsub-client');
const { PubSubBitsMessage } = require('twitch-pubsub-client');
const fs = require('fs').promises;
const Discord = require('discord.js');
const { MessageEmbed } = require('discord.js');
require('dotenv').config();

async function main() {

    const clientId = 'ssj8kz2k3tss1y05ux9zqcpb6m83u0';
    const clientSecret = 'ejlc4l37humj0h906jof9gew21d4ek';

    const tokenData  = JSON.parse(await fs.readFile('./tokens.json', 'UTF-8'));
    const authProvider = new RefreshableAuthProvider(
        new StaticAuthProvider(clientId, tokenData.accessToken),
        {
            clientSecret,
            refreshToken: tokenData.refreshToken,
            expiry: tokenData.expiryTimestamp === null ? null : new Date(tokenData.expiryTimestamp),
            onRefresh: async ({ accessToken, refreshToken, expiryDate }) => {
                const newTokenData = {
                    accessToken,
                    refreshToken,
                    expiryTimestamp: expiryDate === null ? null : expiryDate.getTime()
                };
                await fs.writeFile('./tokens.json', JSON.stringify(newTokenData, null, 4), 'UTF-8')
            }
        }
    );

    const chatTokenData = JSON.parse(await fs.readFile('./chattokens.json', 'UTF-8'));
    const chatAuthProvider = new RefreshableAuthProvider(
        new StaticAuthProvider(clientId, chatTokenData.accessToken),
        {
            clientSecret,
            refreshToken: chatTokenData.refreshToken,
            expiry: chatTokenData.expiryTimestamp === null ? null : new Date(chatTokenData.expiryTimestamp),
            onRefresh: async ({ accessToken, refreshToken, expiryDate }) => {
                const newTokenData = {
                    accessToken,
                    refreshToken,
                    expiryTimestamp: expiryDate === null ? null : expiryDate.getTime()
                };
                await fs.writeFile('./chattokens.json', JSON.stringify(newTokenData, null, 4), 'UTF-8')
            }
        }
    );

    const api = new ApiClient({ authProvider: authProvider });
    const chatApi = new ApiClient({ authProvider: chatAuthProvider });

    const pubSubClient = new PubSubClient();
    const userId = await pubSubClient.registerUserListener(api);

    const chatClient = new ChatClient( chatApi, { channels: ['meximanian'] });
    await chatClient.connect();

    const channelId = await api.helix.users.getUserByName('meximanian');

    const redemptionListener = await pubSubClient.onRedemption(userId, (message = PubSubRedemptionMessage) => {
      redemption(message);
    });

    const bitsListener = await pubSubClient.onBits(userId, (message = PubSubBitsMessage) => {
      bits(message);
    });

    chatClient.onMessage((channel, user, message, msg) => {

        if (message === '!dice') {
            const diceRoll = Math.floor(Math.random() * 6) + 1;
            chatClient.say(channel, `@${user} rolled a ${diceRoll}`);
        }

        if (message.includes('!game') && message.length > 5){
          if(msg.userInfo.isMod || msg.userInfo.isBroadcaster){
            setGameInformation(api, channelId, message, channel, chatClient);
          }

          else {
            chatClient.say(channel, `@${user}, You cannot change the game!`);
          }
        }

        else if(message === "!game"){
          getGameInformation(api, channelId, message, channel, chatClient);
        }

        if (message.includes('!title') && message.length > 6){
          if(msg.userInfo.isMod || msg.userInfo.isBroadcaster){
            setTitleInformation(api, channelId, message, channel, chatClient);
          }

          else {
            chatClient.say(channel, `@${user}, You cannot change the title!`);
          }
        }

        else if(message === "!title"){
          getTitleInformation(api, channelId, message, channel, chatClient);
        }

      if(message === "!hi"){
         chatClient.say(channel, `Hello, @${user}!`)
      }
    });

    chatClient.onSub((channel, user) => {
        chatClient.say(channel, `Thanks to @${user} for subscribing to the channel!`);
    });
    chatClient.onResub((channel, user, subInfo) => {
        chatClient.say(channel, `Thanks to @${user} for subscribing to the channel for a total of ${subInfo.months} months!`);
    });
    chatClient.onSubGift((channel, user, subInfo) => {
        chatClient.say(channel, `Thanks to @${subInfo.gifter} for gifting a subscription to @${user}!`);
    });

    function bits(message){
      bitsAmount = message.bits;
      userName = message.userName;
      chatClient.say('meximanian', `Thanks to @${userName} for redeeming ${bitsAmount} bits for the channel!`);
    }

    function redemption(message){
      rewardName = message.rewardName;
      userName = message.userDisplayName;
      chatClient.say('meximanian', ` @${userName} redeemed ${rewardName} for the channel!`);
    }

    var live = false;
    setInterval(stream, 480000);

    async function stream() {
      var stream = await api.helix.streams.getStreamByUserId(channelId);
      const attachment = new Discord.MessageAttachment('meximanian.png')

      if(stream != null && !live){
        var channel = client.channels.cache.get('793899102374330428');
        var game = await api.helix.games.getGameById(stream.gameId);
        var gameName = game.name;
        var embed = new MessageEmbed()
          .setColor('800000')
          .setTitle(stream.title)
          .setURL("https://www.twitch.tv/meximanian")
          .setAuthor('Meximanian reporting for duty!', "attachment://meximanian.png", "https://www.twitch.tv/meximanian")
          .setDescription(`Playing ${gameName} with ${stream.viewers} viewers!!`)
          .setImage(stream.getThumbnailUrl(400, 225))
          .attachFiles(attachment)
          .setFooter("Sent by MeximanianBot", 'attachment://meximanian.png')
          .setTimestamp()
        channel.send(embed);
        live = true;

        console.log('Stream is now active');
      }

      else if( stream == null ){
        console.log("Stream is offline");
        live = false;
      }
    }

    const client = new Discord.Client();

    client.on('ready', () => {
      console.log(`Logged in as ${client.user.tag}!`);
    });

    client.on('message', msg => {
      if ( msg.content.startsWith("!votekick") )
        {
          var member = msg.mentions.members.first();
          var kicked = false;
          if ( member && !kicked )
          {
            try
            {
              var max = msg.member.voice.channel.members.size;
            }
            catch( error)
            {
              msg.delete();
              people(msg);
              return;
            }

            msg.react('👍');
            const filter = (reaction) => reaction.emoji.name === '👍';
            const collector = msg.createReactionCollector(filter, { time: 10000 });

            var users = [];
            var int = 0;
            console.log(Math.round(max/2));

            collector.on('collect', (reaction, user) =>
            {
              if ( !users.includes(user) && !user.bot )
              {
                users.push(user);
                int++;
              }

              if ( int >= Math.round(max/2) && !kicked)
              {
                member.voice.kick();
                msg.delete();
                users = [];
                int = 0;
                kicked = true;
              }
            });

            collector.on('end', collected =>
            {
              if (!kicked)
              {
                users = [];
                int = 0;
                msg.delete();
                notification(msg, member);
              }
              kicked = false;
            });
          }

          else
          {
            msg.delete();
            warning(msg);
          }
        }

      if( msg.content == "!test")
      {
        msg.delete();
        var guild = client.guilds.cache.array()[0];
        if (guild.channels.cache.has(guild.id)){
          console.log(guild.channels.cache.get(guild.id));
        }

        else{
          console.log('nothing');
        }
      }
    });

    async function clear(message)
    {
      message.delete();
      const fetched = await message.channel.messages.fetch({limit:5});
      message.channel.bulkDelete(fetched);
    }

    async function notification(message, member)
    {
      var alert = await message.channel.send(member.displayName + " was not kicked!");
      alert.delete({timeout: 5000});
    }

    async function warning(message)
    {
      var test = await message.channel.send("This is not an appropriate member!");
      test.delete({timeout:5000});
    }

    async function people(message)
    {
      var people = await message.channel.send("You are not in voice channel!");;
      people.delete({timeout:5000});
    }


    client.login('Nzg1MDQwODM4MDgxMzgwMzYz.X8yEQQ.0lXVURBTr08ROxdxigOjXBoLfmo');
}
main();

async function setGameInformation(api, userId, message, channel, chatClient){
  messageGame = message.slice(6)
  game = await api.helix.games.getGameByName(messageGame);
  if (game === null){
    chatClient.say(channel, `This is not a valid game.`);
  }
  else{
    api.helix.channels.updateChannelInfo(userId, {gameId : game['id']});
    chatClient.say(channel, `The game is now set to ${messageGame}!`);
  }
}

async function setTitleInformation(api, userId, message, channel, chatClient){
  messageTitle = message.slice(7);
  api.helix.channels.updateChannelInfo(userId, {title :messageTitle});
  chatClient.say(channel, `The title is now set to ${messageTitle}!`);
}

async function getGameInformation(api, userId, message, channel, chatClient){
  var promise = await api.helix.channels.getChannelInfo(userId);
  chatClient.say(channel, `The game currently being played is ${promise.gameName}!`);
}

async function getTitleInformation(api, userId, message, channel, chatClient){
  var promise = await api.helix.channels.getChannelInfo(userId);
  chatClient.say(channel, `The title of the stream is ${promise.title}!`);
}
