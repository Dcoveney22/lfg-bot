import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ChannelType,
} from "discord.js";
import { raids } from "../logic/store.js";

export const data = new SlashCommandBuilder()
  .setName("raid")
  .setDescription("Assemble an Arc Raiders fireteam")
  .addSubcommand((sc) =>
    sc
      .setName("create")
      .setDescription("Broadcast a new Arc Raiders call-out")
      // required first
      .addStringOption((o) =>
        o
          .setName("name")
          .setDescription("Raid / operation name")
          .setRequired(true)
      )
      .addIntegerOption((o) =>
        o
          .setName("slots")
          .setDescription("Squad size including you")
          .addChoices({ name: "1", value: 1 }, { name: "2", value: 2 })
          .setRequired(true)
      )
      // optional after
      .addStringOption((o) =>
        o.setName("description").setDescription("Brief objective / notes")
      )
      .addRoleOption((o) =>
        o.setName("ping1").setDescription("Ping role 1 (timezone / region)")
      )
      .addRoleOption((o) =>
        o.setName("ping2").setDescription("Ping role 2 (optional)")
      )
  );

export async function execute(interaction, client) {
  if (interaction.options.getSubcommand() !== "create") return;

  const name = interaction.options.getString("name");
  const desc = interaction.options.getString("description") ?? "";
  const max = interaction.options.getInteger("slots");
  // collect ping roles
  const roles = [1, 2]
    .map((n) => interaction.options.getRole(`ping${n}`))
    .filter(Boolean)
    .map((r) => r.id);

  const guild = interaction.guild;
  const parent = interaction.channel.parentId;
  const vc = await guild.channels.create({
    name: `🎮 ${name}`,
    type: ChannelType.GuildVoice,
    parent,
    reason: `Raid VC for ${name}`,
  });

  // --- new embed styling ---
  const embed = new EmbedBuilder()
    .setColor(0xf77f00) // Arc-Raiders amber / orange
    .setAuthor({
      name: "ARC RAIDERS — Fireteam Signal",
      iconURL: "https://yourcdnlink.com/arc-logo.png", // replace with your logo URL
    })
    .setTitle(`🛰️ ${name}`)
    .setDescription(desc || "*No mission details transmitted.*")
    .addFields({
      name: "Fireteam Roster",
      value: `<@${interaction.user.id}> (Lead Operator)`,
    })
    .setFooter({
      text: `Slots Engaged: 1/${max}`,
      iconURL: "https://yourcdnlink.com/arc-logo.png", // optional same logo
    })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("join")
      .setLabel("Join")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("leave")
      .setLabel("Leave")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("close")
      .setLabel("Close")
      .setStyle(ButtonStyle.Danger)
  );

  const msg = await interaction.reply({
    content: roles.map((r) => `<@&${r}>`).join(" "),
    embeds: [embed],
    components: [row],
    fetchReply: true,
  });

  raids.set(msg.id, {
    id: msg.id,
    guildId: guild.id,
    channelId: interaction.channel.id,
    creatorId: interaction.user.id,
    name,
    desc,
    max,
    members: [interaction.user.id],
    pingRoleIds: roles,
    voiceChannelId: vc.id,
    lastEmptyAt: null,
  });
}

export async function handleButton(inter, client) {
  const raid = raids.get(inter.message.id);
  if (!raid)
    return inter.reply({ content: "Raid not found.", ephemeral: true });

  if (inter.customId === "join") {
    if (raid.members.includes(inter.user.id))
      return inter.reply({ content: "You’re already in.", ephemeral: true });
    if (raid.members.length >= raid.max)
      return inter.reply({ content: "Raid is full.", ephemeral: true });
    raid.members.push(inter.user.id);
  }
  if (inter.customId === "leave") {
    raid.members = raid.members.filter((id) => id !== inter.user.id);
  }
  if (inter.customId === "close" && inter.user.id === raid.creatorId) {
    const vc = await client.channels
      .fetch(raid.voiceChannelId)
      .catch(() => null);
    if (vc) await vc.delete("Raid closed by host");
    raids.delete(raid.id);
    return inter.update({
      content: "Raid closed.",
      components: [],
      embeds: [],
    });
  }

  // update embed
  const emb = EmbedBuilder.from(inter.message.embeds[0])
    .spliceFields(0, 1, {
      name: "Players",
      value: raid.members.map((id) => `<@${id}>`).join("\n") || "None",
    })
    .setFooter({ text: `Slots: ${raid.members.length}/${raid.max}` });

  await inter.update({ embeds: [emb] });
}
