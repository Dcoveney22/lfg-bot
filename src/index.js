import {
  Client,
  GatewayIntentBits,
  Partials,
  Collection,
  REST,
  Routes,
} from "discord.js";
import "dotenv/config";
import * as raid from "./commands/raid.js";
import { handleVoiceState } from "./logic/voice.js";

// 1️⃣ Create the client FIRST
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates, // for voice channel events
  ],
  partials: [Partials.Channel],
});

// 2️⃣ Command collection
client.commands = new Collection();
client.commands.set(raid.data.name, raid);

// 3️⃣ Register slash command (guild-scoped for dev)
const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
await rest.put(
  Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
  { body: [raid.data.toJSON()] }
);
console.log("✅ Commands registered");

// 4️⃣ Event listeners
client.on("interactionCreate", (i) => {
  if (i.isChatInputCommand()) {
    const cmd = client.commands.get(i.commandName);
    if (cmd) cmd.execute(i, client);
  } else if (i.isButton()) {
    raid.handleButton(i, client);
  }
});

client.on("voiceStateUpdate", (o, n) => handleVoiceState(o, n, client));

client.once("ready", () => console.log(`🤖 Logged in as ${client.user.tag}`));
client.login(process.env.DISCORD_TOKEN);
