const Discord = require('discord.io');
const fs = require('fs');
const util = require('util');
const help = require('./help.json');
const levenshtein = require('fast-levenshtein');

const auth = require('./auth.json');
var serversConfig;

function configSaveReload () {
    fs.writeFile('./servers.json', JSON.stringify(serversConfig, null, 4), function(error){
        if (error) throw error;
        serversConfig = JSON.parse(fs.readFileSync('./servers.json', 'utf8'));
    });
}

function migrateServerConfig (callback) {
    for (var key in serversConfig) {
        if (serversConfig[key].commandAccessLevels.moderation === undefined) {
            console.log('Moderation does not exist and needs to be added.');
            serversConfig[key].commandAccessLevels.moderation = 0;
        }
    }
    callback();
}

if (fs.existsSync('./servers.json')) {
    serversConfig = require('./servers.json');
    migrateServerConfig(configSaveReload);
}
else {
    fs.appendFile('./servers.json', '{}', function(error){
        if (error) throw error;
        serversConfig = require('./servers.json');
    });
}

var botSendMessage;
var botGetMessages;
var botSimulateTyping;
var botAddToRole;
var botRemoveFromRole;
var botCreateRole;
var botEditRole;
var botDeleteRole;
var botRemoveFromRole;
var botAddReaction;
var botDeleteMessages;
var botDeleteMessage;

var bot = new Discord.Client({
   token: auth.token,
   autorun: true
});
bot.on('ready', function (evt) {
    console.log('Connected');
    console.log('Logged in as: ');
    console.log(bot.username + ' - (' + bot.id + ')');
    // Promisify discord io helper functions
    botSendMessage = util.promisify(bot.sendMessage).bind(bot);
    botGetMessages = util.promisify(bot.getMessages).bind(bot);
    botSimulateTyping = util.promisify(bot.simulateTyping).bind(bot);
    botAddToRole = util.promisify(bot.addToRole).bind(bot);
    botRemoveFromRole = util.promisify(bot.removeFromRole).bind(bot);
    botCreateRole = util.promisify(bot.createRole).bind(bot);
    botEditRole = util.promisify(bot.editRole).bind(bot);
    botDeleteRole = util.promisify(bot.deleteRole).bind(bot);
    botRemoveFromRole = util.promisify(bot.removeFromRole).bind(bot);
    botAddReaction = util.promisify(bot.addReaction).bind(bot);
    botDeleteMessages = util.promisify(bot.deleteMessages).bind(bot);
    botDeleteMessage = util.promisify(bot.deleteMessage).bind(bot);
});

/**
 * @description Binary search function to inserting into a sorted array.
 *
 * @param {Array<Number>} array Sorted array for the new value to be inserted into.
 * @param {Number} value The value being compared to the array.
 * @param {Number} start The start of the window of the array being considered.
 * @param {Number} end The end of the window of the array being considered.
 */
function binarySearch(array, value, start, end) {
    if (start === end) {
        if (array[start] > value) {
            return start;
        }
        else {
            return start + 1;
        }
    }

    if (start > end) {
        return start;
    }

    var middle = Math.round((start+end)/2);
    if (array[middle] < value) {
        return binarySearch(array, value, middle+1, end);
    }
    else if (array[middle] > value) {
        return binarySearch(array, value, start, middle-1);
    }
    else {
        return middle;
    }
}

/**
 * @description Logs error and responses returned in callbacks from interactions with the api, returns true for responses and false for errors.
 *
 * @param {String} options.error The error returned.
 * @param {String} options.response The response returned.
 * @param {String} options.channelID The ID of the channel the response is from.
 */
function log(options) {
//TODO Deprecate
    if (options.error) {
        console.log('Error (log):\n', options.error);
        bot.sendMessage({
            to: options.channelID,
            message: `Response Error: ${options.error}\nName: ${options.error.name}\nStatus Code: ${options.error.statusCode}\nStatus Message: ${options.error.statusMessage}\nResponse: { code: ${options.error.response.code}, message: ${options.error.response.message} }`
        }, function(err,res){
            if (log({error: err, response: res})) return false;
        });
    }
    if (options.response) {
        console.log('Response (log):\n', options.response);
        console.log('(log) returning true');
        return true;
    }
}
/**
 * @description Logs error and responses returned in callbacks from interactions with the api, returns true for responses and false for errors.
 *
 * @param {String} options.error The error returned.
 * @param {String} options.eventID The ID of the event that triggered the bot.
 * @param {String} options.channelID The ID of the channel the response is from.
 */
function errorLog(options) {
    if (options.error) {
        console.log('Error (errorLog):\n', options.error);
        bot.sendMessage({
            to: options.channelID,
            message: `Response Error: ${options.error}\nName: ${options.error.name}\nStatus Code: ${options.error.statusCode}\nStatus Message: ${options.error.statusMessage}\nResponse: { code: ${options.error.response.code}, message: ${options.error.response.message} }`
        });
        react({channelID: options.channelID, messageID: options.eventID, reaction: '-1'});
    }
}

function getRoleString(s) {
    return s.substring(s.indexOf('&')+1,s.indexOf('>'));
}

function getUserString(s) {
    if (s.indexOf('!') === 2) {
        return s.substring(s.indexOf('!')+1,s.indexOf('>'));
    }
    else {
        return s.substring(s.indexOf('@')+1,s.indexOf('>'));
    }
}

function isPrivilegedRole(rID, sID) {
    for (var group of Object.keys(serversConfig[sID].privilegeRoles)) {
        if (serversConfig[sID].privilegeRoles[group].roles.includes(rID)) {
            return true;
        }
    }
    return false;
}

function isRoleID(rID) {
    if (rID.length === 22 && rID.indexOf('<') === 0 && rID.indexOf('@') === 1 && rID.indexOf('&') === 2 && rID.indexOf('>') === 21 && !isNaN(Number(rID.substring(3,21)))) {
        return true
    }
    else {
        return false
    }
}

