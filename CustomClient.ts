import { Client, ClientOptions, Routes } from 'discord.js';
import fs from 'fs';
import { Action, Command, Event } from './interfaces/discord';
import axios from 'axios';
import database from './util/Database/Main';

const ReadDirectory = <T>(path: string) => {
    
    const files: T[] = []
    
    for (const filename of fs.readdirSync(`./dist/${path}`)) {

        const stat = fs.statSync(`./dist/${path}/${filename}`);

        if (stat.isDirectory()) files.push(...ReadDirectory<T>(`${path}/${filename}`));
        else files.push(require(`./${path}/${filename}`).default);

    }

    return files;
}

class CustomClient extends Client {

    commands: Command[] = [];
    _actions: Action[] = [];
    utils = {
        replies: {
            notAuthorized: {
                ephemeral: true,
                embeds: [{
                    color: 0xff0000,
                    description: `:x: | You don't have permission to perform this action.`
                }]
            }
        }
    }

    constructor(options: ClientOptions & { token: string }) {
        super(options)
        this.EventHandler();
        this.CommandHandler();
        this.ActionHandler();
        this.once('ready', this.Configure);
        this.login(options.token).catch(e => {

            if (e.code !== "TokenInvalid") throw e;

            console.error("Your env.DISCORD_TOKEN is invalid. Please re-configure.")
            process.exit()
        })
    }

    private async Configure() {

        const res = await axios.get('/user');

        this.application!.owner = await this.users.fetch(res.data.response.user.id)

    }

    private EventHandler() {
        for (const event of ReadDirectory<Event>("events")) this.on(event.name, event.listener.bind(null, this))
    }

    private CommandHandler() {
        this.commands = ReadDirectory<Command>('commands');

        const slash: Command['data'][] = [];

        for (const command of this.commands) slash.push(command.data.setName(command.name).setDescription(command.description))

        this.once('ready', async () => {
            if (process.env.GUILD_ID) await this.rest.put(Routes.applicationGuildCommands(this.user!.id, process.env.GUILD_ID), { body: slash })
            else if (!database.data.commandsInDiscord) {
                await this.rest.put(Routes.applicationCommands(this.user!.id), { body: slash })
                database.data.commandsInDiscord = true;
            }
        })

    }

    private ActionHandler() {
        this._actions = ReadDirectory<Action>('actions');
    }

}

export {
    CustomClient
};