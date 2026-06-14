import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { Colors } from '../../types/index';
import {
  CHANGELOGS,
  getLatestChangelog,
  getChangelogByVersion,
  buildChangelogEmbed,
} from '../../config/changelog';

export const data = new SlashCommandBuilder()
  .setName('changelog')
  .setDescription('See what changed in the latest bot update')
  .addStringOption(o =>
    o.setName('version')
      .setDescription('Show a specific version (e.g. 1.0.0)')
      .setRequired(false),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const version = interaction.options.getString('version');

  if (version) {
    const entry = getChangelogByVersion(version);
    if (!entry) {
      const available = CHANGELOGS.map(c => `\`${c.version}\``).join(', ');
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(Colors.WARNING)
            .setTitle('❓ Version Not Found')
            .setDescription(`No changelog exists for version \`${version}\`.\n\n**Available versions:** ${available}`),
        ],
        ephemeral: true,
      });
      return;
    }
    await interaction.reply({ embeds: [buildChangelogEmbed(entry)] });
    return;
  }

  const latest = getLatestChangelog();
  if (!latest) {
    await interaction.reply({
      content: 'No changelog entries are available yet.',
      ephemeral: true,
    });
    return;
  }

  await interaction.reply({ embeds: [buildChangelogEmbed(latest)] });
}