function isUserID(uID) {
    // Users with a nickname will have IDs of the form <@!numbers> users without nicknames do not have the !
    var offSet = 0;
    if (uID.indexOf('!') === 2) {
        offSet = 1;
    }
    if (uID.length === 21+offSet && uID.indexOf('<') === 0 && uID.indexOf('@') === 1 && uID.indexOf('>') === 20+offSet && !isNaN(Number(uID.substring(3,20+offSet)))) {
        return true
    }
    else {
        return false
    }
}

function getAllServerRolesIds(sID){
    return Object.keys(bot.servers[sID].roles);
}

function getAllServerRoles(sID){
    return Object.values(bot.servers[sID].roles);
}

function getAllServerChannelIds(sID){
    return Object.keys(bot.servers[sID].channels);
}

function getAllServerMemberIds(sID){
    return Object.keys(bot.servers[sID].members);
}

function getAllServerMembers(sID){
    return Object.values(bot.servers[sID].members);
}

function getMember(mId, sID){
    return bot.servers[sID].members[mId];
}

function getUsers(userIds){
    var users = [];
    userIds.forEach(function(id,index){
        users.push(bot.users[id]);
    });
    return users;
}

function getAllRoleMembers(rId, sID){
    var members = getAllServerMembers(sID);
    var membersInRole = [];
    members.forEach(function(member, index){
        member.roles.forEach(function(role, index){
            if (role === rId) {
                membersInRole.push(member);
            }
        });
    });
    return membersInRole;
}

function getAllRoleMemberIds(rId, sID){
    var members = getAllServerMembers(sID);
    var membersInRole = [];
    members.forEach(function(member, index){
        member.roles.forEach(function(role, index){
            if (role === rId) {
                membersInRole.push(member.id);
            }
        });
    });
    return membersInRole;
}

function getRoleNames(roleIdList, sID){
    var names = [];
    roleIdList.forEach(function(item,index){
        if (item != 'undefined') {
            if (bot.servers[sID].roles[item].name.substring(0,1) != '@') {
                names.push(bot.servers[sID].roles[item].name);
            }
            else {
                names.push(bot.servers[sID].roles[item].name.substring(1));
            }
        }
    });
    return names;
}

function listsIntersect(list1, list2){
    for (value of list1) {
        if (list2.includes(value)) {
            return true;
        }
    }
    return false;
}

function getUserAccessLevel(userId, sID){
    if (userId === serversConfig[sID].ownerID) {
            return 0;
    }
    else if (listsIntersect(bot.servers[sID].members[userId].roles,serversConfig[sID].privilegeRoles.admins.roles)) {
        console.log('User has admin privileges on this server');
        return serversConfig[sID].privilegeRoles.admins.accessLevel;
    }
    else if (listsIntersect(bot.servers[sID].members[userId].roles,serversConfig[sID].privilegeRoles.mods.roles)) {
        console.log('User has mod privileges on this server');
        return serversConfig[sID].privilegeRoles.mods.accessLevel;
    }
    else if (listsIntersect(bot.servers[sID].members[userId].roles,serversConfig[sID].privilegeRoles.bots.roles)) {
        console.log('User has bot privileges on this server');
        return serversConfig[sID].privilegeRoles.bots.accessLevel;
    }
    else if (listsIntersect(bot.servers[sID].members[userId].roles,serversConfig[sID].privilegeRoles.regulars.roles)) {
        console.log('User has regular privileges on this server');
        return serversConfig[sID].privilegeRoles.regulars.accessLevel;
    }
    else {
        return 9;
    }
}

function getHelpCommandDescription(hCmd, uAL, sID){
    for (var group of Object.keys(help)) {
        if (uAL <= serversConfig[sID].commandAccessLevels[group]) {
            for (var command of Object.keys(help[group])) {
                if (hCmd === command.toLowerCase()) {
                    return help[group][command];
                }
            }
        }
    }
    return 'That is not a command.';
}

/**
 * @description Reacts to the given message in the given channel.
 *
 * @param {String} options.channelID The channel ID of the messages to be deleted.
 * @param {String} options.messageID The ID of the message to react to.
 * @param {String} options.reaction The a string representing the reaction to use.
 */
 //TODO: Make react function with a dictionary for taking strings and matching to emoji
function react(options) {
    // Get reaction emojis from https://emojipedia.org/ok-hand-sign/
    var reactions = {'+1': "👍",
        '-1': "👎",
        'ok': "👌"
    };

    bot.addReaction({
        channelID: options.channelID,
        messageID: options.messageID,
        reaction: reactions[options.reaction]
    }, function(error, response) {
        // log({error: error, response: response});
        if (error) console.log(error);
    });
}

/**
 * @description Get the number of messages requested from the given channel provided they are less than 14 days old and are sent by the given user and pass this list to a callback function typically to handle the deletion of these messages.
 *
 * @param {String} options.victim The ID of the user who's messages are being deleted.
 * @param {String} options.instigator The ID of the user that initiated the deletion.
 * @param {String} options.channelID The ID of the channel to look for the messages within.
 * @param {Number} options.numberOfMessages The number of messages to delete.
 * @param {Array<String>} [options.messageIDs] The array of messages to be deleted, used when the function calls itself.
 * @param {String} options.lastMessageID The ID of the last message that was checked, used when the function calls itself.
 * @param {String} options.eventID The ID of the event that triggered the bot.
 * @param {function(Array<String>, String):undefined} callback Calls a function giving it the array of messages compiled and the channel ID of where they are from.
 */
