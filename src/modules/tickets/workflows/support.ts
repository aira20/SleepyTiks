import { ModalSubmitInteraction } from 'discord.js';
import { TicketManager } from '../TicketManager';

const manager = new TicketManager();

export async function handleSupportOpen(interaction: ModalSubmitInteraction) {
  const subject = interaction.fields.getTextInputValue('subject');
  const details = interaction.fields.getTextInputValue('details');

  await manager.createTicket({
    guildId:  interaction.guildId!,
    userId:   interaction.user.id,
    userTag:  interaction.user.tag,
    type:     'SUPPORT',
    formData: { subject, details },
  }, interaction);
}
