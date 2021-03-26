const { ApiClient } = require('twitch');
const { RefreshableAuthProvider, StaticAuthProvider, ClientCredentialsAuthProvider } = require('twitch-auth');
const { ChatClient } = require('twitch-chat-client');
const { PubSubClient } = require('twitch-pubsub-client');
const { PubSubRedemptionMessage,  PubSubBitsMessage } = require('twitch-pubsub-client');
const Discord = require('discord.js');
const { MessageEmbed } = require('discord.js');
const fs = require('fs').promises;
require('dotenv').config();

var globalApi;

function main()
{
  TwitchSystem();
  DiscordSystem();
}

async function TwitchSystem()
{
  const applicationData  = JSON.parse(await fs.readFile('./application.json', 'UTF-8'));
  const clientId = applicationData.clientId;
  const clientSecret = applicationData.clientSecret;

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
  const channelId = await api.helix.users.getUserByName('meximanian');

  const pubSubClient = new PubSubClient();

  const chatClient = new ChatClient( chatApi, { channels: ['meximanian'] });
  await chatClient.connect();

  PubSub(pubSubClient, api, chatClient);
  ChatClientSystem(chatClient, chatApi, api, channelId);

  globalApi = api;
}

async function PubSub(pubSubClient, api, chatClient){
  const userId = await pubSubClient.registerUserListener(api);

  const redemptionListener = await pubSubClient.onRedemption(userId, (message = PubSubRedemptionMessage) => {
    PubSubListener(message, "redemp");
  });

  const bitsListener = await pubSubClient.onBits(userId, (message = PubSubBitsMessage) => {
    PubSubListener(message, "bits");
  });

  function PubSubListener(message, type)
  {
    if(type == "redemp")
    {
      rewardName = message.rewardName;
      userName = message.userDisplayName;
      chatClient.say('meximanian', ` @${userName} redeemed ${rewardName} for the channel!`);
    }

    if(type == "bits")
    {
      bitsAmount = message.bits;
      userName = message.userName;
      chatClient.say('meximanian', `Thanks to @${userName} for redeeming ${bitsAmount} bits for the channel!`);
    }
  }
}

async function ChatClientSystem(chatClient, chatApi, api, channelId){

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

  async function setGameInformation(api, userId, message, channel, chatClient){
    messageGame = message.slice(6)
    game = await api.helix.games.getGameByName(messageGame);
    if (game === null){
      chatClient.say(channel, `This is not a valid game.`);
    }
    else{
      api.helix.channels.updateChannelInfo(userId, {gameId : game['id']});
      chatClient.say(channel, `The game is now set to ${messageGame}.`);
    }
  }

  async function setTitleInformation(api, userId, message, channel, chatClient){
    messageTitle = message.slice(7);
    api.helix.channels.updateChannelInfo(userId, {title :messageTitle});
    chatClient.say(channel, `The title is now set to ${messageTitle}`);
  }

  async function getGameInformation(api, userId, message, channel, chatClient){
    var promise = await api.helix.channels.getChannelInfo(userId);
    chatClient.say(channel, `The game currently being played is ${promise.gameName}.`);
  }

  async function getTitleInformation(api, userId, message, channel, chatClient){
    var promise = await api.helix.channels.getChannelInfo(userId);
    chatClient.say(channel, `The title of the stream is ${promise.title}`);
  }
}

