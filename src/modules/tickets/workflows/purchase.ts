import { ModalSubmitInteraction } from 'discord.js';
import { TicketManager } from '../TicketManager';

const manager = new TicketManager();

export async function handlePurchaseOpen(interaction: ModalSubmitInteraction) {
  const item     = interaction.fields.getTextInputValue('item');
  const budget   = interaction.fields.getTextInputValue('budget');
  const details  = interaction.fields.getTextInputValue('details');

  await manager.createTicket({
    guildId:   interaction.guildId!,
    userId:    interaction.user.id,
    userTag:   interaction.user.tag,
    type:      'PURCHASE',
    formData:  { item, budget, details },
  }, interaction);
}
