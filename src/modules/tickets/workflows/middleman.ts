import { ModalSubmitInteraction } from 'discord.js';
import { TicketManager } from '../TicketManager';

const manager = new TicketManager();

export async function handleMiddlemanOpen(interaction: ModalSubmitInteraction) {
  const item     = interaction.fields.getTextInputValue('item');
  const amount   = interaction.fields.getTextInputValue('amount');
  const parties  = interaction.fields.getTextInputValue('parties');

  await manager.createTicket({
    guildId:  interaction.guildId!,
    userId:   interaction.user.id,
    userTag:  interaction.user.tag,
    type:     'MIDDLEMAN',
    formData: { item, amount, parties },
  }, interaction);
}
