import {
  Interaction,
  ChatInputCommandInteraction,
  ButtonInteraction,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
  RoleSelectMenuInteraction,
  ChannelSelectMenuInteraction,
} from 'discord.js';
import { PrismaClient } from '@prisma/client';
import { ExtendedClient } from '../bot/client';
import { checkCommandPermissions } from '../bot/permissions';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export default {
  name: 'interactionCreate',
  once: false,
  async execute(interaction: Interaction, client: ExtendedClient) {
    try {
      if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        if (interaction.guildId) {
          await prisma.guild.upsert({
            where: { id: interaction.guildId },
            update: {},
            create: { id: interaction.guildId, name: interaction.guild?.name ?? 'Unknown' },
          });
        }

        const allowed = await checkCommandPermissions(interaction as ChatInputCommandInteraction, command);
        if (!allowed) return;

        await command.execute(interaction as ChatInputCommandInteraction);
        return;
      }

      if (interaction.isButton()) {
        const [commandName] = interaction.customId.split(':');
        const command = client.commands.get(commandName);
        if (command?.handleButton) {
          await command.handleButton(interaction as ButtonInteraction);
        }
        return;
      }

      if (interaction.isModalSubmit()) {
        const [commandName] = interaction.customId.split(':');
        const command = client.commands.get(commandName);
        if (command?.handleModal) {
          await command.handleModal(interaction as ModalSubmitInteraction);
        }
        return;
      }

      // Route all select menu types to handleSelect
      if (
        interaction.isStringSelectMenu() ||
        interaction.isRoleSelectMenu() ||
        interaction.isChannelSelectMenu()
      ) {
        const [commandName] = interaction.customId.split(':');
        const command = client.commands.get(commandName);
        if (command?.handleSelect) {
          await command.handleSelect(
            interaction as StringSelectMenuInteraction | RoleSelectMenuInteraction | ChannelSelectMenuInteraction,
          );
        }
        return;
      }
    } catch (err) {
      logger.error('interactionCreate error', err);
      if (err instanceof Error) logger.error(err.stack ?? '');
      try {
        const i = interaction as ChatInputCommandInteraction;
        const reply = { content: 'An unexpected error occurred.', ephemeral: true };
        if (i.deferred) await i.editReply(reply).catch(() => {});
        else if (i.replied) await i.followUp(reply).catch(() => {});
        else await i.reply(reply).catch(() => {});
      } catch {}
    }
  },
};
