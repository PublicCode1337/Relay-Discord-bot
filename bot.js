require('dotenv').config();
const { Client, GatewayIntentBits, WebhookClient, REST, Routes, SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

// init sqlite db
let db;

(async () => {
    try {
        db = await open({
            filename: path.join(__dirname, 'data', 'webhooks.db'),
            driver: sqlite3.Database
        });

        await db.run(`CREATE TABLE IF NOT EXISTS webhooks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId TEXT,
            channelId TEXT,
            webhookId TEXT,
            webhookToken TEXT,
            username TEXT
        )`);
    } catch (error) {
        console.error('Error initializing database:', error);
    }
})();

// init discord bot
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

const allowedChannelIds = ['1253848908208148571', '1253848848342716537', '1259865385834905630']; // EURE CHANNEL IDS HIER EINTRAGEN!!
const userQueues = new Map();
const userMessageCounts = new Map();
const RATE_LIMIT_WINDOW = 60000;
const RATE_LIMIT_MAX = 3;

client.once('ready', () => {
    try {
        console.log('bot is ready!');

        // Register slash command
        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);
        const commands = [
            new SlashCommandBuilder()
                .setName('webhook')
                .setDescription('Send a message or attachment as a webhook')
                .addStringOption(option =>
                    option.setName('message')
                        .setDescription('The message to send')
                        .setRequired(false))
                .addAttachmentOption(option =>
                    option.setName('attachment')
                        .setDescription('The attachment to send')
                        .setRequired(false)),
        ].map(command => command.toJSON());

        rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID), { body: commands })
            .then(() => console.log('Successfully registered application commands.'))
            .catch(console.error);
    } catch (error) {
        console.error('Error during bot initialization:', error);
    }
});

client.on('interactionCreate', async interaction => {
    try {
        if (!interaction.isCommand()) return;

        const { commandName } = interaction;

        if (commandName === 'webhook') {
            const message = interaction.options.getString('message');
            const attachment = interaction.options.getAttachment('attachment');
            const channel = interaction.channel;
            const user = interaction.user;

            if (!message && !attachment) {
                await interaction.reply({ content: 'You must provide a message or an attachment.', ephemeral: true });
                return;
            }

            if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                const currentTime = Date.now();

                if (!userMessageCounts.has(user.id)) {
                    userMessageCounts.set(user.id, []);
                }

                const timestamps = userMessageCounts.get(user.id);
                timestamps.push(currentTime);

                // remove old timestamps
                while (timestamps.length > 0 && timestamps[0] <= currentTime - RATE_LIMIT_WINDOW) {
                    timestamps.shift();
                }

                if (timestamps.length > RATE_LIMIT_MAX) {
                    await interaction.reply({ content: 'Hast du irgendwelche Störungen?', ephemeral: true });
                    return;
                }
            }

            queueMessage(user.id, {
                interaction,
                message,
                attachment,
                channel,
                username: user.username,
                displayAvatarURL: user.displayAvatarURL({ format: 'png' })
            });

            await interaction.reply({ content: 'Message added to the queue!', ephemeral: true });
        }
    } catch (error) {
        console.error('Error processing interaction:', error);
    }
});

client.on('messageCreate', async message => {
    try {
        if (message.author.bot) return;

        const { author, content, channel, attachments } = message;

        // check if msg in allowed channel
        if (!allowedChannelIds.includes(channel.id)) return;

        const username = message.member ? message.member.displayName : author.username;

        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            const currentTime = Date.now();

            if (!userMessageCounts.has(author.id)) {
                userMessageCounts.set(author.id, []);
            }

            const timestamps = userMessageCounts.get(author.id);
            timestamps.push(currentTime);

            // remove old timestamps
            while (timestamps.length > 0 && timestamps[0] <= currentTime - RATE_LIMIT_WINDOW) {
                timestamps.shift();
            }

            if (timestamps.length > RATE_LIMIT_MAX) {
                await message.reply('Hast du irgendwelche Störungen?');
                return;
            }

            if (timestamps.length === RATE_LIMIT_MAX) {
                queueMessage(author.id, {
                    message: content,
                    attachment: attachments.first(),
                    channel,
                    username,
                    displayAvatarURL: author.displayAvatarURL({ format: 'png' })
                });
                await message.delete();
                return;
            }
        }

        // check if content is valid
        if (!content && attachments.size === 0) return;

        await sendWebhookMessage({
            message: content,
            attachment: attachments.first(),
            channel,
            username,
            displayAvatarURL: author.displayAvatarURL({ format: 'png' })
        });

        await message.delete();
    } catch (error) {
        console.error('Error processing message:', error);
    }
});

function queueMessage(userId, msg) {
    try {
        if (!userQueues.has(userId)) {
            userQueues.set(userId, []);
        }
        const userQueue = userQueues.get(userId);
        userQueue.push(msg);
        if (userQueue.length === 1) {
            processQueue(userId);
        }
    } catch (error) {
        console.error('Error queuing message:', error);
    }
}

async function processQueue(userId) {
    try {
        const userQueue = userQueues.get(userId);
        if (!userQueue || userQueue.length === 0) return;

        while (userQueue.length > 0) {
            const msg = userQueue[0];
            await sendWebhookMessage(msg);
            userQueue.shift();
            await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
        }

        userQueues.delete(userId);
    } catch (error) {
        console.error('Error processing queue:', error);
    }
}

async function sendWebhookMessage({ interaction, message, attachment, channel, username, displayAvatarURL }) {
    try {
        // Create a new webhook
        const webhook = await channel.createWebhook({
            name: username,
            avatar: displayAvatarURL
        });

        const webhookClient = new WebhookClient({ id: webhook.id, token: webhook.token });

        const files = attachment ? [{
            attachment: attachment.url,
            name: attachment.name
        }] : [];

        // Send message with webhook
        await webhookClient.send({
            content: message || (files.length > 0 ? ' ' : ''),
            username: username,
            avatarURL: displayAvatarURL,
            files: files,
            allowedMentions: { parse: ['users', 'roles'], repliedUser: false }
        });

        // Delete the webhook immediately
        await webhook.delete();

        if (interaction) {
            await interaction.followUp({ content: 'Message sent via webhook!', ephemeral: true });
        }
    } catch (error) {
        console.error('Error processing webhook message:', error);
        if (interaction) {
            try {
                await interaction.followUp({ content: 'There was an error sending the webhook message.', ephemeral: true });
            } catch (followUpError) {
                console.error('Error sending follow-up message:', followUpError);
            }
        }
    }
}

client.login(process.env.DISCORD_BOT_TOKEN).catch(error => {
    console.error('Error logging in:', error);
});
