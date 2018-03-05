# Butler Bot
Node.js Discord bot mostly for role management, built using the discord.io library for Node.js (https://github.com/Woor/discord.io/tree/gateway_v6).

## Setup
#### Create a discord bot user
Go to https://discordapp.com/developers/applications and log in and click the `New App` button, give it a name and a profile picture (optional) then click `Create App`. Then on the next screen find the `bot` option and click `Create a Bot User`. Now under the Bot section there will be a `Token:` option with `click to reveal` next to it, click this to reveal the token that will need to be placed in the `auth.json` file once the bot code has been cloned from github.

#### Add a discord bot user to your discord servers
Use the following URL where you've replaced {bot id} with the `Client ID` of your bot user this can be found at the top of its application page.

`https://discordapp.com/oauth2/authorize?client_id={bot id}&scope=bot`<br/>
(Learn more https://discordapp.com/developers/docs/topics/oauth2)

This will give you a page where it will allow you to add the bot to discord servers that you have the `Manage Server` permission on. Select the server you want to add it to from the drop down selector and then click `Authorize`.

The bot is now in your server but will be offline. You'll likely want to create a bot role on your server giving it the permissions which correspond to what you want the bot to be able to do, and remember to place it above the roles you want it to be able to control i.e. the roles you want it to be able to add people to etc.

#### Host the bot on Ubuntu
Install node on Ubuntu with the following commands below, which are from https://nodejs.org/en/download/package-manager/

`curl -sL https://deb.nodesource.com/setup_8.x | sudo -E bash -`<br/>
`sudo apt-get install -y nodejs`

Check the versions installed,

`nodejs -v`<br/>
`npm -v`

This guide was written using nodejs v8.9.4, and npm v5.6.0, these versions or later should be able to run the bot.

Clone the repo to where you want it,

`git clone https://github.com/LochMess/ButlerBot.git`

Navigate to the directory that was created by cloning the repo and run the following command to install the dependencies,

`npm install`

Provide your auth token for the bot user you made earlier. Rename 'TEMPLATE auth.json' to 'auth.json' and open it and replace the text with your token within the quote marks.

Now finally you can run the bot,

`nodejs bot.js`

## Configuration
The default command character that the bot will respond to is `!` and initially only the discord server owner will have permission to have the bot run a command.

#### Display Server Configuration
All the stored details and configuration for the bot on the current server can be displayed in its full raw JSON form by using,

`!configShow`

This shows the required access levels to access the various groups of commands, the groups of commands can be seen in the `commandAccessLevels` section.

#### Access Levels
The access levels are integers with owner = 0, admins = 1, mods = 2, bots = 3 and, regulars = 4. If a user is not in a role that is set as one of these privileged roles then they have an access level of 9.

#### Privileged Roles
Privileged roles are roles that are recognised by the bot and grant users that have the server roles that are assigned to these privileged the corresponding access level.

Server roles are assigned to privileged roles, by using the `!config` command followed by the privileged role followed by tagging the roles to be added to this privileged role.
Examples,

`!config admins @admins`<br/>
`!config admins @admins @Administrators regulars @TheRegulars @trusted`

Roles can be removed from privileged roles by instead using `!config remove` followed by the privileged role.
Example,

`!config remove admins @NotAnAdminRole`

Note: You can view all the privileged roles by using `!configShow`

#### Command Access Levels
All the bot commands are grouped and a user must have a low enough access level to access the commands within a group. The access level required to access various commands, can be set by the server owner by using the `!config` command followed by the access level group to change.
Example,

`!config general 9`

Note: You can view all the command groups by using `!configShow`. Access levels owner = 0, admins = 1, mods = 2, bots = 3, regulars = 4 and, anyone on the server = 9.

#### Command Character
The string that the bot looks for, can be changed to any string of characters without a space within it, by using the `!config commandCharacter` command.
Examples,

`!config commandCharacter $`<br/>
`!config commandCharacter cool`