function getLastMessagesFromUser(options, callback) {
//TODO Promisify
    var numberOfMessagesToRetrieve = 100; // Default 50, limit 100, needs to be more than 1 for function to work.
    options.messageIDs = options.messageIDs || [];

    console.log('The victim id is:'+options.victim);

    botGetMessages({
        channelID: options.channelID,
        before: options.lastMessageID,
        limit: numberOfMessagesToRetrieve
    }).then( function(messageArray) {
        messageArray.forEach(function(item, index) {
            // Add check for if the message is less than 14 days old.
            var current = new Date();
            var messageDate = new Date(item.timestamp);
            if (item.author.id === options.victim && options.messageIDs.length < options.numberOfMessages && Math.abs(current.getTime() - messageDate.getTime()) / (1000*60*60*24) < 14) {
                options.messageIDs.push(item.id);
            }
            options.lastMessageID = item.id;
        });
        if (options.messageIDs.length < options.numberOfMessages && numberOfMessagesToRetrieve === messageArray.length) {
            getLastMessagesFromUser({victim: options.victim, channelID: options.channelID, numberOfMessages: options.numberOfMessages, messageIDs: options.messageIDs, lastMessageID: options.lastMessageID, eventID: options.eventID, instigator: options.instigator}, callback);
        }
        else {
            console.log('Calling back');
            callback({messagesToDelete: options.messageIDs, channelID: options.channelID, victim: options.victim, instigator: options.instigator, eventID: options.eventID});
        }
    }).catch( function(error) {
        errorLog({error: error, channelID: options.channelID, eventID: options.eventID});
    });
}

/**
 * @description Get the number of messages requested from the given channel provided they are less than 14 days old and pass this list to a callback function typically to handle the deletion of these messages.
 *
 * @param {String} options.channelID The ID of the channel to look for the messages within.
 * @param {Number} options.numberOfMessages The number of messages to delete.
 * @param {Array<String>} [options.messageIDs] The array of messages to be deleted, used when the function calls itself.
 * @param {String} options.lastMessageID The ID of the last message that was checked, used when the function calls itself.
 * @param {String} options.eventID The ID of the event that triggered the bot.
 * @param {function(Array<String>, String):undefined} callback Calls a function giving it the array of messages compiled and the channel ID of where they are from.
 */
function getLastMessagesFromChannel(options, callback) {

    var numberOfMessagesToRetrieve = 100; // Default 50, limit 100, needs to be more than 1 for function to work.
    options.messageIDs = options.messageIDs || [];

    botGetMessages({
        channelID: options.channelID,
        before: options.lastMessageID,
        limit: numberOfMessagesToRetrieve
    }).then( function(messageArray) {
        messageArray.forEach(function(item, index) {
            // Add check for if the message is less than 14 days old.
            var current = new Date();
            var messageDate = new Date(item.timestamp);
            if (options.messageIDs.length < options.numberOfMessages && Math.abs(current.getTime() - messageDate.getTime()) / (1000*60*60*24) < 14) {
                options.messageIDs.push(item.id);
            }
            options.lastMessageID = item.id;
        });
        if (options.messageIDs.length < options.numberOfMessages && numberOfMessagesToRetrieve === messageArray.length) {
            getLastMessagesFromChannel({channelID: options.channelID, numberOfMessages: options.numberOfMessages, messageIDs: options.messageIDs, lastMessageID: options.lastMessageID, eventID: options.eventID}, callback);
        }
        else {
            console.log('Calling back');
            callback({messagesToDelete: options.messageIDs, channelID: options.channelID, eventID: options.eventID});
        }
    }).catch( function(error) {
        errorLog({error: error, channelID: options.channelID, eventID: options.eventID});
    });
}

/**
 * @description Get up to 500 messages in the current channel sent by or to the bot. Messages less than 14 days old will be deleted.
 *
 * @param {String} options.channelID The ID of the channel to look for the messages within.
 * @param {String} options.serverID The ID of the server the messages are being deleted from.
 * @param {Number} options.numberOfMessages The number of messages to delete.
 * @param {Array<String>} [options.messageIDs] The array of messages to be deleted, used when the function calls itself.
 * @param {String} options.lastMessageID The ID of the last message that was checked, used when the function calls itself.
 * @param {String} options.eventID The ID of the event that triggered the bot.
 * @param {function(Array<String>, String):undefined} callback Calls a function giving it the array of messages compiled and the channel ID of where they are from.
 */
 function getLastMessagesFromToBot(options, callback) {
    var numberOfMessagesToRetrieve = 100; // Default 50, limit 100, needs to be more than 1 for function to work.
    options.messageIDs = options.messageIDs || [];

    console.log('The victim id is:'+options.victim);

    botGetMessages({
        channelID: options.channelID,
        before: options.lastMessageID,
        limit: numberOfMessagesToRetrieve
    }).then( function(messageArray) {
        messageArray.forEach(function(item, index) {
            // Add check for if the message is less than 14 days old.
            var current = new Date();
            var messageDate = new Date(item.timestamp);
            console.log('item.content[0]: '+item.content.substring(0,1)+', serversConfig[options.serverID].commandCharacter: '+serversConfig[options.serverID].commandCharacter);
            if ((item.content[0] === serversConfig[options.serverID].commandCharacter || item.author.id === options.victim) && options.messageIDs.length < options.numberOfMessages && Math.abs(current.getTime() - messageDate.getTime()) / (1000*60*60*24) < 14) {
                options.messageIDs.push(item.id);
            }
            options.lastMessageID = item.id;
        });
        if (options.messageIDs.length < options.numberOfMessages && numberOfMessagesToRetrieve === messageArray.length) {
            getLastMessagesFromUser({victim: options.victim, serverID: options.serverID, channelID: options.channelID, numberOfMessages: options.numberOfMessages, messageIDs: options.messageIDs, lastMessageID: options.lastMessageID, eventID: options.eventID, instigator: options.instigator}, callback);
        }
        else {
            console.log('Calling back');
            callback({messagesToDelete: options.messageIDs, channelID: options.channelID, victim: options.victim, instigator: options.instigator, eventID: options.eventID});
        }
    }).catch( function(error) {
        errorLog({error: error, channelID: options.channelID, eventID: options.eventID});
    });
}

