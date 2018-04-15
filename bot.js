var Discord = require('discord.io');
var fs = require('fs');
var help = require('./help.json');

var auth = require('./auth.json');
var serversConfig;

//TODO add new permissions to existing config files.
if (fs.existsSync('./servers.json')) {
    serversConfig = require('./servers.json');
}
else {
    fs.appendFile('./servers.json', '{}', function(error){
        if (error) throw error;
        serversConfig = require('./servers.json');
    });
}

var bot = new Discord.Client({
   token: auth.token,
   autorun: true
});
bot.on('ready', function (evt) {
    console.log('Connected');
    console.log('Logged in as: ');
    console.log(bot.username + ' - (' + bot.id + ')');
});

function log(options) {
    if (options.error) {
        console.log('Error (log):\n',options.error);
        return false;
    }
    if (options.response) {
        console.log('Response (log):\n',options.response);
        return true;
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
                if (hCmd === command) {
                    return help[group][command];
                }
            }
        }
    }
    return 'That is not a command.';
}

/**
 * @description Get the number of messages requested from the given channel provided they are less than 14 days old and are sent by the given user and pass this list to a callback function typically to handle the deletion of these messages.
 *
 * @param {String} options.victim The ID of the user who's messages are being deleted.
 * @param {String} options.instigator The ID of the user that initiated the deletion.
 * @param {String} options.channelID The ID of the channel to look for the messages within.
 * @param {Number} options.numberOfMessages The number of messages to delete.
 * @param {Array<String>} [options.messageIDs] The array of messages to be deleted, used when the function calls itself.
 * @param {String} [options.lastMessageID] The ID of the last message that was checked, used when the function calls itself.
 * @param {function(Array<String>, String):undefined} callback Calls a function giving it the array of messages compiled and the channel ID of where they are from.
 */
function getLastMessagesFrom(options, callback) {
    var numberOfMessagesToRetrieve = 50; // Default 50, limit 100, needs to be more than 1 for function to work.
    options.messageIDs = options.messageIDs || [];
    // console.log('victim', options.victim, 'channelID', options.channelID, 'numberOfMessages', options.numberOfMessages, 'messageIDs', options.messageIDs, 'lastMessageID', options.lastMessageID);

    bot.getMessages({
        channelID: options.channelID,
        before: options.lastMessageID,
        limit: numberOfMessagesToRetrieve
    }, function(error, messageArray) {
        log({error: error});
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
            getLastMessagesFrom({victim: options.victim, channelID: options.channelID, numberOfMessages: options.numberOfMessages, messageIDs: options.messageIDs, lastMessageID: options.lastMessageID}, callback);
        }
        else {
            console.log('Calling back');
            callback({messagesToDelete: options.messageIDs, channelID: options.channelID, victim: options.victim, instigator: options.instigator});
        }
    });
}

/**
 * @description Deletes the given messages, 1 to 500 messages, from the given channel.
 *
 * @param {Array<String>} options.messagesToDelete
 * @param {String} options.channelID The channel ID of the messages to be deleted.
 * @param {String} options.victim The ID of the user who's messages are being deleted.
 * @param {String} options.instigator The ID of the user that initiated the deletion.
 */