function DiscordSystem(){
  const client = new Discord.Client();
  var live = false;
  var notificationCheck = false;
  var channelCheck = false;
  var kickedMembers = [];
  var lastGame;

  StartUp();

  client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
  });

  client.on('message', msg => {
    if (!msg.guild) return;

    if ( msg.content.startsWith("!votekick") )
      {
        Votekick(msg);
      }

    if (msg.content == "!commands"){
      Commands(msg);
    }

    if (msg.guild.name === "Gunslinger Club"){
      if (msg.content == "!roles"){
        Roles(msg);
      }

      if(msg.content == "!clip"){
        Clip(msg);
      }
    }

  });

    function Votekick(msg){
          var member = msg.mentions.members.first();
          var kicked = false;
          if ( member && !kicked && msg.member.voice.channel == member.voice.channel)
          {
            if ( !kickedMembers.includes(member.id) ){
              try
              {
                var max = msg.member.voice.channel.members.size;
                var currentMembers = msg.member.voice.channel.members.array();
              }
              catch( error )
              {
                msg.delete();
                Management(msg, msg.member.user, "active");
                return;
              }

              msg.react('👍');
              const filter = (reaction) => reaction.emoji.name === '👍';
              const collector = msg.createReactionCollector(filter, { time: 10000 });

              var users = [];
              var int = 0;

              collector.on('collect', (reaction, user) =>
              {
                if ( !users.includes(user) && !user.bot )
                {
                  if( VoiceCurrent(user, currentMembers) ){
                    users.push(user);
                    int++;
                  }
                }

                else if( !VoiceCurrent(user, currentMembers) && !user.bot ){
                  Management(msg, user, "baddie");
                }

                if ( int >= Math.round(max/2) && !kicked)
                {
                  member.voice.kick();
                  kickedMembers.push(member.id);
                  msg.delete();
                  users = [];
                  int = 0;
                  kicked = true;
                  setTimeout(KickMember,300000, member, kickedMembers);
                }
              });

              collector.on('end', collected =>
              {
                if (!kicked)
                {
                  users = [];
                  int = 0;
                  msg.delete();
                  Management(msg, member, "kicked");
                }
                kicked = false;
              });
            }

            else
            {
              Management(msg, member, "cooldown");
              msg.delete();
              return;
            }
          }
          else {
            msg.delete();
            Management(msg, msg.author, "warning");
            return;
          }
        }

      function VoiceCurrent(user, current){
        for (i = 0; i < current.length; i++)
        {
          if (user == current[i].user)
          {
            return true;
          }
        }
        return false;
      }

      function KickMember(member, kickedMembers){
        for (i = 0; i < kickedMembers.length; i++){
          if( kickedMembers[i] == member.id){
            kickedMembers.splice(i);
          }
        }
      }

      function Commands(msg){
        const attachment = new Discord.MessageAttachment('meximanian.png');
        var embed = new MessageEmbed()
          .setColor('800000')
          .setAuthor('MeximanianBot Commands', "attachment://meximanian.png")
          .addField('!votekick', 'Allows people to vote to kick someone out of a voice channel.')
          .addField('!roles', 'Sends a message that allows people to put on custom roles(Only in main server).')
          .attachFiles(attachment)
          .setThumbnail('attachment://meximanian.png')
        CommandsManagement(msg, embed);
        msg.delete();
      }

      setInterval(stream, 480000);

      async function Management(message, member, cond){
        if(cond == "active"){
          var people = await message.channel.send(`${member}, You are not in a voice channel!`);;
          people.delete({timeout:5000});
        }

        if(cond == "warning"){
          var warning = await message.channel.send(`${member}, This is not an appropriate member!`);
          warning.delete({timeout:5000});
        }

        if (cond == "kicked"){
          var alert = await message.channel.send(member.displayName + " was not kicked!");
          alert.delete({timeout: 5000});
        }

        if (cond == "baddie"){
          var alert = await message.channel.send(`${member}, You must be in the voice channel to participate!`);
          alert.delete({timeout: 5000});
        }

        if (cond == "cooldown"){
          var kicked = await message.channel.send(`${member.displayName} is on a cooldown to kick again!`);
          kicked.delete({timeout: 5000});
        }
      }

      async function CommandsManagement(msg, embed){
        var message = await msg.channel.send(embed);
        message.delete({timeout:30000});
      }

      async function stream() {
        var channelId = await globalApi.helix.users.getUserByName('meximanian');
        var stream = await globalApi.helix.streams.getStreamByUserId(channelId);

        const attachment = new Discord.MessageAttachment('meximanian.png');
        var guild = client.guilds.cache.array()[0];
        var role = guild.roles.cache.find(role => role.name == "Gunslingers");
        var channel = client.channels.cache.get('793899102374330428');

        if(stream != null && !live){
          var game = await globalApi.helix.games.getGameById(stream.gameId);
          var gameName = game.name;
          var url = stream.getThumbnailUrl(400, 225);
          var time = Math.floor(Math.random() * 100000);

          var embed = new MessageEmbed()
            .setColor('800000')
            .setTitle(stream.title)
            .setURL("https://www.twitch.tv/meximanian")
            .setAuthor('Meximanian reporting for duty!', "attachment://meximanian.png", "https://www.twitch.tv/meximanian")
            .addField(`Playing ${gameName}!`, '[Watch Stream](https://www.twitch.tv/meximanian)')
            .setImage(url + '?v=' + time)
            .attachFiles(attachment)
            .setFooter("Sent by MeximanianBot", 'attachment://meximanian.png')
            .setTimestamp()
          channel.send(embed);
          channel.send(`<@&${role.id}>, Meximanian is currently live!`);
          live = true;
          lastGame = gameName;

          console.log('Stream is now active');
        }

        else if( stream === null ){
          console.log("Stream is offline");
          live = false;
        }

        if(live){
          var game = await globalApi.helix.games.getGameById(stream.gameId);
          var gameName = game.name;

          if(lastGame !== gameName){
            var gameName = game.name;
            var url = stream.getThumbnailUrl(400, 225);
            var time = Math.floor(Math.random() * 100000);

            var embed = new MessageEmbed()
              .setColor('800000')
              .setTitle('Game Changed')
              .setURL("https://www.twitch.tv/meximanian")
              .setAuthor('Meximanian reporting for duty!', "attachment://meximanian.png", "https://www.twitch.tv/meximanian")
              .addField(`Playing ${gameName}!`, '[Watch Stream](https://www.twitch.tv/meximanian)')
              .setImage(url + '?v=' + time)
              .attachFiles(attachment)
              .setFooter("Sent by MeximanianBot", 'attachment://meximanian.png')
              .setTimestamp()
            channel.send(embed);
          }
          lastGame = gameName;
        }
      }

      function Roles(msg){
        var dbdRole = msg.guild.roles.cache.find(role => role.name === "Dead by Daylight")
        msg.react('818176560888545323');
        const filter = (reaction) => reaction.emoji.id === '818176560888545323';
        const collector = msg.createReactionCollector(filter, { time: 604800000 , dispose: true});
        collector.on('collect', (reaction, user) =>
        {
          if(!user.bot){
            msg.member.roles.add(dbdRole);
          }
        });

        collector.on('remove', (reaction, user) =>
        {
          if(!user.bot){
            msg.member.roles.remove(dbdRole);
          }
        });
      }

      async function Clip(msg){
        msg.delete();
        var channelId = await globalApi.helix.users.getUserByName('meximanian');
        const {data: videos} = await globalApi.helix.videos.getVideosByUser(channelId);
        var latestClip = videos[0];
        var width = latestClip.thumbnailUrl.replace('%{width}', '400');
        var height = width.replace('%{height}', '225');
        const attachment = new Discord.MessageAttachment('meximanian.png');
        var embed = new MessageEmbed()
          .setColor('800000')
          .setAuthor('Latest Twitch Clip', "attachment://meximanian.png", latestClip.url)
          .setTitle(latestClip.title)
          .attachFiles(attachment)
          .addField(`Length: ${latestClip.duration}`, `[Watch Clip](${latestClip.url})`)
          .setURL(latestClip.url)
          .setImage(height)
          .setFooter("Sent by MeximanianBot", 'attachment://meximanian.png')
          .setTimestamp()
        msg.channel.send(embed);
      }

async function StartUp(){
  const discordData = JSON.parse(await fs.readFile('./discord.json', 'UTF-8'));
  client.login(discordData.token);
}

}

main();