/**
 * @description Deletes the given messages, 1 to 500 messages, from the given channel.
 *
 * @param {Array<String>} options.messagesToDelete
 * @param {String} options.channelID The channel ID of the messages to be deleted.
 * @param {String} options.victim The ID of the user who's messages are being deleted.
 * @param {String} options.instigator The ID of the user that initiated the deletion.
 * @param {String} options.eventID The ID of the event that triggered the bot.
 */
function deleteMessages(options) {
//TODO Promisify, and rework has some bugs.
// Can't react to messages that have been deleted.
// Rate limiting from discord, possibly from get messages calls?
    if (options.messagesToDelete.length > 1) {
        // takes 2 - 100 messages so call recursively if there is more than 100 passing the undeleted through
        var endSlice;
        if (options.messagesToDelete.length > 100) {
            endSlice = 100;
        }
        // if (options.messagesToDelete.length > 2) {
        //     endSlice = 2;
        // }
        else {
            endSlice = options.messagesToDelete.length;
        }
        botDeleteMessages({
            channelID: options.channelID,
            messageIDs: options.messagesToDelete.slice(0, endSlice)
        }).then( function(response) {
            // TODO test that it only sends one message to the victim and not multiple if it has to loop

            // More messages to delete recursion call
            if (endSlice != options.messagesToDelete.length) {
                setTimeout( function() {
                    deleteMessages({messagesToDelete: options.messagesToDelete.slice(endSlice, options.messagesToDelete.length), channelID: options.channelID, eventID: options.eventID, instigator: options.instigator, victim: options.victim});
                }, 100); // Delay recursion call by 100ms to limit spamming Discord API.
            } else {
                if (options.instigator) {
                    bot.sendMessage({
                        to: options.victim,
                        message: 'Messages you sent in channel <#'+options.channelID+'> have been deleted by <@'+options.instigator+'>.'
                    });
                }
                else if (options.victim !== bot.id) {
                    bot.sendMessage({
                        to: options.channelID,
                        message: 'Messages deleted.'
                    });
                }
            }
        }).catch( function(error) {
            console.log('Error, Retry after this many ms: '+error.response.retry_after);
            if (error.response.retry_after) {
                setTimeout( function() {
                    deleteMessages({messagesToDelete: options.messagesToDelete, channelID: options.channelID, eventID: options.eventID, instigator: options.instigator, victim: options.victim});
                }, error.response.retry_after); // Recall API with the same parameters after the timeout has ended.
            }
            else {
                errorLog({error: error, channelID: options.channelID, eventID: options.eventID});
                bot.sendMessage({
                    to: options.channelID,
                    message: 'Error encountered when attempting to delete messages. Bulk delete API'
                });
            }
        });
    }
    else {
        botDeleteMessage({
            channelID: options.channelID,
            messageID: options.messagesToDelete[0]
        }).then( function() {
            if (options.instigator) {
                botSendMessage({
                    to: options.victim,
                    message: 'Messages you sent in channel <#'+options.channelID+'> have been deleted by <@'+options.instigator+'>.'
                });
            }
            else if (options.victim !== bot.id) {
                bot.sendMessage({
                    to: options.channelID,
                    message: 'Messages deleted.'
                });
            }
        }).catch( function(error) {
            errorLog({error: error, channelID: options.channelID, eventID: options.eventID});
            bot.sendMessage({
                to: options.channelID,
                message: 'Error encountered when attempting to delete messages. Singular delete API.'
            });
        });
    }
}

function addNewServer(sID){
    var newServer = {
                        [sID]: {
                            "id": sID,
                            "ownerID": bot.servers[sID].owner_id,
                            "commandCharacter": "!",
                            "privilegeRoles": {
                                "admins": {"accessLevel": 1, "roles": []},
                                "mods": {"accessLevel": 2, "roles": []},
                                "bots": {"accessLevel": 3, "roles": []},
                                "regulars": {"accessLevel": 4, "roles": []}
                            },
                            "commandAccessLevels": {
                                "debug": 0,
                                "configBot": 0,
                                "general": 0,
                                "roleQuery": 0,
                                "roleChange": 0,
                                "roleCreation": 0,
                                "roleDeletion": 0,
                                "moderation": 0
                            }
                        }
                    };
    if (Object.keys(serversConfig).length === 0 && serversConfig.constructor === Object) {
        fs.writeFileSync('./servers.json', JSON.stringify(newServer, null, 4));
        return JSON.parse(fs.readFileSync('./servers.json', 'utf8'));

    }
    else {
        fs.writeFileSync('./servers.json', JSON.stringify(serversConfig, null, 4).substring(0,JSON.stringify(serversConfig, null, 4).lastIndexOf('}'))+','+JSON.stringify(newServer, null, 4).substring(1));
        return JSON.parse(fs.readFileSync('./servers.json', 'utf8'));
    }
}

bot.on('disconnect', function(msg, code){
    if (code === 0) return console.error(msg);
    bot.connect();
});

