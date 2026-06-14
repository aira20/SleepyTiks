import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
  ChannelType,
  TextChannel,
} from 'discord.js';
import { prisma } from '../../utils/prisma';
import { Colors } from '../../types/index';
import { logger } from '../../utils/logger';
import {
  CHANGELOGS,
  getChangelogByVersion,
  buildChangelogEmbed,
} from '../../config/changelog';

export const data = new SlashCommandBuilder()
  .setName('announce-update')
  .setDescription('Broadcast a changelog to every server with an updates channel configured')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export const adminOnly = true;

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!CHANGELOGS.length) {
    await interaction.reply({ content: 'There are no changelog entries to announce.', ephemeral: true });
    return;
  }

  const select = new StringSelectMenuBuilder()
    .setCustomId('announce-update:select')
    .setPlaceholder('Select a version to broadcast...')
    .addOptions(
      CHANGELOGS.slice(0, 25).map(c => ({
        label: `v${c.version} — ${c.title}`.slice(0, 100),
        description: `Released ${c.date}`,
        value: c.version,
      })),
    );

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(Colors.PRIMARY)
        .setTitle('📢 Announce Update')
        .setDescription('Select the changelog version you want to broadcast to all configured servers.'),
    ],
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
    ephemeral: true,
  });
}

export async function handleSelect(interaction: StringSelectMenuInteraction) {
  if (interaction.customId !== 'announce-update:select') return;

  const version = interaction.values[0];
  const entry = getChangelogByVersion(version);
  if (!entry) {
    await interaction.update({ content: '❌ That version no longer exists.', embeds: [], components: [] });
    return;
  }

  const targetCount = await prisma.guild.count({ where: { updateChannelId: { not: null } } });

  const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`announce-update:confirm:${version}`)
      .setLabel(`Broadcast to ${targetCount} server${targetCount === 1 ? '' : 's'}`)
      .setStyle(ButtonStyle.Success)
      .setDisabled(targetCount === 0),
    new ButtonBuilder()
      .setCustomId('announce-update:cancel')
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary),
  );

  await interaction.update({
    embeds: [
      buildChangelogEmbed(entry),
      new EmbedBuilder()
        .setColor(targetCount === 0 ? Colors.WARNING : Colors.INFO)
        .setDescription(
          targetCount === 0
            ? '⚠️ No servers have an updates channel configured. Nothing to broadcast.'
            : `This will be posted to **${targetCount}** server${targetCount === 1 ? '' : 's'} with an updates channel configured.`,
        ),
    ],
    components: [confirmRow],
  });
}

export async function handleButton(interaction: ButtonInteraction) {
  const [prefix, action, version] = interaction.customId.split(':');
  if (prefix !== 'announce-update') return;

  if (action === 'cancel') {
    await interaction.update({ content: 'Broadcast cancelled.', embeds: [], components: [] });
    return;
  }

  if (action === 'confirm') {
    const entry = getChangelogByVersion(version);
    if (!entry) {
      await interaction.update({ content: '❌ That version no longer exists.', embeds: [], components: [] });
      return;
    }

    await interaction.update({
      embeds: [
        new EmbedBuilder()
          .setColor(Colors.INFO)
          .setTitle('📢 Broadcasting...')
          .setDescription(`Sending v${entry.version} to all configured servers. This may take a moment.`),
      ],
      components: [],
    });

    const targets = await prisma.guild.findMany({
      where: { updateChannelId: { not: null } },
      select: { id: true, name: true, updateChannelId: true },
    });

    const embed = buildChangelogEmbed(entry);
    let success = 0;
    const failures: string[] = [];

    for (const target of targets) {
      const channelId = target.updateChannelId!;
      try {
        const channel = await interaction.client.channels.fetch(channelId).catch(() => null);

        if (!channel) {
          failures.push(`${target.name}: channel deleted or inaccessible`);
          logger.warn(`announce-update: channel ${channelId} for guild ${target.id} missing, skipping`);
          continue;
        }

        if (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement) {
          failures.push(`${target.name}: channel not a text channel`);
          continue;
        }

        await (channel as TextChannel).send({ embeds: [embed] });
        success++;
      } catch (err) {
        failures.push(`${target.name}: ${err instanceof Error ? err.message : 'send failed'}`);
        logger.error(`announce-update: failed to send to guild ${target.id}`, err);
      }
    }

    logger.info(`announce-update: v${entry.version} broadcast — ${success} ok, ${failures.length} failed`);

    const resultEmbed = new EmbedBuilder()
      .setColor(failures.length === 0 ? Colors.SUCCESS : Colors.WARNING)
      .setTitle('📢 Broadcast Complete')
      .setDescription(`**v${entry.version} — ${entry.title}**`)
      .addFields(
        { name: '✅ Sent', value: `${success}`, inline: true },
        { name: '⚠️ Skipped / Failed', value: `${failures.length}`, inline: true },
      );

    if (failures.length) {
      resultEmbed.addFields({
        name: 'Details',
        value: failures.slice(0, 10).join('\n').slice(0, 1024) + (failures.length > 10 ? `\n…and ${failures.length - 10} more` : ''),
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [resultEmbed], components: [] });
    return;
  }
}