function deleteMessages(options) {
    if (options.messagesToDelete.length > 1) {
        // takes 2 - 100 messages so call recursively if there is more than 100 passing the undeleted through
        var endSlice;
        if (options.messagesToDelete.length > 100) {
            endSlice = 100;
        }
        else {
            endSlice = options.messagesToDelete.length;
        }
        bot.deleteMessages({
            channelID: options.channelID,
            messageIDs: options.messagesToDelete.slice(0, endSlice)
        }, function(error,response){
            if (log({error: error, response: response})) {
                // console.log(response);
                if (endSlice != options.messagesToDelete.length) {
                    setTimeout( function() {
                        deleteMessages(options.messagesToDelete.slice(endSlice, options.messagesToDelete.length), channelID);
                    }, 1000); // Delay recusrion call by 1 second to avoid Discord API rate limiting.
                }
                if (options.instigator) {
                    bot.sendMessage({
                        to: options.victim,
                        message: 'Messages you sent in channel <#'+options.channelID+'> have been deleted by <@'+options.instigator+'>.'
                    }, function(error,response){
                        log({error: error, response: response});
                    });
                }
                else {
                    bot.sendMessage({
                        to: options.channelID,
                        message: 'Messages deleted.'
                    }, function(error,response){
                        log({error: error, response: response});
                    });
                }
            }
            else {
                // console.log(error);
                bot.sendMessage({
                    to: options.channelID,
                    message: 'Error encountered when attempting to delete messages. Bulk delete API'
                }, function(error,response){
                    log({error: error, response: response});
                });
            }
        });
    }
    else {
        bot.deleteMessage({
            channelID: options.channelID,
            messageID: options.messagesToDelete[0]
        }, function(error) {
            if (log({error: error}) === false) {
                bot.sendMessage({
                    to: options.channelID,
                    message: 'Error encountered when attempting to delete messages. Singular delete API.'
                }, function(error,response){
                    log({error: error, response: response});
                });
            }
            else {
                if (options.instigator) {
                    bot.sendMessage({
                        to: options.victim,
                        message: 'Messages you sent in channel <#'+options.channelID+'> have been deleted by <@'+options.instigator+'>.'
                    }, function(error,response){
                        log({error: error, response: response});
                    });
                }
                else {
                    bot.sendMessage({
                        to: options.channelID,
                        message: 'Messages deleted.'
                    }, function(error,response){
                        log({error: error, response: response});
                    });
                }
            }
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
                                "roleDeletion": 0
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
    console.log(userID);
    if (bot.channels[channelID]) {
        var serverID = bot.channels[channelID].guild_id;
        if (!Object.keys(serversConfig).includes(serverID)) {
            console.log('Server is NOT in the config file');
    //TODO Fix issue where when a new server is added to the bot it requires the bot to be restarted before the owner can set permissions.
            serversConfig = addNewServer(serverID);
            console.log(serversConfig);
        }

        if (message.substring(0, 1) === serversConfig[serverID].commandCharacter) {
            console.log(message);
            var args = message.substring(1).split(' ');
            var cmd = args[0];

            var userAccessLevel = 9; //set to default value of 9
            userAccessLevel = getUserAccessLevel(userID, serverID);

            var commandExecuted = false;
            console.log('User access level is: '+userAccessLevel);

            if (userID === serversConfig[serverID].ownerID || userAccessLevel <= serversConfig[serverID].commandAccessLevels.configBot) {
                switch(cmd) {
                    case 'config':

                        if (args[1] === 'commandCharacter' && args[2] != undefined) {
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

                        fs.writeFile('./servers.json', JSON.stringify(serversConfig, null, 4), function(error){
                            if (error) throw error;
                            console.log('RELOADING config');
                            serversConfig = JSON.parse(fs.readFileSync('./servers.json', 'utf8'));
                            console.log(serversConfig);
                        });
                        commandExecuted = true;
                        break;
                    case 'configShow':
                        bot.sendMessage({
                            to: channelID,
                            message: JSON.stringify(serversConfig[serverID], null, 4)
                        });
                        commandExecuted = true;
                        break;
                }
            }
            if (userAccessLevel <= serversConfig[serverID].commandAccessLevels.moderation && commandExecuted === false) {
                switch(cmd) {
                    case 'deleteUserMessages':
                        if (isUserID(args[1])) {
                            if (userAccessLevel < getUserAccessLevel(getUserString(args[1]), serverID) && Number.isInteger(Number(args[2])) && 1 <= Number(args[2]) <= 500) {
                                console.log('Number of messages to delete validated');
                                getLastMessagesFrom({victim:getUserString(args[1]), channelID:channelID, numberOfMessages:args[2], instigator: userID}, deleteMessages);
                            }
                        }
                        commandExecuted = true;
                        break;
                    case 'addUserTo':
                        console.log('addUserTo');
                        console.log(args[1], isUserID(args[1]), args[2], isRoleID(args[2]));
                        if (isUserID(args[1]) && isRoleID(args[2])) {
                            console.log('passed user id and role id');
                            if (userAccessLevel < getUserAccessLevel(getUserString(args[1]), serverID)) {
                                console.log('sending add request');
                                bot.addToRole({
                                    serverID: serverID,
                                    userID: getUserString(args[1]),
                                    roleID: getRoleString(args[2])
                                }, function(error,response){
                                    // console.log('!join error');
                                    // console.log(error);
                                    if (log({error: error, response: response})) {
                                        bot.sendMessage({
                                            to: channelID,
                                            message: 'Congratulations <@'+getUserString(args[1])+'> you\'ve been added to @'+bot.servers[serverID].roles[getRoleString(args[2])].name
                                        });
                                    }
                                    // console.log('!join response');
                                    // console.log(response);
                                });
                            }
                        }
                        commandExecuted = true;
                        break;
                    case 'removeUserFrom':
                        console.log('addUserTo');
                        console.log(args[1], isUserID(args[1]), args[2], isRoleID(args[2]));
                        if (isUserID(args[1]) && isRoleID(args[2])) {
                            console.log('passed user id and role id');
                            if (userAccessLevel < getUserAccessLevel(getUserString(args[1]), serverID)) {
                                console.log('sending add request');
                                bot.removeFromRole({
                                    serverID: serverID,
                                    userID: getUserString(args[1]),
                                    roleID: getRoleString(args[2])
                                }, function(error,response){
                                    // console.log('!join error');
                                    // console.log(error);
                                    if (log({error: error, response: response})) {
                                        bot.sendMessage({
                                            to: channelID,
                                            message: 'Congratulations <@'+getUserString(args[1])+'> you\'ve been removed from @'+bot.servers[serverID].roles[getRoleString(args[2])].name
                                        });
                                    }
                                    // console.log('!leave response');
                                    // console.log(response);
                                });
                            }
                        }
                        commandExecuted = true;
                        break;
                }
            }
            if (userAccessLevel <= serversConfig[serverID].commandAccessLevels.debug && commandExecuted === false) {
                switch(cmd) {
                    case 'test':
                        console.log(0 <= Number('123456') <= 999999999999999999, Number('123456'));
                        console.log(!isNaN(Number('123456')), Number('123456'));
                        commandExecuted = true;
                        break;
                    case 'sfull':
                        console.log(bot.servers[serverID]);
                        commandExecuted = true;
                        break;
                    case 'rfull':
                        console.log(getAllServerRoles(serverID));
                        commandExecuted = true;
                        break;
                }
            }
            if (userAccessLevel <= serversConfig[serverID].commandAccessLevels.general && commandExecuted === false) {
                switch(cmd) {
                    case 'ping':
                        bot.sendMessage({
                            to: channelID,
                            message: 'Pong!'
                        });
                        bot.getMessages({
                            channelID: channelID,
                            limit: 1
                        }, function(error, messageArray) {
                            if (log({error: error, response: messageArray})) {
                            // if (error) {
                            //     console.log(error);
                            // }
                            // else {
                                // console.log(messageArray);
                                // console.log(messageArray[0].id);
                                bot.addReaction({
                                    channelID: channelID,
                                    messageID: messageArray[0].id,
                                    // reaction: "🍰"
                                    // https://emojipedia.org/ok-hand-sign/
                                    reaction: "👌"
                                }, function(error, response) {
                                    log({error: error, response: response});
                                    // if (error) {
                                    //     console.log(error);
                                    // }
                                    // else {
                                    //     console.log(response);
                                    // }
                                });
                            }
                        });
                        commandExecuted = true;
                        break;
                    case 'lookbusy':
                        bot.simulateTyping(
                            channelID
                        );
                        commandExecuted = true;
                        break;
                    case 'google':
                        if (args[1] != undefined) {
                            bot.sendMessage({
                                to: channelID,
                                message: 'https://www.google.com.au/search?q='+args.slice(1).join('+')
                            });
                        }
                        commandExecuted = true;
                        break;
                    case 'source':
                        bot.sendMessage({
                            to: channelID,
                            message: 'https://github.com/LochMess/ButlerBot'
                        });
                        commandExecuted = true;
                        break;
                    case 'help':
                        var helpMessage = '';
                        if (args[1] === undefined) {
                            helpMessage += 'You have access to the following commands, to learn more about a command use !help <command>\n'
                            Object.keys(help).forEach(function(item, index){
                                if (userAccessLevel <= serversConfig[serverID].commandAccessLevels[item]) {
                                    helpMessage += serversConfig[serverID].commandCharacter+Object.keys(help[item]).join('\n'+serversConfig[serverID].commandCharacter)+'\n';
                                }
                            });
                        }
                        else {
                            helpMessage += getHelpCommandDescription(args[1], userAccessLevel, serverID);
                        }

                        bot.sendMessage({
                            to: channelID,
                            message: helpMessage
                        });
                        commandExecuted = true;
                        break;
                    case 'deleteMessages':
                        console.log('running deleteMessages');

                        if (Number.isInteger(Number(args[1])) && 1 <= Number(args[1]) <= 500) {
                            console.log('Number of messages to delete validated');
                            getLastMessagesFrom({victim: userID, channelID: channelID, numberOfMessages: args[1]}, deleteMessages);
                        }

                        console.log('execution after function call resumed.');
                        commandExecuted = true;
                        break;
                }
            }
            if (userAccessLevel <= serversConfig[serverID].commandAccessLevels.roleQuery && commandExecuted === false) {
                switch(cmd) {
                    case 'roles':
                        bot.sendMessage({
                            to: channelID,
                            message: 'The current roles on the server are: '+getRoleNames(getAllServerRolesIds(serverID), serverID).join(', ')
                        });
                        commandExecuted = true;
                        break;
                    case 'myRoles':
                        var member = getMember(userID, serverID);
                        bot.sendMessage({
                            to: channelID,
                            message: 'You\'re roles are: '+getRoleNames(member.roles, serverID).join(', ')
                        });
                        commandExecuted = true;
                        break;
                    case 'roleMembers':
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
                        bot.sendMessage({
                            to: channelID,
                            message: botReply
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
                                bot.addToRole({
                                    serverID: serverID,
                                    userID: userID,
                                    roleID: roleId
                                }, function(error,response){
                                    // console.log('!join error');
                                    // console.log(error);
                                    // if (error === null) {
                                    if (log({error: error, response: response})) {
                                        bot.sendMessage({
                                            to: channelID,
                                            message: 'Congratulations <@'+userID+'> you\'ve been added to @'+bot.servers[serverID].roles[roleId].name
                                        });
                                    }
                                    // console.log('!join response');
                                    // console.log(response);
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
                                bot.removeFromRole({
                                    serverID: serverID,
                                    userID: userID,
                                    roleID: roleId
                                }, function(error,response){
                                    // console.log('!leave error');
                                    // console.log(error);
                                    if (log({error: error, response: response})) {
                                        bot.sendMessage({
                                            to: channelID,
    //TODO look to see if can colour message text the same as the colour of the role.
                                            message: 'Congratulations <@'+userID+'> you\'ve left @'+bot.servers[serverID].roles[roleId].name
                                        });
                                    }
                                    // console.log('!leave response');
                                    // console.log(response);
                                });
                            }
                        }
                        commandExecuted = true;
                        break;
                }
            }
            if (userAccessLevel <= serversConfig[serverID].commandAccessLevels.roleCreation && commandExecuted === false) {
                switch (cmd) {
                    case 'createRole':
                        var color = message.substring(message.search('-c ')+3);
                        var colorDec = parseInt(color.substring(1), 16);
                        var name = message.substring(message.indexOf(' ')+1,message.search('-c ')).trim();
                        if (!(getAllServerRoles(serverID).map(role => role.name).includes(name)) && !(getAllServerRoles(serverID).map(role => role.color).includes(colorDec))) {
                            bot.createRole(serverID, function(error, response){
                                if (log({error: error, response: response})) {
                                // if (error) {
                                //     console.log(error);
                                // }
                                // else {
                                //     console.log(response);
                                    bot.editRole({
                                        serverID: serverID,
                                        roleID: response.id,
                                        name: name,
                                        mentionable: true,
                                        color: color
                                    }, function(error, response){
                                        // if (error) {
                                        //     console.log(error);
                                        // }
                                        // else {
                                        //     console.log(response);
                                        if (log({error: error, response: response})) {
                                            bot.sendMessage({
                                                to: channelID,
                                                message: 'New role <@&'+response.id+'> created.'
                                            });
                                        }
                                    });
                                }
                            });
                        }
                        else {
                            bot.sendMessage({
                                to: channelID,
                                message: 'Name or color already taken.'
                            });
                        }
                        commandExecuted = true;
                        break;
                }
            }
            if (userAccessLevel <= serversConfig[serverID].commandAccessLevels.roleDeletion && commandExecuted === false) {
                switch(cmd) {
                    case 'deleteRole':
                        var roleID = getRoleString(args[1]);
                        if (args[1] != undefined) {
                            bot.deleteRole({
                                serverID: serverID,
                                roleID: getRoleString(args[1])
                            }, function(error, response){
                                // if (error) {
                                //     console.log(error);
                                // }
                                // else {
                                //     console.log(response);
                                if (log({error: error, response: response})) {
                                    bot.sendMessage({
                                        to: channelID,
                                        message: 'Role deleted. Like totally forever RIP.'
                                    });
                                }
                            });
                        }
                        commandExecuted = true;
                        break;
                }
            }
            if (commandExecuted === false) {
                bot.sendMessage({
                    to: channelID,
                    message: 'Sorry that is not a command or you do not have access to it. More help coming soon! Try !help'
                });
            }
        }
    }
});//on close