bot.on('message', function (user, userID, channelID, message, event) {
    // console.log(event);
    // console.log(event.d.id);
    // console.log(userID);

    var eventID = event.d.id;
    if (bot.channels[channelID]) {
        var serverID = bot.channels[channelID].guild_id;
        if (!Object.keys(serversConfig).includes(serverID)) {
            console.log('Server is NOT in the config file');
    //TODO Fix issue where when a new server is added to the bot it requires the bot to be restarted before the owner can set permissions.
            serversConfig = addNewServer(serverID);
            console.log(serversConfig);
        }

        if (message.toLowerCase().substring(0, 1) === serversConfig[serverID].commandCharacter) {
            console.log(message);
            var args = message.toLowerCase().substring(1).split(' ');
            var cmd = args[0];

            var userAccessLevel = 9; //set to default value of 9
            userAccessLevel = getUserAccessLevel(userID, serverID);

            var commandExecuted = false;
            console.log('User access level is: '+userAccessLevel);

            if (userID === serversConfig[serverID].ownerID || userAccessLevel <= serversConfig[serverID].commandAccessLevels.configBot) {
                switch(cmd) {
                    case 'config':

                        if (args[1] === 'commandCharacter'.toLowerCase() && args[2] != undefined) {
                            serversConfig[serverID].commandCharacter = args[2];
                        }

                        var remove = false;
                        if (args[1] === 'remove') {
                            remove = true;
                        }
                        args.forEach(function(item, index){
                            if (Object.keys(serversConfig[serverID].privilegeRoles).includes(item) && args[index+1] != undefined) {
                                for (var i = index+1; i < args.length; i++) {
                                    if (isRoleID(args[i])) {
                                        if (serversConfig[serverID].privilegeRoles[item].roles.includes(getRoleString(args[i])) && remove === true) {
                                            if (remove) {
                                                var indexToRemove = serversConfig[serverID].privilegeRoles[item].roles.indexOf(getRoleString(args[i]));
                                                if (indexToRemove > -1) {
                                                    serversConfig[serverID].privilegeRoles[item].roles.splice(indexToRemove, 1);
                                                }
                                            }
                                        }
                                        if (!serversConfig[serverID].privilegeRoles[item].roles.includes(getRoleString(args[i])) && remove === false) {
                                            serversConfig[serverID].privilegeRoles[item].roles.push(getRoleString(args[i]));
                                        }
                                    }
                                    else {
                                        i = args.length;
                                    }
                                }
                            }
                        });

                        args.forEach(function(item, index){
                            if (Object.keys(serversConfig[serverID].commandAccessLevels).includes(item) && args[index+1] != undefined && 0<= args[index+1] <=9) {
                                serversConfig[serverID].commandAccessLevels[item] = Number(args[index+1]);
                            }
                        });
                        migrateServerConfig(configSaveReload);
                        react({channelID:channelID, messageID: eventID, reaction: '+1'});

                        commandExecuted = true;
                        break;
                    case 'configShow'.toLowerCase():
                        botSendMessage({
                            to: channelID,
                            message: JSON.stringify(serversConfig[serverID], null, 4)
                        }).then( function(response) {
                            react({channelID:channelID, messageID: eventID, reaction: '+1'});
                        }).catch( function(error) {
                            errorLog({error: error, channelID: channelID, eventID: eventID});
                        });
                        commandExecuted = true;
                        break;
                }
            }
            if (userAccessLevel <= serversConfig[serverID].commandAccessLevels.moderation && commandExecuted === false) {
                switch(cmd) {
                    case 'deleteUserMessages'.toLowerCase():
                    //TODO ad in code to -1 for errors
                        if (isUserID(args[1])) {
                            if (userAccessLevel < getUserAccessLevel(getUserString(args[1]), serverID) && Number.isInteger(Number(args[2])) && 1 <= Number(args[2]) <= 500) {
                                console.log('Number of messages to delete validated');
                                getLastMessagesFromUser({victim:getUserString(args[1]), channelID:channelID, numberOfMessages:args[2], instigator: userID, eventID: eventID}, deleteMessages);
                            }
                        }
                        commandExecuted = true;
                        break;
                    case 'addUserTo'.toLowerCase():
                        console.log('addUserTo');
                        console.log(args[1], isUserID(args[1]), args[2], isRoleID(args[2]));
                        if (isUserID(args[1]) && isRoleID(args[2])) {
                            console.log('passed user id and role id');
                            if (userAccessLevel < getUserAccessLevel(getUserString(args[1]), serverID)) {
                                console.log('sending add request');
                                botAddToRole({
                                    serverID: serverID,
                                    userID: getUserString(args[1]),
                                    roleID: getRoleString(args[2])
                                }).then( function(response) {
                                    return botSendMessage({
                                        to: channelID,
                                        message: 'Congratulations <@'+getUserString(args[1])+'> you\'ve been added to @'+bot.servers[serverID].roles[getRoleString(args[2])].name
                                    });
                                }).then( function(response) {
                                    react({channelID:channelID, messageID: eventID, reaction: '+1'});
                                }).catch( function(error) {
                                    errorLog({error: error, channelID: channelID, eventID: eventID});
                                });
                            }
                        }
                        commandExecuted = true;
                        break;
                    case 'removeUserFrom'.toLowerCase():
                        console.log('addUserTo');
                        console.log(args[1], isUserID(args[1]), args[2], isRoleID(args[2]));
                        if (isUserID(args[1]) && isRoleID(args[2])) {
                            console.log('passed user id and role id');
                            if (userAccessLevel < getUserAccessLevel(getUserString(args[1]), serverID)) {
                                console.log('sending add request');
                                botRemoveFromRole({
                                    serverID: serverID,
                                    userID: getUserString(args[1]),
                                    roleID: getRoleString(args[2])
                                }).then( function(response) {
                                    return botSendMessage({
                                        to: channelID,
                                        message: 'Congratulations <@'+getUserString(args[1])+'> you\'ve been removed from @'+bot.servers[serverID].roles[getRoleString(args[2])].name
                                    });
                                }).then( function(response) {
                                    react({channelID:channelID, messageID: eventID, reaction: '+1'});
                                }).catch( function(error) {
                                    errorLog({error: error, channelID: channelID, eventID: eventID});
                                });
                            }
                        }
                        commandExecuted = true;
                        break;
                    case 'clearChannel'.toLowerCase():
                        getLastMessagesFromChannel({channelID: channelID, numberOfMessages: 500, eventID: eventID}, deleteMessages);
                        commandExecuted = true;
                        break;
                    case 'cleanChannel'.toLowerCase():
                        getLastMessagesFromChannel({channelID: channelID, numberOfMessages: args[1], eventID: eventID}, deleteMessages);
                        commandExecuted = true;
                        break;
                    case 'clearbot':
                        getLastMessagesFromToBot({victim: bot.id, serverID: serverID, channelID: channelID, numberOfMessages: 500, eventID: eventID}, deleteMessages);
                        commandExecuted = true;
                        break;
                }
            }
            if (userAccessLevel <= serversConfig[serverID].commandAccessLevels.debug && commandExecuted === false) {
                switch(cmd) {
                    case 'test':
                        console.log(0 <= Number('123456') <= 999999999999999999, Number('123456'));
                        console.log(!isNaN(Number('123456')), Number('123456'));
                        react({channelID:channelID, messageID: eventID, reaction: '+1'});
                        commandExecuted = true;
                        break;
                    case 'sfull':
                        console.log(bot.servers[serverID]);
                        react({channelID:channelID, messageID: eventID, reaction: '+1'});
                        commandExecuted = true;
                        break;
                    case 'rfull':
                        console.log(getAllServerRoles(serverID));
                        react({channelID:channelID, messageID: eventID, reaction: '+1'});
                        commandExecuted = true;
                        break;
                    case 't':
                        if (args[1] != undefined) {
                            function getStuffAsync(param){
                                return new Promise(function(resolve,reject){
                                    bot.sendMessage(param, function(error,response) {
                                        if (error !== null) return reject(error);
                                        resolve(response);
                                    });
                                });
                            }
                            getStuffAsync({
                                to: channelID,
                                message: 'https://www.google.com.au/search?q='+args.slice(1).join('+')
                            }).then( function(response) {
                                react({channelID:channelID, messageID: eventID, reaction: '+1'});
                            }).catch( function(error) {
                                react({channelID:channelID, messageID: eventID, reaction: '-1'});
                            });
                        }
                        commandExecuted = true;
                        break;
                    case 'y':
                        if (args[1] != undefined) {
                            bot.getMessages({
                                channelID: {dontwork: 123,
                                pleasebreakfortestingpurposes: 'heck yes'},//channelID,
                                before:  eventID,
                                limit: 100
                            }, function(err, res) {
                                if (err) console.log('getMessages error is: '+err);
                                if (res) console.log('getMessages response is: '+Object.keys(res));
                            });
                            bot.sendMessage({
                                channelID: 123,
                                message: 123
                            }, function(err, res) {
                                if (err) console.log('sendMessage error is: '+err);
                                if (res) console.log('sendMessage response is: '+res);
                            });
                            botSendMessage({
                                to: channelID,
                                message: 'https://www.google.com.au/search?q='+args.slice(1).join('+')
                            }).then( function(response) {
                                console.log(response);
                                react({channelID:channelID, messageID: eventID, reaction: '+1'});
                            }).then(
                                () => {
                                    console.log('is this the looper')
                                    return botGetMessages({
                                        channelID: 'eventID',//channelID,
                                        before:  eventID,
                                        limit: 100
                                    });

                            }).then( function(messagesArray) {
                                console.log('here 1');
                                return botSendMessage({
                                    to: channelID,
                                    message: 'And the response is: '+ messagesArray.map(message => message.content).join(', ').substring(0,1800)//Object.keys(messagesArray[1])//messagesArray.join(', ')
                                });
                            }).catch( function(error) {
                                console.log('here 2');
                                errorLog({error: error, channelID: channelID, eventID: eventID});
                                // console.log(error);
                                // react({channelID:channelID, messageID: eventID, reaction: '-1'});
                            });
                        }
                        console.log('here 3');
                        commandExecuted = true;
                        console.log('here 4: '+commandExecuted);
                        break;
                    case 'z':
                        botSendMessage({
                            to: channelID,
                            message: 'https://www.google.com.au/search?q='+args.slice(1).join('+')
                        }).then( function(response) {
                            console.log(response);
                            react({channelID:channelID, messageID: eventID, reaction: '+1'});
                        }).then(
                            () => {
                                console.log('here 0')
                                return botSendMessage({
                                    to: 123,
                                    message: 123
                                });
                        }).then(
                            () => {
                                console.log('here 1');
                                return botSendMessage({
                                    to: channelID,
                                    message: 'the successful message'
                                });

                        }).catch( function(error) {
                            console.log('here 2');
                            errorLog({error: error, channelID: channelID, eventID: eventID});
                            // console.log(error);
                            // react({channelID: channelID, messageID: eventID, reaction: '-1'});
                        });
                        commandExecuted = true;
                        break;
                    case 'get':
                        getLastMessagesFromUser({victim: userID, channelID: channelID, numberOfMessages: args[1], eventID: eventID}, function(options) {
                            for (var value in options) {
                                if (options[value]) Array.isArray(options[value]) ? console.log("Value passed to callback, "+value+": "+options[value].length) : console.log("Value passed to callback, "+value+": "+options[value]);
                            }

                        });
                        commandExecuted = true;
                        break;
                }
            }
            if (userAccessLevel <= serversConfig[serverID].commandAccessLevels.general && commandExecuted === false) {
                switch(cmd) {
                    case 'event':
                        var delay = Number(args[1]);
                        setTimeout( function() {
                            var regex = RegExp(/\d /,'g');
                            var match = regex.exec(message);
                            botSendMessage({
                                to: channelID,
                                message: message.substring(match.index+match[0].length)
                            }).then( function(response) {
                                console.log(response);
                            }).catch( function(error) {
                                console.log(error);
                                errorLog({error: error, channelID: channelID, eventID: eventID});
                            });
<<<<<<< HEAD
                        }, delay*60000);
=======
                        }, delay*6000);
>>>>>>> aea35544baf23b39bd8e1233b05c5239efc6a8b7
                        react({channelID:channelID, messageID: eventID, reaction: '+1'});
                        commandExecuted = true;
                        break;
                    case 'ping':
                        botSendMessage({
                            to: channelID,
                            message: 'Pong!'
                        }).then( function(response) {
                            react({channelID:channelID, messageID: eventID, reaction: '+1'});
                        }).catch( function(error) {
                            errorLog({error: error, channelID: channelID, eventID: eventID});
                        });
                        commandExecuted = true;
                        break;
                    case 'lookbusy':
                        botSimulateTyping(
                            channelID
                        ).then( function(response) {
                            react({channelID:channelID, messageID: eventID, reaction: '+1'});
                        }).catch( function(error) {
                            errorLog({error: error, channelID: channelID, eventID: eventID});
                        });
                        commandExecuted = true;
                        break;
                    case 'google':
                        if (args[1] != undefined) {
                            botSendMessage({
                                to: channelID,
                                message: 'https://www.google.com.au/search?q='+args.slice(1).join('+')
                            }).then( function(response) {
                                react({channelID:channelID, messageID: eventID, reaction: '+1'});
                            }).catch( function(error) {
                                errorLog({error: error, channelID: channelID, eventID: eventID});
                            });
                        }
                        commandExecuted = true;
                        break;
                    case 'source':
                        botSendMessage({
                            to: channelID,
                            message: 'https://github.com/LochMess/ButlerBot'
                        }).then( function(response) {
                            react({channelID:channelID, messageID: eventID, reaction: '+1'});
                        }).catch( function(error) {
                            errorLog({error: error, channelID: channelID, eventID: eventID});
                        });
                        commandExecuted = true;
                        break;
                    case 'help':
                        var helpMessage = '';
                        if (args[1] === undefined) {
                            helpMessage += 'You have access to the following commands, to learn more about a command use '+serversConfig[serverID].commandCharacter+'help <command>\n'
                            Object.keys(help).forEach(function(item, index){
                                if (userAccessLevel <= serversConfig[serverID].commandAccessLevels[item]) {
                                    helpMessage += serversConfig[serverID].commandCharacter+Object.keys(help[item]).join('\n'+serversConfig[serverID].commandCharacter)+'\n';
                                }
                            });
                        }
                        else {
                            helpMessage += getHelpCommandDescription(args[1], userAccessLevel, serverID);
                        }

                        botSendMessage({
                            to: channelID,
                            message: helpMessage
                        }).then( function(response) {
                            react({channelID:channelID, messageID: eventID, reaction: '+1'});
                        }).catch( function(error) {
                            errorLog({error: error, channelID: channelID, eventID: eventID});
                        });
                        commandExecuted = true;
                        break;
                    case 'deleteMessages'.toLowerCase():
                    //TODO Add promises
                        console.log('running deleteMessages');

                        if (Number.isInteger(Number(args[1])) && 1 <= Number(args[1]) <= 500) {
                            console.log('Number of messages to delete validated');
                            getLastMessagesFromUser({victim: userID, channelID: channelID, numberOfMessages: args[1], eventID: eventID}, deleteMessages);
                        }

                        console.log('execution after function call resumed.');
                        commandExecuted = true;
                        break;
                }
            }
            if (userAccessLevel <= serversConfig[serverID].commandAccessLevels.roleQuery && commandExecuted === false) {
                switch(cmd) {
                    case 'roles':
                        botSendMessage({
                            to: channelID,
                            message: 'The current roles on the server are: '+getRoleNames(getAllServerRolesIds(serverID), serverID).join(', ')
                        }).then( function(response) {
                            react({channelID:channelID, messageID: eventID, reaction: '+1'});
                        }).catch( function(error) {
                            errorLog({error: error, channelID: channelID, eventID: eventID});
                        });
                        commandExecuted = true;
                        break;
                    case 'myRoles'.toLowerCase():
                        var member = getMember(userID, serverID);
                        botSendMessage({
                            to: channelID,
                            message: 'You\'re roles are: '+getRoleNames(member.roles, serverID).join(', ')
                        }).then( function(response) {
                            react({channelID:channelID, messageID: eventID, reaction: '+1'});
                        }).catch( function(error) {
                            errorLog({error: error, channelID: channelID, eventID: eventID});
                        });
                        commandExecuted = true;
                        break;
                    case 'roleMembers'.toLowerCase():
                        if (args[1] != undefined) {
                            var members = getAllRoleMembers(getRoleString(args[1]), serverID);
                            var usersInRole = getUsers(members.map(member => member.id));
                            var botReply = '';
                            for (var id in members.map(member => member.id)) {
                                if (members[id].nick === undefined || members[id].nick === null) {
                                    botReply += 'U: '+usersInRole[id].username+'#'+usersInRole[id].discriminator+'\n';
                                }
                                else {
                                    botReply += 'U: '+usersInRole[id].username+'#'+usersInRole[id].discriminator+' N: '+members[id].nick+'\n';
                                }
                            }
                        }
                        botSendMessage({
                            to: channelID,
                            message: botReply
                        }).then( function(response) {
                            react({channelID:channelID, messageID: eventID, reaction: '+1'});
                        }).catch( function(error) {
                            errorLog({error: error, channelID: channelID, eventID: eventID});
                        });
                        commandExecuted = true;
                        break;
                }
            }
            if (userAccessLevel <= serversConfig[serverID].commandAccessLevels.roleChange && commandExecuted === false) {
                switch(cmd) {
                    case 'join':
                        if (args[1] != undefined) {
                            var roleId = getRoleString(args[1]);
                            var privilegedRole = isPrivilegedRole(roleId, serverID);
                            if (privilegedRole === false) {
                                botAddToRole({
                                    serverID: serverID,
                                    userID: userID,
                                    roleID: roleId
                                }).then( function(response) {
                                    return botSendMessage({
                                        to: channelID,
                                        message: 'Congratulations <@'+userID+'> you\'ve been added to @'+bot.servers[serverID].roles[roleId].name
                                    });
                                }).then( function(response) {
                                    react({channelID:channelID, messageID: eventID, reaction: '+1'});
                                }).catch( function(error) {
                                    errorLog({error: error, channelID: channelID, eventID: eventID});
                                });
                            }
                        }
                        commandExecuted = true;
                        break;
                    case 'leave':
                        if (args[1] != undefined) {
                            var roleId = getRoleString(args[1]);
                            var privilegedRole = isPrivilegedRole(roleId, serverID);
                            if (privilegedRole === false) {
                                botRemoveFromRole({
                                    serverID: serverID,
                                    userID: userID,
                                    roleID: roleId
                                }).then( function(response) {
                                    return botSendMessage({
                                        to: channelID,
//TODO look to see if can colour message text the same as the colour of the role.
                                        message: 'Congratulations <@'+userID+'> you\'ve left @'+bot.servers[serverID].roles[roleId].name
                                    });
                                }).then( function(response) {
                                    react({channelID:channelID, messageID: eventID, reaction: '+1'});
                                }).catch( function(error) {
                                    errorLog({error: error, channelID: channelID, eventID: eventID});
                                });
                            }
                        }
                        commandExecuted = true;
                        break;
                }
            }
            if (userAccessLevel <= serversConfig[serverID].commandAccessLevels.roleCreation && commandExecuted === false) {
                switch (cmd) {
                    case 'createRole'.toLowerCase():
                        var color = message.substring(message.search('-c ')+3);
                        var colorDec = parseInt(color.substring(1), 16);
                        var name = message.substring(message.indexOf(' ')+1,message.search('-c ')).trim();
                        if (!(getAllServerRoles(serverID).map(role => role.name).includes(name)) && !(getAllServerRoles(serverID).map(role => role.color).includes(colorDec))) {
                            botCreateRole(serverID
                            ).then( function(response) {
                                return botEditRole({
                                    serverID: serverID,
                                    roleID: response.id,
                                    name: name,
                                    mentionable: true,
                                    color: color
                                });
                            }).then( function(response) {
                                return botSendMessage({
                                    to: channelID,
                                    message: 'New role <@&'+response.id+'> created.'
                                });
                            }).then( function(response) {
                                react({channelID:channelID, messageID: eventID, reaction: '+1'});
                            }).catch( function(error) {
                                errorLog({error: error, channelID: channelID, eventID: eventID});
                            });
                        }
                        else {
                            botSendMessage({
                                to: channelID,
                                message: 'Name or color already taken.'
                            }).then( function(response) {
                                react({channelID:channelID, messageID: eventID, reaction: '+1'});
                            }).catch( function(error) {
                                errorLog({error: error, channelID: channelID, eventID: eventID});
                            });
                        }
                        commandExecuted = true;
                        break;
                }
            }
            if (userAccessLevel <= serversConfig[serverID].commandAccessLevels.roleDeletion && commandExecuted === false) {
                switch(cmd) {
                    case 'deleteRole'.toLowerCase():
                        var roleID = getRoleString(args[1]);
                        if (args[1] != undefined) {
                            botDeleteRole({
                                serverID: serverID,
                                roleID: getRoleString(args[1])
                            }).then( function(response) {
                                return botSendMessage({
                                    to: channelID,
                                    message: 'Role deleted. Like totally forever RIP.'
                                });
                            }).then( function(response) {
                                react({channelID:channelID, messageID: eventID, reaction: '+1'});
                            }).catch( function(error) {
                                errorLog({error: error, channelID: channelID, eventID: eventID});
                            });
                        }
                        commandExecuted = true;
                        break;
                }
            }
            if (commandExecuted === false) {
                var commands = [];
                Object.keys(help).forEach( function(item, index) {
                    if (userAccessLevel <= serversConfig[serverID].commandAccessLevels[item]) {
                        commands = commands.concat(Object.keys(help[item]));
<<<<<<< HEAD
                    }
                });
                var suggestions = [];
                commands.forEach( function(item, index) {
                    var levScore = levenshtein.get(item.toString(), cmd.toString());
                    if (levScore <= (cmd.toString().length)/2) {
                        suggestions[0] ? suggestions.splice(binarySearch(suggestions, levScore, 0, suggestions.length - 1), 0, {command: item, score: levScore}) : suggestions.push({command: item, score: levScore});
                    }
                });

=======
                    }
                });
                var suggestions = [];
                commands.forEach( function(item, index) {
                    var levScore = levenshtein.get(item.toString(), cmd.toString());
                    if (levScore <= (cmd.toString().length)/2) {
                        suggestions[0] ? suggestions.splice(binarySearch(suggestions, levScore, 0, suggestions.length - 1), 0, {command: item, score: levScore}) : suggestions.push({command: item, score: levScore});
                    }
                });
                
>>>>>>> aea35544baf23b39bd8e1233b05c5239efc6a8b7
                botSendMessage({
                    to: channelID,
                    message: suggestions.length > 0  ? 'Sorry that is not a command or you do not have access to it.\nDid you mean '+suggestions.map(levObj => levObj.command).join(', ')+'?\nPerhaps try !help' : 'Sorry that is not a command or you do not have access to it.\nPerhaps try '+serversConfig[serverID].commandCharacter+'help'
                }).then( function(response) {
                    //TODO make it not a +1 since the command didn't match?
                    react({channelID:channelID, messageID: eventID, reaction: '+1'});
                }).catch( function(error) {
                    errorLog({error: error, channelID: channelID, eventID: eventID});
                });
            }
        }
    }
});//on close
